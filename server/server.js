const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { PNG } = require('pngjs');
const { Server } = require('socket.io');

const worldConfig = require(path.resolve(__dirname, '..', 'src', 'config', 'IslandWorldConfig.js'));
const racingConfig = require(path.resolve(__dirname, '..', 'src', 'config', 'RacingConfig.js'));
const fetchConfig = require(path.resolve(__dirname, '..', 'src', 'config', 'FetchConfig.js'));
const fetchShared = require(path.resolve(__dirname, '..', 'src', 'shared', 'FetchShared.js'));
const racingShared = require(path.resolve(__dirname, '..', 'src', 'shared', 'RacingShared.js'));

const PORT = Number(process.env.PORT) || 3000;
const TICK_RATE_MS = 33;

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
const RACE_TRACK_MASK_CONFIG = racingConfig.trackMask || {
  imagePath: 'misc_assets/racing/racetrack-mask.png',
  blockedColorThreshold: 12
};
const CAR_DEFINITIONS = Array.isArray(racingConfig.cars) ? racingConfig.cars : [];
const CAR_DEFINITION_MAP = new Map(CAR_DEFINITIONS.map((definition) => [definition.id, definition]));

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
const TRACK_DRIVEABLE_THRESHOLD = Number.isFinite(RACE_TRACK_MASK_CONFIG.blockedColorThreshold)
  ? RACE_TRACK_MASK_CONFIG.blockedColorThreshold
  : 12;
const ISLAND_MASK_PATH = path.resolve(__dirname, '..', COLLISION_MASK_CONFIG.imagePath);
const RACE_TRACK_MASK_PATH = path.resolve(__dirname, '..', RACE_TRACK_MASK_CONFIG.imagePath);
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
const ALLOWED_ANIMATIONS = new Set(['stand', 'walk', 'run', 'jump', 'sit']);

const players = {};
const cars = createInitialCars();
let fetchBall = null;
let uiMessageSequence = 0;

let islandMask = null;
let racetrackMask = null;
let hasWarnedMissingIslandMask = false;
let hasWarnedMissingTrackMask = false;

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

    if (
      relativePath === 'misc_assets/island-4096.png' ||
      relativePath === 'misc_assets/island-4096-edge.png' ||
      relativePath.startsWith('misc_assets/racing/')
    ) {
      res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
      return;
    }

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
    playerCount: Object.keys(players).length,
    occupiedCars: Object.values(cars).filter((car) => Boolean(car.occupantId)).length
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

function createInitialCars() {
  const carState = {};

  CAR_DEFINITIONS.forEach((definition) => {
    carState[definition.id] = {
      id: definition.id,
      x: definition.spawn?.x ?? 0,
      y: definition.spawn?.y ?? 0,
      angle: definition.spawn?.angle ?? 0,
      vx: 0,
      vy: 0,
      speed: 0,
      angularVelocity: 0,
      turnRate: 0,
      spinOutTimerMs: 0,
      occupantId: null,
      isBoosting: false,
      isSpinningOut: false
    };
  });

  return carState;
}

function loadPngMask(maskPath, missingWarning) {
  try {
    const buffer = fs.readFileSync(maskPath);
    const png = PNG.sync.read(buffer);

    return {
      width: png.width,
      height: png.height,
      data: png.data
    };
  } catch (error) {
    console.warn(missingWarning);
    return null;
  }
}

function loadIslandMask() {
  islandMask = loadPngMask(
    ISLAND_MASK_PATH,
    `Island mask load failed at ${ISLAND_MASK_PATH}; movement will be blocked until mask loads.`
  );
  hasWarnedMissingIslandMask = false;

  if (fetchBall && !fetchBall.holderId && !canBallOccupy(fetchBall.x, fetchBall.y)) {
    const nearestBallPosition = findNearestBallPosition(fetchBall.x, fetchBall.y, 160, 6);
    if (nearestBallPosition) {
      fetchBall.x = nearestBallPosition.x;
      fetchBall.y = nearestBallPosition.y;
      fetchBall.vx = 0;
      fetchBall.vy = 0;
    }
  }
}

