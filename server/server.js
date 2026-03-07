const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { PNG } = require('pngjs');
const { Server } = require('socket.io');

const worldConfig = require(path.resolve(__dirname, '..', 'src', 'config', 'IslandWorldConfig.js'));

const PORT = Number(process.env.PORT) || 3000;
const TICK_RATE_MS = 50;

const WORLD_BOUNDS = worldConfig.worldBounds || {
  x: 0,
  y: 0,
  width: 4096,
  height: 4096
};
const SPAWN_POINT = worldConfig.spawn || {
  x: WORLD_BOUNDS.width / 2,
  y: WORLD_BOUNDS.height / 2
};
const COLLISION_MASK_CONFIG = worldConfig.collisionMask || {
  imagePath: 'misc_assets/island-4096-edge.png',
  offsetX: 0,
  offsetY: 0,
  blockedColorThreshold: 12
};

const WORLD_WIDTH = WORLD_BOUNDS.width;
const WORLD_HEIGHT = WORLD_BOUNDS.height;
const SPAWN_X = SPAWN_POINT.x;
const SPAWN_Y = SPAWN_POINT.y;
const PLAYER_COLLISION_RADIUS = 18;
const PLAYER_COLLISION_OFFSET_Y = 72;
const PLAYER_TORSO_COLLISION_RADIUS = 22;
const PLAYER_TORSO_COLLISION_OFFSET_Y = 38;
const COLLISION_SWEEP_STEP = 4;
const MAX_PLAYER_SPEED = 480;
const MASK_OFFSET_X = Number.isFinite(COLLISION_MASK_CONFIG.offsetX) ? COLLISION_MASK_CONFIG.offsetX : 0;
const MASK_OFFSET_Y = Number.isFinite(COLLISION_MASK_CONFIG.offsetY) ? COLLISION_MASK_CONFIG.offsetY : 0;
const BLOCKED_COLOR_THRESHOLD = Number.isFinite(COLLISION_MASK_CONFIG.blockedColorThreshold)
  ? COLLISION_MASK_CONFIG.blockedColorThreshold
  : 12;
const ISLAND_MASK_PATH = path.resolve(__dirname, '..', COLLISION_MASK_CONFIG.imagePath);
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
const ALLOWED_ANIMATIONS = new Set(['stand', 'walk', 'run', 'jump']);

const players = {};

let islandMask = null;
let hasWarnedMissingIslandMask = false;

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

    if (relativePath === 'misc_assets/island-4096.png' || relativePath === 'misc_assets/island-4096-edge.png') {
      res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
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

function sanitizeAnimation(animation) {
  if (typeof animation !== 'string') {
    return 'stand';
  }

  return ALLOWED_ANIMATIONS.has(animation) ? animation : 'stand';
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
    hasWarnedMissingIslandMask = false;
  } catch (error) {
    islandMask = null;
    console.warn(`Island mask load failed at ${ISLAND_MASK_PATH}; movement will be blocked until mask loads.`);
  }
}

function isBlockedAtWorldPoint(worldX, worldY) {
  if (!islandMask) {
    if (!hasWarnedMissingIslandMask) {
      console.warn('Island collision mask is unavailable on server; movement is blocked until mask loads.');
      hasWarnedMissingIslandMask = true;
    }
    return true;
  }

  const pixelX = Math.floor(worldX + MASK_OFFSET_X);
  const pixelY = Math.floor(worldY + MASK_OFFSET_Y);

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

  return r < BLOCKED_COLOR_THRESHOLD && g < BLOCKED_COLOR_THRESHOLD && b < BLOCKED_COLOR_THRESHOLD;
}

function canPlayerOccupy(worldX, worldY) {
  const points = [
    ...buildCollisionProbeRing(worldX, worldY + PLAYER_COLLISION_OFFSET_Y, PLAYER_COLLISION_RADIUS),
    ...buildCollisionProbeRing(worldX, worldY + PLAYER_TORSO_COLLISION_OFFSET_Y, PLAYER_TORSO_COLLISION_RADIUS)
  ];

  for (const point of points) {
    if (isBlockedAtWorldPoint(point.x, point.y)) {
      return false;
    }
  }

  return true;
}

function buildCollisionProbeRing(originX, originY, radius) {
  const diagonalRadius = radius * 0.78;
  const innerRadius = radius * 0.5;

  return [
    { x: originX, y: originY },
    { x: originX + radius, y: originY },
    { x: originX - radius, y: originY },
    { x: originX, y: originY + radius },
    { x: originX, y: originY - radius },
    { x: originX + diagonalRadius, y: originY + diagonalRadius },
    { x: originX - diagonalRadius, y: originY + diagonalRadius },
    { x: originX + diagonalRadius, y: originY - diagonalRadius },
    { x: originX - diagonalRadius, y: originY - diagonalRadius },
    { x: originX + innerRadius, y: originY },
    { x: originX - innerRadius, y: originY },
    { x: originX, y: originY + innerRadius },
    { x: originX, y: originY - innerRadius }
  ];
}

