(function initFlynnFetchShared(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  root.FlynnFetchShared = api;
}(
  typeof globalThis !== 'undefined' ? globalThis : this,
  function createFlynnFetchShared() {
    const FALLBACK_FETCH_CONFIG = Object.freeze({
      ball: Object.freeze({
        id: 'island-tennis-ball',
        textureKey: 'tennisball',
        imagePath: 'misc_assets/tennisball.png',
        requestPath: 'misc_assets/tennisball.png',
        displayScale: 0.0225,
        hudScale: 0.0135,
        radius: 22,
        holdOffsetX: 48,
        holdOffsetY: -6,
        dropOffsetY: 12
      }),
      interaction: Object.freeze({
        pickupRadius: 112,
        promptRadius: 112
      }),
      spawn: Object.freeze({
        attempts: 84,
        margin: 40,
        minDistanceFromSpawn: 150,
        anchorRadius: 280,
        searchRadius: 240,
        searchStep: 10
      }),
      physics: Object.freeze({
        throwSpeed: 760,
        rollingDrag: 340,
        maxSpeed: 920,
        minSpeed: 6,
        wallBounce: 0.74,
        carBounce: 0.88,
        playerBounce: 0.54,
        carVelocityTransfer: 0.18,
        playerVelocityTransfer: 0.08,
        nudgeImpulse: 210,
        nudgeSpeedThreshold: 32,
        nudgeSpeedFactor: 0.12,
        playerCollisionRadius: 34,
        playerCollisionOffsetY: 34,
        carCollisionPadding: 10,
        sweepStep: 8,
        maxStepDistance: 14,
        pickupCooldownMs: 180
      }),
      throwDirections: Object.freeze([
        Object.freeze({ id: 'up', label: 'Up', emoji: '⬆️', x: 0, y: -1 }),
        Object.freeze({ id: 'right', label: 'Right', emoji: '➡️', x: 1, y: 0 }),
        Object.freeze({ id: 'down', label: 'Down', emoji: '⬇️', x: 0, y: 1 }),
        Object.freeze({ id: 'left', label: 'Left', emoji: '⬅️', x: -1, y: 0 })
      ])
    });

    function getConfig(config) {
      if (config?.ball && config?.physics) {
        return config;
      }

      if (typeof globalThis !== 'undefined' && globalThis.FlynnFetchConfig) {
        return globalThis.FlynnFetchConfig;
      }

      return FALLBACK_FETCH_CONFIG;
    }

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function getDistanceSq(x1, y1, x2, y2) {
      const dx = x1 - x2;
      const dy = y1 - y2;
      return (dx * dx) + (dy * dy);
    }

    function normalizeVector(x, y, fallbackX = 1, fallbackY = 0) {
      const length = Math.hypot(x, y);
      if (length > 0.00001) {
        return {
          x: x / length,
          y: y / length,
          length
        };
      }

      const fallbackLength = Math.hypot(fallbackX, fallbackY) || 1;
      return {
        x: fallbackX / fallbackLength,
        y: fallbackY / fallbackLength,
        length: 0
      };
    }

    function buildBallProbePoints(worldX, worldY, radius) {
      const diagonalRadius = radius * 0.78;
      const innerRadius = radius * 0.5;

      return [
        { x: worldX, y: worldY },
        { x: worldX + radius, y: worldY },
        { x: worldX - radius, y: worldY },
        { x: worldX, y: worldY + radius },
        { x: worldX, y: worldY - radius },
        { x: worldX + diagonalRadius, y: worldY + diagonalRadius },
        { x: worldX - diagonalRadius, y: worldY + diagonalRadius },
        { x: worldX + diagonalRadius, y: worldY - diagonalRadius },
        { x: worldX - diagonalRadius, y: worldY - diagonalRadius },
        { x: worldX + innerRadius, y: worldY },
        { x: worldX - innerRadius, y: worldY },
        { x: worldX, y: worldY + innerRadius },
        { x: worldX, y: worldY - innerRadius }
      ];
    }

    function canBallOccupyPosition(worldX, worldY, isBlockedAtWorldPoint, config) {
      if (typeof isBlockedAtWorldPoint !== 'function') {
        return true;
      }

      const resolvedConfig = getConfig(config);
      const radius = resolvedConfig.ball.radius || 22;
      const points = buildBallProbePoints(worldX, worldY, radius);

      for (const point of points) {
        if (isBlockedAtWorldPoint(point.x, point.y)) {
          return false;
        }
      }

      return true;
    }

    function findNearestOpenPosition(startX, startY, canOccupy, maxRadius = 220, radiusStep = 8) {
      if (typeof canOccupy !== 'function') {
        return { x: startX, y: startY };
      }

      if (canOccupy(startX, startY)) {
        return { x: startX, y: startY };
      }

      const angleStep = Math.PI / 8;
      for (let radius = radiusStep; radius <= maxRadius; radius += radiusStep) {
        for (let angle = 0; angle < (Math.PI * 2); angle += angleStep) {
          const candidateX = startX + (Math.cos(angle) * radius);
          const candidateY = startY + (Math.sin(angle) * radius);

          if (canOccupy(candidateX, candidateY)) {
            return { x: candidateX, y: candidateY };
          }
        }
      }

      return null;
    }

    function findNearestBallPosition(startX, startY, isBlockedAtWorldPoint, config, maxRadius, radiusStep) {
      const resolvedConfig = getConfig(config);
      return findNearestOpenPosition(
        startX,
        startY,
        (candidateX, candidateY) => canBallOccupyPosition(
          candidateX,
          candidateY,
          isBlockedAtWorldPoint,
          resolvedConfig
        ),
        maxRadius ?? resolvedConfig.spawn.searchRadius,
        radiusStep ?? resolvedConfig.spawn.searchStep
      );
    }

    function passesAvoidPoints(candidateX, candidateY, avoidPoints = []) {
      return avoidPoints.every((point) => {
        if (!point || !Number.isFinite(point.minDistance)) {
          return true;
        }

        return getDistanceSq(candidateX, candidateY, point.x || 0, point.y || 0)
          >= (point.minDistance * point.minDistance);
      });
    }

    function findBallSpawnPosition(options = {}) {
      const resolvedConfig = getConfig(options.config);
      const worldBounds = options.worldBounds || {
        x: 0,
        y: 0,
        width: 4096,
        height: 4096
      };
      const canOccupy = typeof options.canOccupy === 'function'
        ? options.canOccupy
        : () => true;
      const randomFn = typeof options.randomFn === 'function' ? options.randomFn : Math.random;
      const margin = (resolvedConfig.spawn.margin || 40) + (resolvedConfig.ball.radius || 22);
      const minX = worldBounds.x + margin;
      const maxX = (worldBounds.x + worldBounds.width) - margin;
      const minY = worldBounds.y + margin;
      const maxY = (worldBounds.y + worldBounds.height) - margin;
      const avoidPoints = Array.isArray(options.avoidPoints) ? options.avoidPoints : [];
      const anchorPoint = options.anchorPoint || null;
      const anchorRadius = Number.isFinite(options.anchorRadius)
        ? options.anchorRadius
        : (resolvedConfig.spawn.anchorRadius || 280);
      const anchorMinRadius = Number.isFinite(options.anchorMinRadius)
        ? Math.max(0, options.anchorMinRadius)
        : Math.max(0, resolvedConfig.spawn.minDistanceFromSpawn || 0);

      if (anchorPoint) {
        for (let attempt = 0; attempt < (resolvedConfig.spawn.attempts || 84); attempt += 1) {
          const angle = randomFn() * Math.PI * 2;
          const radius = anchorMinRadius + ((anchorRadius - anchorMinRadius) * randomFn());
          const candidateX = clamp(anchorPoint.x + (Math.cos(angle) * radius), minX, maxX);
          const candidateY = clamp(anchorPoint.y + (Math.sin(angle) * radius), minY, maxY);

          if (!passesAvoidPoints(candidateX, candidateY, avoidPoints)) {
            continue;
          }

          if (canOccupy(candidateX, candidateY)) {
            return { x: candidateX, y: candidateY };
          }
        }
      }

      for (let attempt = 0; attempt < (resolvedConfig.spawn.attempts || 84); attempt += 1) {
        const candidateX = minX + ((maxX - minX) * randomFn());
        const candidateY = minY + ((maxY - minY) * randomFn());

        if (!passesAvoidPoints(candidateX, candidateY, avoidPoints)) {
          continue;
        }

        if (canOccupy(candidateX, candidateY)) {
          return { x: candidateX, y: candidateY };
        }
      }

      const fallbackAnchors = [
        options.fallbackPoint,
        avoidPoints[0],
        {
          x: worldBounds.x + (worldBounds.width / 2),
          y: worldBounds.y + (worldBounds.height / 2)
        }
      ].filter(Boolean);

      for (const anchor of fallbackAnchors) {
        const nearest = findNearestOpenPosition(
          anchor.x,
          anchor.y,
          (candidateX, candidateY) => {
            return passesAvoidPoints(candidateX, candidateY, avoidPoints)
              && canOccupy(candidateX, candidateY);
          },
          resolvedConfig.spawn.searchRadius,
          resolvedConfig.spawn.searchStep
        );

        if (nearest) {
          return nearest;
        }
      }

      return {
        x: clamp(worldBounds.x + (worldBounds.width / 2), minX, maxX),
        y: clamp(worldBounds.y + (worldBounds.height / 2), minY, maxY)
      };
    }

    function createBallState(spawnPoint, config) {
      const resolvedConfig = getConfig(config);

      return {
        id: resolvedConfig.ball.id,
        x: spawnPoint?.x ?? 0,
        y: spawnPoint?.y ?? 0,
        vx: 0,
        vy: 0,
        radius: resolvedConfig.ball.radius || 22,
        holderId: null,
        pickupEnabledAt: 0,
        lastThrowerId: null,
        lastThrowerName: null,
        lastThrowSourceType: null,
        lastThrownAt: 0
      };
    }

    function clampBallToWorld(ball, worldBounds) {
      if (!ball || !worldBounds) {
        return;
      }

      const radius = ball.radius || 0;
      ball.x = clamp(ball.x, worldBounds.x + radius, (worldBounds.x + worldBounds.width) - radius);
      ball.y = clamp(ball.y, worldBounds.y + radius, (worldBounds.y + worldBounds.height) - radius);
    }

    function limitBallSpeed(ball, config) {
      if (!ball) {
        return;
      }

      const resolvedConfig = getConfig(config);
      const maxSpeed = resolvedConfig.physics.maxSpeed || 920;
      const speed = Math.hypot(ball.vx || 0, ball.vy || 0);

      if (speed <= maxSpeed || speed <= 0.0001) {
        return;
      }

      const factor = maxSpeed / speed;
      ball.vx *= factor;
      ball.vy *= factor;
    }

    function applyBallImpulse(ball, impulseX, impulseY, config) {
      if (!ball) {
        return;
      }

      ball.vx = (ball.vx || 0) + impulseX;
      ball.vy = (ball.vy || 0) + impulseY;
      limitBallSpeed(ball, config);
    }

    function setBallVelocityFromDirection(ball, directionX, directionY, speed, config) {
      if (!ball) {
        return;
      }

      const resolvedConfig = getConfig(config);
      const normalized = normalizeVector(directionX, directionY);
      const nextSpeed = Number.isFinite(speed) ? speed : (resolvedConfig.physics.throwSpeed || 760);

      ball.vx = normalized.x * nextSpeed;
      ball.vy = normalized.y * nextSpeed;
      limitBallSpeed(ball, resolvedConfig);
    }

    function getHeldBallPosition(holder, config) {
      const resolvedConfig = getConfig(config);
      const direction = holder?.flipX ? -1 : 1;

      return {
        x: (holder?.x || 0) + (direction * (resolvedConfig.ball.holdOffsetX || 48)),
        y: (holder?.y || 0) + (resolvedConfig.ball.holdOffsetY || 0)
      };
    }

    function getPlayerBallColliderPosition(player, config) {
      const resolvedConfig = getConfig(config);

      return {
        x: player?.x || 0,
        y: (player?.y || 0) + (resolvedConfig.physics.playerCollisionOffsetY || 34)
      };
    }

    function isBallPickableByPlayer(ball, player, now, config) {
      if (!ball || !player || ball.holderId || player.carId || player.heldBallId) {
        return false;
      }

      if (Number.isFinite(ball.pickupEnabledAt) && now < ball.pickupEnabledAt) {
        return false;
      }

      const resolvedConfig = getConfig(config);
      const pickupRadius = resolvedConfig.interaction.pickupRadius || 88;

      return getDistanceSq(ball.x, ball.y, player.x || 0, player.y || 0) <= (pickupRadius * pickupRadius);
    }

    function placeBallAtHolder(ball, holder, config) {
      if (!ball || !holder) {
        return ball;
      }

      const position = getHeldBallPosition(holder, config);
      ball.x = position.x;
      ball.y = position.y;
      ball.vx = 0;
      ball.vy = 0;
      return ball;
    }

    function releaseBallFromHolder(ball, holder, now, options = {}, config) {
      if (!ball) {
        return ball;
      }

      const resolvedConfig = getConfig(config);
      const releaseMode = options.mode === 'throw' ? 'throw' : 'drop';
      const releasePosition = getHeldBallPosition(holder, resolvedConfig);

      ball.holderId = null;
      ball.x = releasePosition.x;
      ball.y = releasePosition.y + (resolvedConfig.ball.dropOffsetY || 0);
      ball.pickupEnabledAt = now + (resolvedConfig.physics.pickupCooldownMs || 180);

      if (releaseMode === 'throw') {
        setBallVelocityFromDirection(
          ball,
          options.directionX,
          options.directionY,
          options.speed ?? resolvedConfig.physics.throwSpeed,
          resolvedConfig
        );
        ball.vx += (holder?.vx || 0) * 0.25;
        ball.vy += (holder?.vy || 0) * 0.25;
        ball.lastThrowerId = holder?.id || null;
        ball.lastThrowerName = holder?.name || 'Player';
        ball.lastThrowSourceType = holder?.heldBallSourceType === 'bounce' ? 'bounce' : 'fetch';
        ball.lastThrownAt = now;
      } else {
        ball.vx = (holder?.vx || 0) * 0.08;
        ball.vy = (holder?.vy || 0) * 0.08;
        ball.lastThrowerId = null;
        ball.lastThrowerName = null;
        ball.lastThrowSourceType = null;
        ball.lastThrownAt = 0;
      }

      limitBallSpeed(ball, resolvedConfig);
      return ball;
    }

    function sweepBallAxis(ball, axis, nextValue, canOccupy, config) {
      const resolvedConfig = getConfig(config);
      const stepSize = Math.max(resolvedConfig.physics.sweepStep || 8, 1);
      const startValue = axis === 'x' ? ball.x : ball.y;
      const distance = nextValue - startValue;
      const steps = Math.max(1, Math.ceil(Math.abs(distance) / stepSize));
      let lastOpenValue = startValue;

      for (let index = 1; index <= steps; index += 1) {
        const candidateValue = startValue + (distance * (index / steps));
        const candidateX = axis === 'x' ? candidateValue : ball.x;
        const candidateY = axis === 'y' ? candidateValue : ball.y;

        if (!canOccupy(candidateX, candidateY)) {
          return {
            value: lastOpenValue,
            collided: true
          };
        }

        lastOpenValue = candidateValue;
      }

      return {
        value: lastOpenValue,
        collided: false
      };
    }

    function applyBallDrag(ball, dtSeconds, config) {
      if (!ball) {
        return;
      }

      const resolvedConfig = getConfig(config);
      const speed = Math.hypot(ball.vx || 0, ball.vy || 0);
      if (speed <= 0.0001) {
        ball.vx = 0;
        ball.vy = 0;
        return;
      }

      const nextSpeed = Math.max(0, speed - ((resolvedConfig.physics.rollingDrag || 340) * dtSeconds));
      if (nextSpeed <= (resolvedConfig.physics.minSpeed || 6)) {
        ball.vx = 0;
        ball.vy = 0;
        return;
      }

      const factor = nextSpeed / speed;
      ball.vx *= factor;
      ball.vy *= factor;
    }

    function resolveBallCircleCollision(ball, collider, options = {}, config) {
      if (!ball || !collider) {
        return null;
      }

      const resolvedConfig = getConfig(config);
      const colliderRadius = collider.radius || 0;
      const minDistance = (ball.radius || resolvedConfig.ball.radius || 22) + colliderRadius;
      const deltaX = ball.x - collider.x;
      const deltaY = ball.y - collider.y;
      const distanceSq = (deltaX * deltaX) + (deltaY * deltaY);

      if (distanceSq > (minDistance * minDistance)) {
        return null;
      }

      const distance = Math.sqrt(distanceSq);
      const normal = normalizeVector(deltaX, deltaY, 1, 0);
      const overlap = minDistance - distance;
      const colliderVx = collider.vx || 0;
      const colliderVy = collider.vy || 0;

      ball.x += normal.x * overlap;
      ball.y += normal.y * overlap;

      const relativeVx = (ball.vx || 0) - colliderVx;
      const relativeVy = (ball.vy || 0) - colliderVy;
      const speedAlongNormal = (relativeVx * normal.x) + (relativeVy * normal.y);

      if (speedAlongNormal < 0) {
        const bounce = Number.isFinite(options.bounce) ? options.bounce : 0.6;
        const impulse = -(1 + bounce) * speedAlongNormal;
        ball.vx += normal.x * impulse;
        ball.vy += normal.y * impulse;
      }

      const velocityTransfer = Number.isFinite(options.velocityTransfer) ? options.velocityTransfer : 0;
      ball.vx += colliderVx * velocityTransfer;
      ball.vy += colliderVy * velocityTransfer;
      limitBallSpeed(ball, resolvedConfig);

      return {
        normalX: normal.x,
        normalY: normal.y,
        overlap
      };
    }

    function advanceBall(ball, dtSeconds, options = {}) {
      const resolvedConfig = getConfig(options.config);
      if (!ball || ball.holderId) {
        return ball;
      }

      const canOccupy = typeof options.canOccupy === 'function' ? options.canOccupy : () => true;
      const onStep = typeof options.onStep === 'function' ? options.onStep : null;
      const worldBounds = options.worldBounds || null;
      const totalDistance = Math.hypot((ball.vx || 0) * dtSeconds, (ball.vy || 0) * dtSeconds);
      const maxStepDistance = Math.max(resolvedConfig.physics.maxStepDistance || 14, 1);
      const stepCount = Math.max(1, Math.ceil(totalDistance / maxStepDistance));
      const stepDt = dtSeconds / stepCount;

      for (let step = 0; step < stepCount; step += 1) {
        const nextX = ball.x + ((ball.vx || 0) * stepDt);
        const xResolution = sweepBallAxis(ball, 'x', nextX, canOccupy, resolvedConfig);
        ball.x = xResolution.value;
        if (xResolution.collided) {
          ball.vx = -(ball.vx || 0) * (resolvedConfig.physics.wallBounce || 0.74);
        }

        const nextY = ball.y + ((ball.vy || 0) * stepDt);
        const yResolution = sweepBallAxis(ball, 'y', nextY, canOccupy, resolvedConfig);
        ball.y = yResolution.value;
        if (yResolution.collided) {
          ball.vy = -(ball.vy || 0) * (resolvedConfig.physics.wallBounce || 0.74);
        }

        if (worldBounds) {
          clampBallToWorld(ball, worldBounds);
        }

        if (onStep) {
          onStep(ball, stepDt);
        }

        if (!canOccupy(ball.x, ball.y)) {
          const nearestOpenPosition = findNearestOpenPosition(
            ball.x,
            ball.y,
            canOccupy,
            resolvedConfig.spawn.searchRadius,
            resolvedConfig.spawn.searchStep
          );

          if (nearestOpenPosition) {
            ball.x = nearestOpenPosition.x;
            ball.y = nearestOpenPosition.y;
          }
        }
      }

      applyBallDrag(ball, dtSeconds, resolvedConfig);
      return ball;
    }

    return {
      clamp,
      getDistanceSq,
      normalizeVector,
      buildBallProbePoints,
      canBallOccupyPosition,
      findNearestOpenPosition,
      findNearestBallPosition,
      findBallSpawnPosition,
      createBallState,
      clampBallToWorld,
      limitBallSpeed,
      applyBallImpulse,
      setBallVelocityFromDirection,
      getHeldBallPosition,
      getPlayerBallColliderPosition,
      isBallPickableByPlayer,
      placeBallAtHolder,
      releaseBallFromHolder,
      resolveBallCircleCollision,
      advanceBall
    };
  }
));
