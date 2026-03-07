(function initFlynnRacingShared(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  root.FlynnRacingShared = api;
}(
  typeof globalThis !== 'undefined' ? globalThis : this,
  function createFlynnRacingShared() {
    const TAU = Math.PI * 2;

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function normalizeAngle(angle) {
      let nextAngle = angle;

      while (nextAngle > Math.PI) {
        nextAngle -= TAU;
      }

      while (nextAngle <= -Math.PI) {
        nextAngle += TAU;
      }

      return nextAngle;
    }

    function angleDelta(fromAngle, toAngle) {
      return normalizeAngle(toAngle - fromAngle);
    }

    function lerpAngle(fromAngle, toAngle, t) {
      return normalizeAngle(fromAngle + (angleDelta(fromAngle, toAngle) * t));
    }

    function rotateOffset(localX, localY, angle) {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      return {
        x: (localX * cos) - (localY * sin),
        y: (localX * sin) + (localY * cos)
      };
    }

    function getForwardVector(angle) {
      return {
        x: Math.cos(angle),
        y: Math.sin(angle)
      };
    }

    function getRightVector(angle) {
      return {
        x: -Math.sin(angle),
        y: Math.cos(angle)
      };
    }

    function getCarProbePoints(car, carDefinition) {
      const halfLength = carDefinition?.physics?.halfLength || 78;
      const halfWidth = carDefinition?.physics?.halfWidth || 28;
      const forwardInset = halfLength * 0.62;
      const sideInset = halfWidth * 0.58;

      return [
        localPointToWorld(car, 0, 0),
        localPointToWorld(car, halfLength, 0),
        localPointToWorld(car, -halfLength, 0),
        localPointToWorld(car, forwardInset, halfWidth),
        localPointToWorld(car, forwardInset, -halfWidth),
        localPointToWorld(car, -forwardInset, halfWidth),
        localPointToWorld(car, -forwardInset, -halfWidth),
        localPointToWorld(car, 0, halfWidth),
        localPointToWorld(car, 0, -halfWidth),
        localPointToWorld(car, 0, sideInset),
        localPointToWorld(car, 0, -sideInset)
      ];
    }

    function localPointToWorld(car, localX, localY) {
      const rotated = rotateOffset(localX, localY, car.angle || 0);
      return {
        x: car.x + rotated.x,
        y: car.y + rotated.y
      };
    }

    function isCarDriveable(car, carDefinition, sampleDriveableAtWorldPoint) {
      if (typeof sampleDriveableAtWorldPoint !== 'function') {
        return false;
      }

      const probePoints = getCarProbePoints(car, carDefinition);
      for (const point of probePoints) {
        if (!sampleDriveableAtWorldPoint(point.x, point.y)) {
          return false;
        }
      }

      return true;
    }

    function sampleTrackCollision(car, carDefinition, sampleDriveableAtWorldPoint) {
      const probePoints = getCarProbePoints(car, carDefinition);
      const blockedPoints = [];

      for (const point of probePoints) {
        if (!sampleDriveableAtWorldPoint(point.x, point.y)) {
          blockedPoints.push(point);
        }
      }

      if (blockedPoints.length === 0) {
        return null;
      }

      let normalX = 0;
      let normalY = 0;

      blockedPoints.forEach((point) => {
        const offsetX = car.x - point.x;
        const offsetY = car.y - point.y;
        const length = Math.hypot(offsetX, offsetY) || 1;

        normalX += offsetX / length;
        normalY += offsetY / length;
      });

      const normalLength = Math.hypot(normalX, normalY) || 1;

      return {
        blockedPoints,
        normal: {
          x: normalX / normalLength,
          y: normalY / normalLength
        }
      };
    }

    function findNearestDriveablePosition(
      startX,
      startY,
      angle,
      carDefinition,
      maxRadius,
      radiusStep,
      sampleDriveableAtWorldPoint
    ) {
      const initialCar = {
        x: startX,
        y: startY,
        angle
      };

      if (isCarDriveable(initialCar, carDefinition, sampleDriveableAtWorldPoint)) {
        return {
          x: startX,
          y: startY
        };
      }

      const angleStep = Math.PI / 8;
      for (let radius = radiusStep; radius <= maxRadius; radius += radiusStep) {
        for (let theta = 0; theta < TAU; theta += angleStep) {
          const candidateX = startX + (Math.cos(theta) * radius);
          const candidateY = startY + (Math.sin(theta) * radius);
          const candidateCar = {
            x: candidateX,
            y: candidateY,
            angle
          };

          if (isCarDriveable(candidateCar, carDefinition, sampleDriveableAtWorldPoint)) {
            return {
              x: candidateX,
              y: candidateY
            };
          }
        }
      }

      return null;
    }

    function resolveTrackCollision(
      car,
      previousX,
      previousY,
      carDefinition,
      racingConfig,
      sampleDriveableAtWorldPoint
    ) {
      const collision = sampleTrackCollision(car, carDefinition, sampleDriveableAtWorldPoint);
      if (!collision) {
        return null;
      }

      const physics = racingConfig.physics || {};
      const resolveStep = physics.wallResolveStep || 7;
      const resolveAttempts = physics.wallResolveAttempts || 18;
      const normal = collision.normal;

      let candidateX = car.x;
      let candidateY = car.y;
      for (let attempt = 0; attempt < resolveAttempts; attempt += 1) {
        candidateX += normal.x * resolveStep;
        candidateY += normal.y * resolveStep;

        if (isCarDriveable({
          x: candidateX,
          y: candidateY,
          angle: car.angle
        }, carDefinition, sampleDriveableAtWorldPoint)) {
          car.x = candidateX;
          car.y = candidateY;
          return {
            hitWall: true,
            normal
          };
        }
      }

      if (Number.isFinite(previousX) && Number.isFinite(previousY)) {
        if (isCarDriveable({
          x: previousX,
          y: previousY,
          angle: car.angle
        }, carDefinition, sampleDriveableAtWorldPoint)) {
          car.x = previousX;
          car.y = previousY;
          return {
            hitWall: true,
            normal
          };
        }

        const nearby = findNearestDriveablePosition(
          previousX,
          previousY,
          car.angle,
          carDefinition,
          96,
          6,
          sampleDriveableAtWorldPoint
        );

        if (nearby) {
          car.x = nearby.x;
          car.y = nearby.y;
          return {
            hitWall: true,
            normal
          };
        }
      }

      car.x = previousX;
      car.y = previousY;

      return {
        hitWall: true,
        normal
      };
    }

    function stepCar(car, inputState, dtSeconds, racingConfig, carDefinition, sampleDriveableAtWorldPoint) {
      const physics = racingConfig.physics || {};
      const throttle = clamp(Number.isFinite(inputState?.throttle) ? inputState.throttle : 0, -1, 1);
      const steer = clamp(Number.isFinite(inputState?.steer) ? inputState.steer : 0, -1, 1);
      const boost = Boolean(inputState?.boost) && throttle > 0.25;

      if (!Number.isFinite(car.x)) {
        car.x = carDefinition.spawn?.x || 0;
      }
      if (!Number.isFinite(car.y)) {
        car.y = carDefinition.spawn?.y || 0;
      }
      if (!Number.isFinite(car.angle)) {
        car.angle = carDefinition.spawn?.angle || 0;
      }
      if (!Number.isFinite(car.vx)) {
        car.vx = 0;
      }
      if (!Number.isFinite(car.vy)) {
        car.vy = 0;
      }
      if (!Number.isFinite(car.angularVelocity)) {
        car.angularVelocity = 0;
      }
      if (!Number.isFinite(car.spinOutTimerMs)) {
        car.spinOutTimerMs = 0;
      }

      car.spinOutTimerMs = Math.max(0, car.spinOutTimerMs - (dtSeconds * 1000));

      const oldForward = getForwardVector(car.angle);
      const oldRight = getRightVector(car.angle);

      let forwardSpeed = (car.vx * oldForward.x) + (car.vy * oldForward.y);
      let lateralSpeed = (car.vx * oldRight.x) + (car.vy * oldRight.y);
      const normalizedSpeed = clamp(Math.abs(forwardSpeed) / Math.max(physics.maxSpeed || 1, 1), 0, 1);

      if (car.spinOutTimerMs > 0) {
        car.angle = normalizeAngle(car.angle + (car.angularVelocity * dtSeconds));
      } else {
        let turnDirection = 1;
        if (forwardSpeed < -18) {
          turnDirection = -(physics.reverseTurnMultiplier || 0.72);
        }

        const turnStrength = clamp(0.18 + normalizedSpeed, 0.18, 1);
        const steeringRate = physics.steeringRate || 2.5;
        car.angle = normalizeAngle(
          car.angle + (steer * steeringRate * turnStrength * turnDirection * dtSeconds)
        );
        car.angularVelocity += steer * (physics.steeringAngularImpulse || 3.4) * turnStrength * dtSeconds;
      }

      if (throttle > 0) {
        forwardSpeed += throttle * (boost ? (physics.boostAcceleration || 920) : (physics.acceleration || 680)) * dtSeconds;
      } else if (throttle < 0) {
        forwardSpeed += throttle * (physics.reverseAcceleration || 420) * dtSeconds;
      }

      const topForwardSpeed = boost ? (physics.boostMaxSpeed || 720) : (physics.maxSpeed || 470);
      forwardSpeed = clamp(forwardSpeed, -(physics.reverseMaxSpeed || 190), topForwardSpeed);

      const drag = throttle === 0 ? (physics.coastDrag || 2.8) : (physics.drag || 1.8);
      forwardSpeed *= Math.max(0, 1 - (drag * dtSeconds));

      const lateralGrip = car.spinOutTimerMs > 0
        ? (physics.spinOutGrip || 1.6)
        : (physics.lateralGrip || 7.5);
      lateralSpeed *= Math.max(0, 1 - (lateralGrip * dtSeconds));

      const angularDamping = car.spinOutTimerMs > 0
        ? (physics.spinOutAngularDamping || 1.2)
        : (physics.angularDamping || 4.2);
      car.angularVelocity *= Math.max(0, 1 - (angularDamping * dtSeconds));

      const nextForward = getForwardVector(car.angle);
      const nextRight = getRightVector(car.angle);

      car.vx = (nextForward.x * forwardSpeed) + (nextRight.x * lateralSpeed);
      car.vy = (nextForward.y * forwardSpeed) + (nextRight.y * lateralSpeed);

      const speed = Math.hypot(car.vx, car.vy);
      const stepDistance = speed * dtSeconds;
      const substeps = Math.max(1, Math.ceil(stepDistance / Math.max(physics.maxStepDistance || 12, 1)));
      const stepDt = dtSeconds / substeps;
      const previousAngle = car.angle;

      let hitWall = false;
      for (let step = 0; step < substeps; step += 1) {
        const previousX = car.x;
        const previousY = car.y;

        car.x += car.vx * stepDt;
        car.y += car.vy * stepDt;

        const collision = resolveTrackCollision(
          car,
          previousX,
          previousY,
          carDefinition,
          racingConfig,
          sampleDriveableAtWorldPoint
        );

        if (!collision) {
          continue;
        }

        hitWall = true;

        const velocityDotNormal = (car.vx * collision.normal.x) + (car.vy * collision.normal.y);
        if (velocityDotNormal < 0) {
          const bounce = 1 + (physics.wallBounce || 0.46);
          car.vx -= bounce * velocityDotNormal * collision.normal.x;
          car.vy -= bounce * velocityDotNormal * collision.normal.y;
          car.vx *= physics.wallVelocityDamping || 0.84;
          car.vy *= physics.wallVelocityDamping || 0.84;

          const tangentialSpeed = (car.vx * -collision.normal.y) + (car.vy * collision.normal.x);
          car.angularVelocity += tangentialSpeed * (physics.wallSpinFactor || 0.008);

          if (Math.abs(velocityDotNormal) > (physics.wallSpinOutThreshold || 260)) {
            car.spinOutTimerMs = Math.max(car.spinOutTimerMs, physics.wallSpinOutDurationMs || 650);
          }
        }
      }

      car.speed = Math.hypot(car.vx, car.vy);
      car.isBoosting = boost && car.spinOutTimerMs <= 0;
      car.isSpinningOut = car.spinOutTimerMs > 0;
      car.turnRate = angleDelta(previousAngle, car.angle) / Math.max(dtSeconds, 0.0001);

      return {
        hitWall,
        speed: car.speed
      };
    }

    function resolveCarCollisionPair(carA, carB, racingConfig, carDefA, carDefB) {
      const radiusA = carDefA?.physics?.collisionRadius || 54;
      const radiusB = carDefB?.physics?.collisionRadius || 54;
      const dx = carB.x - carA.x;
      const dy = carB.y - carA.y;
      const distance = Math.hypot(dx, dy);
      const minimumDistance = radiusA + radiusB;

      if (!Number.isFinite(distance) || distance >= minimumDistance) {
        return false;
      }

      const physics = racingConfig.physics || {};
      const safeDistance = distance || 0.0001;
      const normalX = dx / safeDistance;
      const normalY = dy / safeDistance;
      const overlap = minimumDistance - safeDistance;

      carA.x -= normalX * (overlap * 0.5);
      carA.y -= normalY * (overlap * 0.5);
      carB.x += normalX * (overlap * 0.5);
      carB.y += normalY * (overlap * 0.5);

      const relativeVx = carB.vx - carA.vx;
      const relativeVy = carB.vy - carA.vy;
      const separatingVelocity = (relativeVx * normalX) + (relativeVy * normalY);

      if (separatingVelocity >= 0) {
        return true;
      }

      const bounce = -(1 + (physics.carBounce || 0.92)) * separatingVelocity * 0.5;
      carA.vx -= bounce * normalX;
      carA.vy -= bounce * normalY;
      carB.vx += bounce * normalX;
      carB.vy += bounce * normalY;

      const tangentX = -normalY;
      const tangentY = normalX;
      const tangentialVelocity = (relativeVx * tangentX) + (relativeVy * tangentY);
      const spinImpulse = tangentialVelocity * (physics.carSpinFactor || 0.011);

      carA.angularVelocity -= spinImpulse;
      carB.angularVelocity += spinImpulse;

      const impact = Math.abs(separatingVelocity);
      if (impact > (physics.carSpinOutThreshold || 300)) {
        const spinOutDurationMs = physics.carSpinOutDurationMs || 850;
        carA.spinOutTimerMs = Math.max(carA.spinOutTimerMs || 0, spinOutDurationMs);
        carB.spinOutTimerMs = Math.max(carB.spinOutTimerMs || 0, spinOutDurationMs);
      }

      return true;
    }

    function computeSeatPose(car, carDefinition) {
      const seat = carDefinition?.seat || {};
      const rotatedOffset = rotateOffset(seat.offsetX || 0, seat.offsetY || 0, car.angle || 0);

      return {
        x: car.x + rotatedOffset.x,
        y: car.y + rotatedOffset.y,
        rotation: car.angle || 0,
        scale: seat.scale || 0.122,
        originX: seat.originX ?? 0.5,
        originY: seat.originY ?? 0.95
      };
    }

    function computeTrailAnchors(car, carDefinition) {
      const trails = carDefinition?.trails || {};
      const rearOffsetX = trails.rearOffsetX || -48;
      const laneOffsetY = trails.laneOffsetY || 16;
      const leftOffset = rotateOffset(rearOffsetX, -laneOffsetY, car.angle || 0);
      const rightOffset = rotateOffset(rearOffsetX, laneOffsetY, car.angle || 0);

      return {
        left: {
          x: car.x + leftOffset.x,
          y: car.y + leftOffset.y
        },
        right: {
          x: car.x + rightOffset.x,
          y: car.y + rightOffset.y
        }
      };
    }

    return {
      clamp,
      normalizeAngle,
      angleDelta,
      lerpAngle,
      rotateOffset,
      getForwardVector,
      getRightVector,
      getCarProbePoints,
      isCarDriveable,
      findNearestDriveablePosition,
      stepCar,
      resolveCarCollisionPair,
      computeSeatPose,
      computeTrailAnchors
    };
  }
));