function sweepToWalkablePosition(startX, startY, targetX, targetY, stepSize = COLLISION_SWEEP_STEP) {
  const deltaX = targetX - startX;
  const deltaY = targetY - startY;
  const distance = Math.sqrt((deltaX * deltaX) + (deltaY * deltaY));
  const steps = Math.max(1, Math.ceil(distance / Math.max(stepSize, 1)));

  let lastWalkableX = startX;
  let lastWalkableY = startY;

  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const sampleX = startX + (deltaX * t);
    const sampleY = startY + (deltaY * t);

    if (!canPlayerOccupy(sampleX, sampleY)) {
      break;
    }

    lastWalkableX = sampleX;
    lastWalkableY = sampleY;
  }

  return {
    x: lastWalkableX,
    y: lastWalkableY
  };
}

function findNearestWalkablePosition(startX, startY, maxRadius = 220, radiusStep = 8) {
  if (canPlayerOccupy(startX, startY)) {
    return { x: startX, y: startY };
  }

  const angleStep = Math.PI / 8;
  for (let radius = radiusStep; radius <= maxRadius; radius += radiusStep) {
    for (let angle = 0; angle < (Math.PI * 2); angle += angleStep) {
      const candidateX = startX + (Math.cos(angle) * radius);
      const candidateY = startY + (Math.sin(angle) * radius);

      if (canPlayerOccupy(candidateX, candidateY)) {
        return { x: candidateX, y: candidateY };
      }
    }
  }

  return null;
}

function resolveSpawnPoint() {
  const clampedX = clamp(SPAWN_X, WORLD_BOUNDS.x, (WORLD_BOUNDS.x + WORLD_WIDTH) - 1);
  const clampedY = clamp(SPAWN_Y, WORLD_BOUNDS.y, (WORLD_BOUNDS.y + WORLD_HEIGHT) - 1);

  return findNearestWalkablePosition(clampedX, clampedY) || {
    x: clampedX,
    y: clampedY
  };
}

function resolvePlayerPosition(currentX, currentY, requestedX, requestedY) {
  const clampedX = clamp(requestedX, WORLD_BOUNDS.x, (WORLD_BOUNDS.x + WORLD_WIDTH) - 1);
  const clampedY = clamp(requestedY, WORLD_BOUNDS.y, (WORLD_BOUNDS.y + WORLD_HEIGHT) - 1);

  const resolvedX = sweepToWalkablePosition(currentX, currentY, clampedX, currentY);
  const resolvedY = sweepToWalkablePosition(resolvedX.x, currentY, resolvedX.x, clampedY);
  const nextX = resolvedY.x;
  const nextY = resolvedY.y;

  if (canPlayerOccupy(nextX, nextY)) {
    return {
      x: nextX,
      y: nextY
    };
  }

  const nearest = findNearestWalkablePosition(nextX, nextY, 96, 4);
  if (nearest) {
    return nearest;
  }

  return {
    x: currentX,
    y: currentY
  };
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
    players: playerSnapshot
  });
}

io.on('connection', (socket) => {
  socket.on('player:join', (payload = {}) => {
    const spawnPoint = resolveSpawnPoint();

    players[socket.id] = {
      id: socket.id,
      name: sanitizeName(payload.name),
      dogType: sanitizeDogType(payload.dogType),
      x: spawnPoint.x,
      y: spawnPoint.y,
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
    const requestedX = Number.isFinite(payload.x) ? payload.x : player.x;
    const requestedY = Number.isFinite(payload.y) ? payload.y : player.y;
    const resolvedPosition = resolvePlayerPosition(player.x, player.y, requestedX, requestedY);

    const rawVx = (resolvedPosition.x - player.x) / elapsedSeconds;
    const rawVy = (resolvedPosition.y - player.y) / elapsedSeconds;
    const clampedVelocity = clampVectorMagnitude(rawVx, rawVy, MAX_PLAYER_SPEED);

    player.x = resolvedPosition.x;
    player.y = resolvedPosition.y;
    player.vx = clampedVelocity.vx;
    player.vy = clampedVelocity.vy;
    player.lastInputAt = now;

    player.animation = sanitizeAnimation(payload.animation);

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
  emitWorldState();

  Object.values(players).forEach((player) => {
    if (player.emote) {
      delete player.emote;
    }
  });
}, TICK_RATE_MS);

loadIslandMask();
fs.watchFile(ISLAND_MASK_PATH, { interval: 1000 }, (current, previous) => {
  if (current.mtimeMs === previous.mtimeMs) {
    return;
  }

  loadIslandMask();
  console.log('Reloaded island collision mask.');
});

server.listen(PORT, () => {
  console.log(`Flynn Island multiplayer server running on port ${PORT}`);
});
