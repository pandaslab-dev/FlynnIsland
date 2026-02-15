const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { PNG } = require('pngjs');
const { Server } = require('socket.io');

const PORT = Number(process.env.PORT) || 3000;
const TICK_RATE_MS = 50;
const TICK_SECONDS = TICK_RATE_MS / 1000;

const SPAWN_X = 1024;
const SPAWN_Y = 1024;
const WORLD_WIDTH = 2048;
const WORLD_HEIGHT = 2048;
const ISLAND_MASK_PATH = path.resolve(__dirname, '..', 'misc_assets', 'islandedge.png');
const ROOT_DIR = path.resolve(__dirname, '..');
const INDEX_HTML_PATH = path.join(ROOT_DIR, 'index.html');
const INDEX_BUILD_TOKEN = '__BUILD_ID__';
const BUILD_ID = (
  process.env.RENDER_GIT_COMMIT ||
  process.env.SOURCE_VERSION ||
  process.env.RENDER_SERVICE_ID ||
  'dev'
).trim();

const ALLOWED_DOG_TYPES = new Set(['Alice', 'Remix', 'Sapphire', 'Wendy']);

const players = {};

const BALL_RADIUS = 46;
const PLAYER_COLLISION_RADIUS = 52;
const BALL_MAX_SPEED = 950;
const BALL_BOUNCE_DAMPING = 0.82;
const BALL_FRICTION = 0.989;
const BALL_SPAWN_X = 1024;
const BALL_SPAWN_Y = 820;
const WINNING_SCORE = 10;
const GOAL_EVENT_COOLDOWN_TICKS = 2;

const TOP_GOAL_ZONE = {
  x: 749,
  y: 196,
  width: 166,
  height: 63
};

const BOTTOM_GOAL_ZONE = {
  x: 1264,
  y: 844,
  width: 166,
  height: 63
};

let islandMask = null;
let goalCooldownTicksRemaining = 0;

const ball = {
  x: BALL_SPAWN_X,
  y: BALL_SPAWN_Y,
  vx: 0,
  vy: 0,
  radius: BALL_RADIUS
};

const scores = {
  left: 0,
  right: 0
};

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(ROOT_DIR, {
  index: false,
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    const relativePath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');

    if (relativePath === 'index.html' || relativePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return;
    }

    // Core app logic should never be cached to avoid stale/mixed client versions.
    if (relativePath.startsWith('src/') && relativePath.endsWith('.js')) {
      res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
      return;
    }

    res.setHeader('Cache-Control', 'public, max-age=86400');
  }
}));

function renderIndexHtml() {
  const indexTemplate = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
  return indexTemplate.split(INDEX_BUILD_TOKEN).join(BUILD_ID);
}

app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.type('html').send(renderIndexHtml());
});

app.get('/index.html', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.type('html').send(renderIndexHtml());
});

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    playerCount: Object.keys(players).length
  });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

function sanitizeName(name) {
  if (typeof name !== 'string') {
    return 'Player';
  }

  const trimmed = name.trim().slice(0, 15);
  return trimmed.length > 0 ? trimmed : 'Player';
}