function loadRacetrackMask() {
  racetrackMask = loadPngMask(
    RACE_TRACK_MASK_PATH,
    `Racetrack mask load failed at ${RACE_TRACK_MASK_PATH}; cars will be disabled until mask loads.`
  );
  hasWarnedMissingTrackMask = false;
  resetCarsToTrack();
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

function isDriveableTrackAtWorldPoint(worldX, worldY) {
  if (!racetrackMask) {
    if (!hasWarnedMissingTrackMask) {
      console.warn('Racetrack mask is unavailable on server; cars will remain parked until mask loads.');
      hasWarnedMissingTrackMask = true;
    }
    return false;
  }

  const pixelX = Math.floor(worldX);
  const pixelY = Math.floor(worldY);

  if (
    pixelX < 0 ||
    pixelY < 0 ||
    pixelX >= racetrackMask.width ||
    pixelY >= racetrackMask.height
  ) {
    return false;
  }

  const pixelIndex = ((pixelY * racetrackMask.width) + pixelX) * 4;
  const r = racetrackMask.data[pixelIndex];
  const g = racetrackMask.data[pixelIndex + 1];
  const b = racetrackMask.data[pixelIndex + 2];
  const a = racetrackMask.data[pixelIndex + 3];

  if (a === 0) {
    return false;
  }

  return r < TRACK_DRIVEABLE_THRESHOLD && g < TRACK_DRIVEABLE_THRESHOLD && b < TRACK_DRIVEABLE_THRESHOLD;
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

function canBallOccupy(worldX, worldY) {
  return fetchShared.canBallOccupyPosition(worldX, worldY, isBlockedAtWorldPoint, fetchConfig);
}

function findNearestBallPosition(startX, startY, maxRadius = 140, radiusStep = 6) {
  return fetchShared.findNearestBallPosition(
    startX,
    startY,
    isBlockedAtWorldPoint,
    fetchConfig,
    maxRadius,
    radiusStep
  );
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

function createInitialFetchBall() {
  const spawnPoint = fetchShared.findBallSpawnPosition({
    config: fetchConfig,
    worldBounds: WORLD_BOUNDS,
    canOccupy: (candidateX, candidateY) => canBallOccupy(candidateX, candidateY),
    anchorPoint: {
      x: SPAWN_X,
      y: SPAWN_Y
    },
    avoidPoints: [
      {
        x: SPAWN_X,
        y: SPAWN_Y,
        minDistance: fetchConfig.spawn.minDistanceFromSpawn
      }
    ],
    fallbackPoint: {
      x: SPAWN_X + 140,
      y: SPAWN_Y - 90
    }
  });

  return fetchShared.createBallState(spawnPoint, fetchConfig);
}

function emitUiMessage(text, durationMs = 2300) {
  if (!text) {
    return;
  }

  uiMessageSequence += 1;
  io.emit('ui:message', {
    id: `ui-${uiMessageSequence}`,
    text,
    durationMs
  });
}

function syncFetchBallOwnership(holderId) {
  Object.values(players).forEach((player) => {
    player.heldBallId = player.id === holderId ? fetchConfig.ball.id : null;
  });

  if (fetchBall) {
    fetchBall.holderId = holderId || null;
  }
}

function serializeFetchBall(ball) {
  if (!ball) {
    return null;
  }

  return {
    id: ball.id,
    x: ball.x,
    y: ball.y,
    vx: ball.vx,
    vy: ball.vy,
    radius: ball.radius,
    holderId: ball.holderId || null,
    pickupEnabledAt: ball.pickupEnabledAt || 0,
    lastThrowerId: ball.lastThrowerId || null,
    lastThrowerName: ball.lastThrowerName || null,
    lastThrownAt: ball.lastThrownAt || 0
  };
}

function releaseFetchBallHeldByPlayer(player, now, options = {}) {
  if (!player || !fetchBall || fetchBall.holderId !== player.id || player.heldBallId !== fetchConfig.ball.id) {
    return false;
  }

  fetchShared.releaseBallFromHolder(fetchBall, player, now, options, fetchConfig);

  const nearestBallPosition = findNearestBallPosition(fetchBall.x, fetchBall.y, 120, 6);
  if (nearestBallPosition) {
    fetchBall.x = nearestBallPosition.x;
    fetchBall.y = nearestBallPosition.y;
  }

  syncFetchBallOwnership(null);
  return true;
}

function pickupFetchBall(player, now) {
  if (!player || !fetchBall || !fetchShared.isBallPickableByPlayer(fetchBall, player, now, fetchConfig)) {
    return false;
  }

  const fetchedFromName = fetchBall.lastThrowerName;
  fetchBall.pickupEnabledAt = 0;
  fetchBall.lastThrownAt = 0;
  fetchShared.placeBallAtHolder(fetchBall, player, fetchConfig);
  syncFetchBallOwnership(player.id);

  if (fetchedFromName) {
    emitUiMessage(`${player.name} fetched a ball from ${fetchedFromName}!`);
  }

  fetchBall.lastThrowerId = null;
  fetchBall.lastThrowerName = null;
  return true;
}

function handleFetchAction(player, payload = {}, now) {
  if (!player || !fetchBall) {
    return false;
  }

  const actionType = typeof payload.type === 'string' ? payload.type : '';

  if (actionType === 'pickup') {
    return pickupFetchBall(player, now);
  }

  if (actionType === 'drop') {
    return releaseFetchBallHeldByPlayer(player, now, { mode: 'drop' });
  }

  if (actionType === 'throw') {
    const direction = fetchShared.normalizeVector(
      Number.isFinite(payload.directionX) ? payload.directionX : 0,
      Number.isFinite(payload.directionY) ? payload.directionY : 0,
      player.flipX ? -1 : 1,
      0
    );

    return releaseFetchBallHeldByPlayer(player, now, {
      mode: 'throw',
      directionX: direction.x,
      directionY: direction.y
    });
  }

  return false;
}

function resolveFetchBallPlayerCollision(ball, player) {
  if (!ball || !player || player.carId || ball.holderId === player.id) {
    return;
  }

  const colliderPosition = fetchShared.getPlayerBallColliderPosition(player, fetchConfig);
  const collision = fetchShared.resolveBallCircleCollision(
    ball,
    {
      x: colliderPosition.x,
      y: colliderPosition.y,
      radius: fetchConfig.physics.playerCollisionRadius,
      vx: player.vx || 0,
      vy: player.vy || 0
    },
    {
      bounce: fetchConfig.physics.playerBounce,
      velocityTransfer: fetchConfig.physics.playerVelocityTransfer
    },
    fetchConfig
  );

  if (!collision) {
    return;
  }

  const playerSpeed = Math.hypot(player.vx || 0, player.vy || 0);
  if (playerSpeed < fetchConfig.physics.nudgeSpeedThreshold) {
    return;
  }

  const pushDirection = fetchShared.normalizeVector(
    player.vx || 0,
    player.vy || 0,
    collision.normalX,
    collision.normalY
  );
  const impulse = fetchConfig.physics.nudgeImpulse
    + Math.min(playerSpeed * fetchConfig.physics.nudgeSpeedFactor, 120);

  fetchShared.applyBallImpulse(
    ball,
    pushDirection.x * impulse,
    pushDirection.y * impulse,
    fetchConfig
  );
}

function resolveFetchBallCarCollision(ball, car) {
  if (!ball || !car) {
    return;
  }

  const definition = getCarDefinition(car.id);
  if (!definition) {
    return;
  }

  fetchShared.resolveBallCircleCollision(
    ball,
    {
      x: car.x,
      y: car.y,
      radius: (definition.physics?.collisionRadius || 70) + fetchConfig.physics.carCollisionPadding,
      vx: car.vx || 0,
      vy: car.vy || 0
    },
    {
      bounce: fetchConfig.physics.carBounce,
      velocityTransfer: fetchConfig.physics.carVelocityTransfer
    },
    fetchConfig
  );
}

function updateFetchBall(dtSeconds, now) {
  if (!fetchBall) {
    return;
  }

  const holder = fetchBall.holderId ? players[fetchBall.holderId] : null;
  if (fetchBall.holderId && !holder) {
    fetchBall.holderId = null;
    fetchBall.pickupEnabledAt = now + fetchConfig.physics.pickupCooldownMs;
    syncFetchBallOwnership(null);
  }

  if (holder) {
    fetchShared.placeBallAtHolder(fetchBall, holder, fetchConfig);
    return;
  }

  fetchShared.advanceBall(fetchBall, dtSeconds, {
    config: fetchConfig,
    worldBounds: WORLD_BOUNDS,
    canOccupy: (candidateX, candidateY) => canBallOccupy(candidateX, candidateY),
    onStep: () => {
      Object.values(cars).forEach((car) => {
        resolveFetchBallCarCollision(fetchBall, car);
      });

      Object.values(players).forEach((player) => {
        resolveFetchBallPlayerCollision(fetchBall, player);
      });
    }
  });
}

function getCarDefinition(carId) {
  return CAR_DEFINITION_MAP.get(carId) || null;
}

function resetCarsToTrack() {
  Object.values(cars).forEach((car) => {
    const definition = getCarDefinition(car.id);
    if (!definition) {
      return;
    }

    car.x = definition.spawn?.x ?? car.x;
    car.y = definition.spawn?.y ?? car.y;
    car.angle = definition.spawn?.angle ?? car.angle;
    car.vx = 0;
    car.vy = 0;
    car.speed = 0;
    car.angularVelocity = 0;
    car.turnRate = 0;
    car.spinOutTimerMs = 0;
    car.isBoosting = false;
    car.isSpinningOut = false;

    const nearestTrackPosition = racingShared.findNearestDriveablePosition(
      car.x,
      car.y,
      car.angle,
      definition,
      180,
      8,
      isDriveableTrackAtWorldPoint
    );

    if (nearestTrackPosition) {
      car.x = nearestTrackPosition.x;
      car.y = nearestTrackPosition.y;
    }

    const occupant = car.occupantId ? players[car.occupantId] : null;
    if (occupant) {
      syncPlayerToCar(occupant, car);
    }
  });
}

function syncPlayerToCar(player, car) {
  const definition = getCarDefinition(car.id);
  if (!definition) {
    return;
  }

  const seatPose = racingShared.computeSeatPose(car, definition);
  player.x = seatPose.x;
  player.y = seatPose.y;
  player.vx = car.vx;
  player.vy = car.vy;
  player.animation = 'sit';
  player.flipX = false;
}

function tryBoardAvailableCar(player, now) {
  if (!player || player.carId || player.heldBallId || now < (player.reboardEnabledAt || 0)) {
    return false;
  }

  let bestCandidate = null;
  let bestDistanceSq = Number.POSITIVE_INFINITY;

  Object.values(cars).forEach((car) => {
    if (car.occupantId) {
      return;
    }

    if (
      player.lastExitedCarId &&
      car.id === player.lastExitedCarId &&
      now < (player.lastExitedCarUntil || 0)
    ) {
      return;
    }

    const definition = getCarDefinition(car.id);
    if (!definition) {
      return;
    }

    const entryRadius = definition.physics?.entryRadius || 84;
    const dx = player.x - car.x;
    const dy = player.y - car.y;
    const distanceSq = (dx * dx) + (dy * dy);

    if (distanceSq > (entryRadius * entryRadius) || distanceSq >= bestDistanceSq) {
      return;
    }

    bestCandidate = car;
    bestDistanceSq = distanceSq;
  });

  if (!bestCandidate) {
    return false;
  }

  player.carId = bestCandidate.id;
  player.animation = 'sit';
  player.flipX = false;
  player.carInput = {
    directionX: 0,
    directionY: 0,
    throttle: 0,
    steer: 0,
    boost: false
  };
  player.exitCarRequested = false;
  bestCandidate.occupantId = player.id;
  player.lastExitedCarId = null;
  player.lastExitedCarUntil = 0;
  player.exitWalkStartedAt = 0;
  player.exitWalkUntil = 0;
  player.exitWalkStartX = player.x;
  player.exitWalkStartY = player.y;
  player.exitWalkTargetX = player.x;
  player.exitWalkTargetY = player.y;
  syncPlayerToCar(player, bestCandidate);
  return true;
}

function resolveExitWalkTarget(exitPosition, preferredDirectionX, preferredDirectionY) {
  if (!exitPosition) {
    return null;
  }

  const length = Math.hypot(preferredDirectionX, preferredDirectionY) || 1;
  const directionX = preferredDirectionX / length;
  const directionY = preferredDirectionY / length;
  const walkDistance = 52;
  const desiredX = clamp(
    exitPosition.x + (directionX * walkDistance),
    WORLD_BOUNDS.x,
    (WORLD_BOUNDS.x + WORLD_WIDTH) - 1
  );
  const desiredY = clamp(
    exitPosition.y + (directionY * walkDistance),
    WORLD_BOUNDS.y,
    (WORLD_BOUNDS.y + WORLD_HEIGHT) - 1
  );

  return findNearestWalkablePosition(desiredX, desiredY, 72, 4) || exitPosition;
}

function releasePlayerFromCar(player, now) {
  if (!player || !player.carId) {
    return false;
  }

  const car = cars[player.carId];
  const previousCarId = player.carId;
  const definition = getCarDefinition(player.carId);
  if (!car || !definition) {
    player.carId = null;
    player.exitCarRequested = false;
    return false;
  }

  const forward = racingShared.getForwardVector(car.angle);
  const right = racingShared.getRightVector(car.angle);
  const exitDistance = definition.physics?.exitDistance || 120;
  const sideExitDistance = definition.physics?.sideExitDistance || 72;
  const candidateOffsets = [
    {
      x: (-forward.x * exitDistance) + (right.x * sideExitDistance),
      y: (-forward.y * exitDistance) + (right.y * sideExitDistance)
    },
    {
      x: (-forward.x * exitDistance) - (right.x * sideExitDistance),
      y: (-forward.y * exitDistance) - (right.y * sideExitDistance)
    },
    {
      x: right.x * (exitDistance + 18),
      y: right.y * (exitDistance + 18)
    },
    {
      x: -right.x * (exitDistance + 18),
      y: -right.y * (exitDistance + 18)
    },
    {
      x: -forward.x * (exitDistance * 1.15),
      y: -forward.y * (exitDistance * 1.15)
    }
  ];

  let exitPosition = null;
  let exitDirectionX = -forward.x;
  let exitDirectionY = -forward.y;
  for (const offset of candidateOffsets) {
    const candidateX = clamp(car.x + offset.x, WORLD_BOUNDS.x, (WORLD_BOUNDS.x + WORLD_WIDTH) - 1);
    const candidateY = clamp(car.y + offset.y, WORLD_BOUNDS.y, (WORLD_BOUNDS.y + WORLD_HEIGHT) - 1);
    const nearestWalkable = findNearestWalkablePosition(candidateX, candidateY, 120, 6);

    if (nearestWalkable) {
      exitPosition = nearestWalkable;
      exitDirectionX = nearestWalkable.x - car.x;
      exitDirectionY = nearestWalkable.y - car.y;
      break;
    }
  }

  const exitWalkTarget = resolveExitWalkTarget(exitPosition, exitDirectionX, exitDirectionY);

  car.occupantId = null;
  player.carId = null;
  player.exitCarRequested = false;
  player.carInput = {
    directionX: 0,
    directionY: 0,
    throttle: 0,
    steer: 0,
    boost: false
  };
  player.reboardEnabledAt = now + 1400;
  player.lastExitedCarId = previousCarId;
  player.lastExitedCarUntil = now + 2200;
  player.vx = 0;
  player.vy = 0;
  player.animation = 'walk';
  player.flipX = exitDirectionX < 0;

  if (exitPosition) {
    player.x = exitPosition.x;
    player.y = exitPosition.y;
  }

  player.exitWalkStartedAt = now;
  player.exitWalkUntil = now + 260;
  player.exitWalkStartX = player.x;
  player.exitWalkStartY = player.y;
  player.exitWalkTargetX = exitWalkTarget?.x ?? player.x;
  player.exitWalkTargetY = exitWalkTarget?.y ?? player.y;

  return true;
}

function sanitizeCarInput(payload = {}) {
  return {
    directionX: clamp(
      Number.isFinite(payload.carDirectionX)
        ? payload.carDirectionX
        : Number.isFinite(payload.moveX)
          ? payload.moveX
          : 0,
      -1,
      1
    ),
    directionY: clamp(
      Number.isFinite(payload.carDirectionY)
        ? payload.carDirectionY
        : Number.isFinite(payload.moveY)
          ? payload.moveY
          : 0,
      -1,
      1
    ),
    throttle: clamp(
      Number.isFinite(payload.carThrottle)
        ? payload.carThrottle
        : Number.isFinite(payload.moveY)
          ? payload.moveY
          : 0,
      -1,
      1
    ),
    steer: clamp(
      Number.isFinite(payload.carSteer)
        ? payload.carSteer
        : Number.isFinite(payload.moveX)
          ? payload.moveX
          : 0,
      -1,
      1
    ),
    boost: Boolean(payload.carBoost || payload.boost)
  };
}

function resolveCarBackOntoTrack(car) {
  const definition = getCarDefinition(car.id);
  if (!definition) {
    return;
  }

  if (racingShared.isCarDriveable(car, definition, isDriveableTrackAtWorldPoint)) {
    return;
  }

  const nearestTrackPosition = racingShared.findNearestDriveablePosition(
    car.x,
    car.y,
    car.angle,
    definition,
    120,
    6,
    isDriveableTrackAtWorldPoint
  );

  if (nearestTrackPosition) {
    car.x = nearestTrackPosition.x;
    car.y = nearestTrackPosition.y;
    return;
  }

  car.x = definition.spawn?.x ?? car.x;
  car.y = definition.spawn?.y ?? car.y;
  car.angle = definition.spawn?.angle ?? car.angle;
  car.vx = 0;
  car.vy = 0;
  car.speed = 0;
  car.angularVelocity = 0;
  car.turnRate = 0;
  car.spinOutTimerMs = 0;
}

function updateCars(dtSeconds, now) {
  Object.values(cars).forEach((car) => {
    const occupant = car.occupantId ? players[car.occupantId] : null;

    if (car.occupantId && !occupant) {
      car.occupantId = null;
    }

    if (occupant && occupant.exitCarRequested) {
      releasePlayerFromCar(occupant, now);
    }

    const driver = car.occupantId ? players[car.occupantId] : null;
    const definition = getCarDefinition(car.id);
    if (!definition) {
      return;
    }

    const inputState = driver?.carInput || {
      directionX: 0,
      directionY: 0,
      throttle: 0,
      steer: 0,
      boost: false
    };

    racingShared.stepCar(
      car,
      inputState,
      dtSeconds,
      racingConfig,
      definition,
      isDriveableTrackAtWorldPoint
    );
  });

  for (let index = 0; index < CAR_DEFINITIONS.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < CAR_DEFINITIONS.length; nextIndex += 1) {
      const firstCar = cars[CAR_DEFINITIONS[index].id];
      const secondCar = cars[CAR_DEFINITIONS[nextIndex].id];

      if (!firstCar || !secondCar) {
        continue;
      }

      const didCollide = racingShared.resolveCarCollisionPair(
        firstCar,
        secondCar,
        racingConfig,
        CAR_DEFINITIONS[index],
        CAR_DEFINITIONS[nextIndex]
      );

      if (!didCollide) {
        continue;
      }

      resolveCarBackOntoTrack(firstCar);
      resolveCarBackOntoTrack(secondCar);
    }
  }

  Object.values(cars).forEach((car) => {
    const occupant = car.occupantId ? players[car.occupantId] : null;
    if (occupant) {
      syncPlayerToCar(occupant, car);
    }
  });
}

function serializePlayer(player) {
  return {
    id: player.id,
    name: player.name,
    dogType: player.dogType,
    x: player.x,
    y: player.y,
    animation: player.carId ? 'sit' : player.animation,
    flipX: player.carId ? false : player.flipX,
    emote: player.emote,
    carId: player.carId || null,
    heldBallId: player.heldBallId || null
  };
}

function serializeCar(car) {
  return {
    id: car.id,
    x: car.x,
    y: car.y,
    angle: car.angle,
    vx: car.vx,
    vy: car.vy,
    speed: car.speed,
    turnRate: car.turnRate,
    occupantId: car.occupantId || null,
    isBoosting: Boolean(car.isBoosting),
    isSpinningOut: Boolean(car.isSpinningOut)
  };
}

function emitWorldState() {
  const playerSnapshot = Object.values(players).map((player) => serializePlayer(player));
  const carSnapshot = Object.values(cars).map((car) => serializeCar(car));

  io.emit('world:state', {
    players: playerSnapshot,
    cars: carSnapshot,
    fetch: {
      ball: serializeFetchBall(fetchBall)
    }
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
      heldBallId: null,
      vx: 0,
      vy: 0,
      lastInputAt: Date.now(),
      carId: null,
      carInput: {
        directionX: 0,
        directionY: 0,
        throttle: 0,
        steer: 0,
        boost: false
      },
      exitCarRequested: false,
      reboardEnabledAt: 0,
      lastExitedCarId: null,
      lastExitedCarUntil: 0,
      exitWalkStartedAt: 0,
      exitWalkUntil: 0,
      exitWalkStartX: spawnPoint.x,
      exitWalkStartY: spawnPoint.y,
      exitWalkTargetX: spawnPoint.x,
      exitWalkTargetY: spawnPoint.y
    };
  });

  socket.on('player:input', (payload = {}) => {
    const player = players[socket.id];
    if (!player) {
      return;
    }

    const now = Date.now();
    const previousInputAt = player.lastInputAt || now;
    player.lastInputAt = now;

    if (player.carId) {
      player.carInput = sanitizeCarInput(payload);
      if (payload.exitCar) {
        player.exitCarRequested = true;
      }
      player.animation = 'sit';
      player.flipX = false;
      return;
    }

    if (now < (player.exitWalkUntil || 0)) {
      const durationMs = Math.max((player.exitWalkUntil || now) - (player.exitWalkStartedAt || now), 1);
      const progress = clamp((now - (player.exitWalkStartedAt || now)) / durationMs, 0, 1);
      const nextX = player.exitWalkStartX + ((player.exitWalkTargetX - player.exitWalkStartX) * progress);
      const nextY = player.exitWalkStartY + ((player.exitWalkTargetY - player.exitWalkStartY) * progress);
      const elapsedSeconds = clamp((now - previousInputAt) / 1000, 0.016, 0.2) || 0.016;
      const rawVx = (nextX - player.x) / elapsedSeconds;
      const rawVy = (nextY - player.y) / elapsedSeconds;
      const clampedVelocity = clampVectorMagnitude(rawVx, rawVy, MAX_PLAYER_SPEED);

      player.x = nextX;
      player.y = nextY;
      player.vx = clampedVelocity.vx;
      player.vy = clampedVelocity.vy;
      player.animation = 'walk';
      player.flipX = (player.exitWalkTargetX - player.exitWalkStartX) < 0;
      player.carInput.throttle = 0;
      player.carInput.steer = 0;
      player.carInput.directionX = 0;
      player.carInput.directionY = 0;
      player.carInput.boost = false;
      return;
    }

    if (player.exitWalkUntil) {
      player.x = player.exitWalkTargetX;
      player.y = player.exitWalkTargetY;
      player.exitWalkStartedAt = 0;
      player.exitWalkUntil = 0;
    }

    const elapsedSeconds = clamp((now - previousInputAt) / 1000, 0.016, 0.2) || 0.016;
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
    player.animation = sanitizeAnimation(payload.animation);
    player.carInput.throttle = 0;
    player.carInput.steer = 0;
    player.carInput.directionX = 0;
    player.carInput.directionY = 0;
    player.carInput.boost = false;

    if (typeof payload.flipX === 'boolean') {
      player.flipX = payload.flipX;
    }

    tryBoardAvailableCar(player, now);
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

  socket.on('fetch:action', (payload = {}) => {
    const player = players[socket.id];
    if (!player) {
      return;
    }

    handleFetchAction(player, payload, Date.now());
  });

  socket.on('disconnect', () => {
    const player = players[socket.id];
    if (player?.carId && cars[player.carId]) {
      cars[player.carId].occupantId = null;
    }

    if (player?.heldBallId === fetchConfig.ball.id) {
      releaseFetchBallHeldByPlayer(player, Date.now(), { mode: 'drop' });
    }

    delete players[socket.id];
  });
});

setInterval(() => {
  const now = Date.now();
  const dtSeconds = TICK_RATE_MS / 1000;

  updateCars(dtSeconds, now);
  updateFetchBall(dtSeconds, now);

  Object.values(players).forEach((player) => {
    if (!player.carId) {
      tryBoardAvailableCar(player, now);
    }
  });

  emitWorldState();

  Object.values(players).forEach((player) => {
    if (player.emote) {
      delete player.emote;
    }
  });
}, TICK_RATE_MS);

loadIslandMask();
loadRacetrackMask();
fetchBall = createInitialFetchBall();

fs.watchFile(ISLAND_MASK_PATH, { interval: 1000 }, (current, previous) => {
  if (current.mtimeMs === previous.mtimeMs) {
    return;
  }

  loadIslandMask();
  console.log('Reloaded island collision mask.');
});

fs.watchFile(RACE_TRACK_MASK_PATH, { interval: 1000 }, (current, previous) => {
  if (current.mtimeMs === previous.mtimeMs) {
    return;
  }

  loadRacetrackMask();
  console.log('Reloaded racetrack collision mask.');
});

server.listen(PORT, () => {
  console.log(`Flynn Island multiplayer server running on port ${PORT}`);
});