function sanitizeDogType(dogType) {
  if (typeof dogType !== 'string') {
    return 'Remix';
  }

  const normalized = dogType.trim();
  if (ALLOWED_DOG_TYPES.has(normalized)) {
    return normalized;
  }

  return 'Remix';
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clampVectorMagnitude(vx, vy, maxMagnitude) {
  const magnitudeSq = (vx * vx) + (vy * vy);
  if (magnitudeSq <= (maxMagnitude * maxMagnitude)) {
    return { vx, vy };
  }

  const magnitude = Math.sqrt(magnitudeSq) || 1;
  const factor = maxMagnitude / magnitude;
  return {
    vx: vx * factor,
    vy: vy * factor
  };
}

function loadIslandMask() {
  try {
    const maskBuffer = fs.readFileSync(ISLAND_MASK_PATH);
    const png = PNG.sync.read(maskBuffer);

    islandMask = {
      width: png.width,
      height: png.height,
      data: png.data
    };
  } catch (error) {
    islandMask = null;
    console.warn(`Island mask load failed at ${ISLAND_MASK_PATH}; using world bounds fallback.`);
  }
}

function isBlockedAtWorldPoint(worldX, worldY) {
  if (!islandMask) {
    return worldX < 0 || worldY < 0 || worldX >= WORLD_WIDTH || worldY >= WORLD_HEIGHT;
  }

  const pixelX = Math.floor(worldX);
  const pixelY = Math.floor(worldY);

  if (
    pixelX < 0 ||
    pixelY < 0 ||
    pixelX >= islandMask.width ||
    pixelY >= islandMask.height
  ) {
    return true;
  }

  const pixelIndex = ((pixelY * islandMask.width) + pixelX) * 4;
  const r = islandMask.data[pixelIndex];
  const g = islandMask.data[pixelIndex + 1];
  const b = islandMask.data[pixelIndex + 2];
  const a = islandMask.data[pixelIndex + 3];

  if (a === 0) {
    return false;
  }

  return r < 12 && g < 12 && b < 12;
}

function canBallOccupy(worldX, worldY) {
  const sampleRadius = BALL_RADIUS - 4;
  const points = [
    { x: worldX, y: worldY },
    { x: worldX + sampleRadius, y: worldY },
    { x: worldX - sampleRadius, y: worldY },
    { x: worldX, y: worldY + sampleRadius },
    { x: worldX, y: worldY - sampleRadius },
    { x: worldX + (sampleRadius * 0.7), y: worldY + (sampleRadius * 0.7) },
    { x: worldX - (sampleRadius * 0.7), y: worldY + (sampleRadius * 0.7) },
    { x: worldX + (sampleRadius * 0.7), y: worldY - (sampleRadius * 0.7) },
    { x: worldX - (sampleRadius * 0.7), y: worldY - (sampleRadius * 0.7) }
  ];

  for (const point of points) {
    if (isBlockedAtWorldPoint(point.x, point.y)) {
      return false;
    }
  }

  return true;
}

function pushBallToNearestOpenSpace() {
  if (canBallOccupy(ball.x, ball.y)) {
    return true;
  }

  const originX = ball.x;
  const originY = ball.y;
  const angleStep = (Math.PI * 2) / 16;

  for (let radius = 4; radius <= 120; radius += 4) {
    for (let i = 0; i < 16; i += 1) {
      const angle = i * angleStep;
      const candidateX = originX + (Math.cos(angle) * radius);
      const candidateY = originY + (Math.sin(angle) * radius);

      if (canBallOccupy(candidateX, candidateY)) {
        ball.x = candidateX;
        ball.y = candidateY;
        return true;
      }
    }
  }

  return false;
}

function simulateBall(dt) {
  const targetX = ball.x + (ball.vx * dt);
  const targetY = ball.y + (ball.vy * dt);

  if (canBallOccupy(targetX, ball.y)) {
    ball.x = targetX;
  } else {
    ball.vx = -ball.vx * BALL_BOUNCE_DAMPING;
  }

  if (canBallOccupy(ball.x, targetY)) {
    ball.y = targetY;
  } else {
    ball.vy = -ball.vy * BALL_BOUNCE_DAMPING;
  }

  Object.values(players).forEach((player) => {
    const dx = ball.x - player.x;
    const dy = ball.y - player.y;
    const distanceSq = (dx * dx) + (dy * dy);
    const minDistance = BALL_RADIUS + PLAYER_COLLISION_RADIUS;
    const minDistanceSq = minDistance * minDistance;

    if (distanceSq >= minDistanceSq) {
      return;
    }

    const distance = Math.sqrt(distanceSq) || 0.0001;
    const normalX = dx / distance;
    const normalY = dy / distance;
    const overlap = minDistance - distance;

    ball.x += normalX * overlap;
    ball.y += normalY * overlap;

    const playerVx = Number.isFinite(player.vx) ? player.vx : 0;
    const playerVy = Number.isFinite(player.vy) ? player.vy : 0;
    const playerPushAlongNormal = (playerVx * normalX) + (playerVy * normalY);
    const movementImpulse = Math.max(0, playerPushAlongNormal) * 0.95;
    const separationImpulse = overlap * 34;
    const totalImpulse = movementImpulse + separationImpulse;

    ball.vx += normalX * totalImpulse;
    ball.vy += normalY * totalImpulse;

    const clamped = clampVectorMagnitude(ball.vx, ball.vy, BALL_MAX_SPEED);
    ball.vx = clamped.vx;
    ball.vy = clamped.vy;
  });

  if (!canBallOccupy(ball.x, ball.y)) {
    const escaped = pushBallToNearestOpenSpace();
    if (!escaped) {
      ball.x = clamp(ball.x, BALL_RADIUS, WORLD_WIDTH - BALL_RADIUS);
      ball.y = clamp(ball.y, BALL_RADIUS, WORLD_HEIGHT - BALL_RADIUS);
    }
    ball.vx = -ball.vx * BALL_BOUNCE_DAMPING;
    ball.vy = -ball.vy * BALL_BOUNCE_DAMPING;
  }

  ball.vx *= BALL_FRICTION;
  ball.vy *= BALL_FRICTION;

  if (Math.abs(ball.vx) < 1.2) {
    ball.vx = 0;
  }
  if (Math.abs(ball.vy) < 1.2) {
    ball.vy = 0;
  }
}

function resetBallToCenter() {
  ball.x = BALL_SPAWN_X;
  ball.y = BALL_SPAWN_Y;
  ball.vx = 0;
  ball.vy = 0;
}

function circleIntersectsRect(circleX, circleY, radius, rect) {
  const closestX = clamp(circleX, rect.x, rect.x + rect.width);
  const closestY = clamp(circleY, rect.y, rect.y + rect.height);
  const dx = circleX - closestX;
  const dy = circleY - closestY;
  return ((dx * dx) + (dy * dy)) <= (radius * radius);
}

function handleGoalScoring() {
  if (goalCooldownTicksRemaining > 0) {
    goalCooldownTicksRemaining -= 1;
    return false;
  }

  const topGoalHit = circleIntersectsRect(ball.x, ball.y, ball.radius, TOP_GOAL_ZONE);
  const bottomGoalHit = circleIntersectsRect(ball.x, ball.y, ball.radius, BOTTOM_GOAL_ZONE);

  if (!topGoalHit && !bottomGoalHit) {
    return false;
  }

  if (topGoalHit) {
    scores.right += 1;
  } else if (bottomGoalHit) {
    scores.left += 1;
  }

  if (scores.left >= WINNING_SCORE || scores.right >= WINNING_SCORE) {
    scores.left = 0;
    scores.right = 0;
  }

  resetBallToCenter();
  goalCooldownTicksRemaining = GOAL_EVENT_COOLDOWN_TICKS;
  return true;
}

function serializePlayer(player) {
  return {
    id: player.id,
    name: player.name,
    dogType: player.dogType,
    x: player.x,
    y: player.y,
    animation: player.animation,
    flipX: player.flipX,
    emote: player.emote
  };
}

function emitWorldState() {
  const playerSnapshot = Object.values(players).map((player) => serializePlayer(player));
  io.emit('world:state', {
    players: playerSnapshot,
    ball: {
      x: ball.x,
      y: ball.y,
      vx: ball.vx,
      vy: ball.vy,
      radius: ball.radius
    },
    scores: {
      left: scores.left,
      right: scores.right
    }
  });
}

io.on('connection', (socket) => {
  socket.on('player:join', (payload = {}) => {
    players[socket.id] = {
      id: socket.id,
      name: sanitizeName(payload.name),
      dogType: sanitizeDogType(payload.dogType),
      x: SPAWN_X,
      y: SPAWN_Y,
      animation: 'stand',
      flipX: false,
      vx: 0,
      vy: 0,
      lastInputAt: Date.now()
    };
  });

  socket.on('player:input', (payload = {}) => {
    const player = players[socket.id];
    if (!player) {
      return;
    }

    const now = Date.now();
    const elapsedSeconds = clamp((now - (player.lastInputAt || now)) / 1000, 0.016, 0.2);

    const nextX = Number.isFinite(payload.x) ? payload.x : player.x;
    const nextY = Number.isFinite(payload.y) ? payload.y : player.y;

    const rawVx = (nextX - player.x) / elapsedSeconds;
    const rawVy = (nextY - player.y) / elapsedSeconds;
    const clampedVelocity = clampVectorMagnitude(rawVx, rawVy, 480);

    if (Number.isFinite(payload.x)) {
      player.x = nextX;
    }
    if (Number.isFinite(payload.y)) {
      player.y = nextY;
    }

    player.vx = clampedVelocity.vx;
    player.vy = clampedVelocity.vy;
    player.lastInputAt = now;

    if (typeof payload.animation === 'string') {
      player.animation = payload.animation;
    }
    if (typeof payload.flipX === 'boolean') {
      player.flipX = payload.flipX;
    }
  });

  socket.on('player:emote', (emote) => {
    const player = players[socket.id];
    if (!player) {
      return;
    }

    if (typeof emote === 'string' && emote.length > 0 && emote.length <= 8) {
      player.emote = emote;
    }
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
  });
});

setInterval(() => {
  simulateBall(TICK_SECONDS);
  handleGoalScoring();

  emitWorldState();

  Object.values(players).forEach((player) => {
    if (player.emote) {
      delete player.emote;
    }
  });
}, TICK_RATE_MS);

loadIslandMask();

server.listen(PORT, () => {
  console.log(`Flynn Island multiplayer server running on port ${PORT}`);
});
