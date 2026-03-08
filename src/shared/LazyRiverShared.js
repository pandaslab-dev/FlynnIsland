(function initFlynnLazyRiverShared(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  root.FlynnLazyRiverShared = api;
}(
  typeof globalThis !== 'undefined' ? globalThis : this,
  function createFlynnLazyRiverShared() {
    const TAU = Math.PI * 2;

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function wrapProgress(progress) {
      let nextProgress = Number.isFinite(progress) ? progress : 0;

      nextProgress %= 1;
      if (nextProgress < 0) {
        nextProgress += 1;
      }

      return nextProgress;
    }

    function normalizeAngle(angle) {
      let nextAngle = Number.isFinite(angle) ? angle : 0;

      while (nextAngle > Math.PI) {
        nextAngle -= TAU;
      }

      while (nextAngle <= -Math.PI) {
        nextAngle += TAU;
      }

      return nextAngle;
    }

    function rotateOffset(localX, localY, angle) {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      return {
        x: (localX * cos) - (localY * sin),
        y: (localX * sin) + (localY * cos)
      };
    }

    function isPointInsideWorldBounds(x, y, worldBounds) {
      if (!worldBounds) {
        return true;
      }

      return (
        x >= worldBounds.x &&
        y >= worldBounds.y &&
        x < (worldBounds.x + worldBounds.width) &&
        y < (worldBounds.y + worldBounds.height)
      );
    }

    function getTubeCollisionRadius(config = {}, definition = {}) {
      if (Number.isFinite(definition.display?.collisionRadius)) {
        return definition.display.collisionRadius;
      }

      if (Number.isFinite(config.display?.collisionRadius)) {
        return config.display.collisionRadius;
      }

      const textureWidth = Number.isFinite(definition.textureWidth) ? definition.textureWidth : 492;
      const scale = Number.isFinite(definition.display?.scale)
        ? definition.display.scale
        : Number.isFinite(config.display?.scale)
          ? config.display.scale
          : 0.27;
      return Math.max(40, Math.round((textureWidth * scale) * 0.43));
    }

    function getTubeProbePoints(worldX, worldY, config = {}, definition = {}) {
      const radius = getTubeCollisionRadius(config, definition);
      const displayConfig = config.display || {};
      const definitionDisplay = definition.display || {};
      const shorelinePadding = Number.isFinite(definitionDisplay.shorePadding)
        ? definitionDisplay.shorePadding
        : Number.isFinite(displayConfig.shorePadding)
          ? displayConfig.shorePadding
          : 18;
      const probePointCount = Math.max(
        8,
        Math.round(
          Number.isFinite(definitionDisplay.probePointCount)
            ? definitionDisplay.probePointCount
            : Number.isFinite(displayConfig.probePointCount)
              ? displayConfig.probePointCount
              : 16
        )
      );
      const outerRadius = radius + Math.max(shorelinePadding, 0);
      const middleRadius = Math.max(radius * 0.78, radius - 8);
      const innerRadius = Math.max(radius * 0.48, 16);
      const points = [
        { x: worldX, y: worldY }
      ];

      for (let index = 0; index < probePointCount; index += 1) {
        const angle = (index / probePointCount) * TAU;
        points.push({
          x: worldX + (Math.cos(angle) * outerRadius),
          y: worldY + (Math.sin(angle) * outerRadius)
        });
      }

      const middleProbeCount = Math.max(6, Math.round(probePointCount / 2));
      for (let index = 0; index < middleProbeCount; index += 1) {
        const angle = ((index + 0.5) / middleProbeCount) * TAU;
        points.push({
          x: worldX + (Math.cos(angle) * middleRadius),
          y: worldY + (Math.sin(angle) * middleRadius)
        });
      }

      points.push(
        { x: worldX + innerRadius, y: worldY },
        { x: worldX - innerRadius, y: worldY },
        { x: worldX, y: worldY + innerRadius },
        { x: worldX, y: worldY - innerRadius }
      );

      return points;
    }

    function canTubeOccupy(worldX, worldY, config = {}, definition = {}, sampleAllowedPoint, options = {}) {
      if (typeof sampleAllowedPoint !== 'function') {
        return false;
      }

      const probePoints = getTubeProbePoints(worldX, worldY, config, definition);
      const allowOutsideWorld = options.allowOutsideWorld !== false;
      const worldBounds = options.worldBounds || null;

      for (const point of probePoints) {
        if (allowOutsideWorld && worldBounds && !isPointInsideWorldBounds(point.x, point.y, worldBounds)) {
          continue;
        }

        if (!sampleAllowedPoint(point.x, point.y)) {
          return false;
        }
      }

      return true;
    }

    function catmullRomPoint(p0, p1, p2, p3, t) {
      const t2 = t * t;
      const t3 = t2 * t;

      return {
        x: 0.5 * (
          (2 * p1.x) +
          ((-p0.x + p2.x) * t) +
          (((2 * p0.x) - (5 * p1.x) + (4 * p2.x) - p3.x) * t2) +
          (((-p0.x) + (3 * p1.x) - (3 * p2.x) + p3.x) * t3)
        ),
        y: 0.5 * (
          (2 * p1.y) +
          ((-p0.y + p2.y) * t) +
          (((2 * p0.y) - (5 * p1.y) + (4 * p2.y) - p3.y) * t2) +
          (((-p0.y) + (3 * p1.y) - (3 * p2.y) + p3.y) * t3)
        )
      };
    }

    function buildSmoothedWaypoints(waypoints = [], pathConfig = {}) {
      if (waypoints.length < 3) {
        return waypoints.slice();
      }

      const samplesPerSegment = Math.max(
        1,
        Math.round(
          Number.isFinite(pathConfig?.curveSamplesPerSegment)
            ? pathConfig.curveSamplesPerSegment
            : 1
        )
      );

      if (samplesPerSegment <= 1) {
        return waypoints.slice();
      }

      const smoothedPoints = [];
      for (let index = 0; index < waypoints.length; index += 1) {
        const p0 = waypoints[(index - 1 + waypoints.length) % waypoints.length];
        const p1 = waypoints[index];
        const p2 = waypoints[(index + 1) % waypoints.length];
        const p3 = waypoints[(index + 2) % waypoints.length];

        for (let sampleIndex = 0; sampleIndex < samplesPerSegment; sampleIndex += 1) {
          const t = sampleIndex / samplesPerSegment;
          const point = catmullRomPoint(p0, p1, p2, p3, t);

          if (!smoothedPoints.length) {
            smoothedPoints.push(point);
            continue;
          }

          const previousPoint = smoothedPoints[smoothedPoints.length - 1];
          if (Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y) >= 0.5) {
            smoothedPoints.push(point);
          }
        }
      }

      return smoothedPoints.length >= 3 ? smoothedPoints : waypoints.slice();
    }

    function buildPathMetrics(rawWaypoints = [], pathConfig = {}) {
      const waypoints = Array.isArray(rawWaypoints)
        ? rawWaypoints
          .filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y))
          .map((point) => ({ x: point.x, y: point.y }))
        : [];
      const sampledWaypoints = buildSmoothedWaypoints(waypoints, pathConfig);

      if (sampledWaypoints.length < 2) {
        return {
          points: sampledWaypoints,
          segments: [],
          totalLength: 0
        };
      }

      const segments = [];
      let totalLength = 0;

      for (let index = 0; index < sampledWaypoints.length; index += 1) {
        const start = sampledWaypoints[index];
        const end = sampledWaypoints[(index + 1) % sampledWaypoints.length];
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.hypot(dx, dy);

        if (length <= 0.0001) {
          continue;
        }

        segments.push({
          index,
          start,
          end,
          length,
          dx,
          dy,
          angle: Math.atan2(dy, dx),
          startLength: totalLength,
          endLength: totalLength + length
        });
        totalLength += length;
      }

      return {
        points: sampledWaypoints,
        segments,
        totalLength
      };
    }

    function samplePath(pathMetrics, progress = 0) {
      const totalLength = pathMetrics?.totalLength || 0;
      const segments = Array.isArray(pathMetrics?.segments) ? pathMetrics.segments : [];

      if (!segments.length || totalLength <= 0) {
        const fallbackPoint = pathMetrics?.points?.[0] || { x: 0, y: 0 };
        return {
          x: fallbackPoint.x,
          y: fallbackPoint.y,
          angle: 0,
          tangentX: 1,
          tangentY: 0,
          segmentIndex: 0
        };
      }

      const wrappedProgress = wrapProgress(progress);
      const targetDistance = wrappedProgress * totalLength;
      let segment = segments[segments.length - 1];

      for (let index = 0; index < segments.length; index += 1) {
        if (targetDistance <= segments[index].endLength) {
          segment = segments[index];
          break;
        }
      }

      const distanceOnSegment = clamp(
        targetDistance - segment.startLength,
        0,
        segment.length
      );
      const t = segment.length > 0 ? distanceOnSegment / segment.length : 0;
      const tangentX = segment.dx / segment.length;
      const tangentY = segment.dy / segment.length;

      return {
        x: segment.start.x + (segment.dx * t),
        y: segment.start.y + (segment.dy * t),
        angle: segment.angle,
        tangentX,
        tangentY,
        segmentIndex: segment.index
      };
    }

    function findNearestAllowedPoint(startX, startY, maxRadius = 120, radiusStep = 6, canOccupy) {
      if (typeof canOccupy !== 'function') {
        return null;
      }

      if (canOccupy(startX, startY)) {
        return { x: startX, y: startY };
      }

      const angleStep = Math.PI / 10;
      for (let radius = radiusStep; radius <= maxRadius; radius += radiusStep) {
        for (let angle = 0; angle < TAU; angle += angleStep) {
          const candidateX = startX + (Math.cos(angle) * radius);
          const candidateY = startY + (Math.sin(angle) * radius);

          if (canOccupy(candidateX, candidateY)) {
            return {
              x: candidateX,
              y: candidateY
            };
          }
        }
      }

      return null;
    }

    function findNearestTubePosition(
      startX,
      startY,
      config = {},
      definition = {},
      sampleAllowedPoint,
      options = {}
    ) {
      const maxRadius = Number.isFinite(options.maxRadius) ? options.maxRadius : 120;
      const radiusStep = Number.isFinite(options.radiusStep) ? options.radiusStep : 6;

      if (canTubeOccupy(startX, startY, config, definition, sampleAllowedPoint, options)) {
        return { x: startX, y: startY };
      }

      const angleStep = Math.PI / 10;
      for (let radius = radiusStep; radius <= maxRadius; radius += radiusStep) {
        for (let angle = 0; angle < TAU; angle += angleStep) {
          const candidateX = startX + (Math.cos(angle) * radius);
          const candidateY = startY + (Math.sin(angle) * radius);

          if (canTubeOccupy(candidateX, candidateY, config, definition, sampleAllowedPoint, options)) {
            return {
              x: candidateX,
              y: candidateY
            };
          }
        }
      }

      return null;
    }

    function resolvePathWaypoints(rawWaypoints = [], canOccupy, options = {}) {
      if (typeof canOccupy !== 'function') {
        return Array.isArray(rawWaypoints) ? rawWaypoints.slice() : [];
      }

      const maxRadius = Number.isFinite(options.maxRadius) ? options.maxRadius : 120;
      const radiusStep = Number.isFinite(options.radiusStep) ? options.radiusStep : 6;

      return (Array.isArray(rawWaypoints) ? rawWaypoints : [])
        .filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y))
        .map((point) => {
          const resolvedPoint = findNearestAllowedPoint(point.x, point.y, maxRadius, radiusStep, canOccupy);
          return resolvedPoint || { x: point.x, y: point.y };
        });
    }

    function computeTubePose(progress, pathMetrics, config = {}, definition = {}) {
      const sample = samplePath(pathMetrics, progress);
      const displayConfig = config.display || {};
      const wobbleAngle = Number.isFinite(definition.wobbleAngle)
        ? definition.wobbleAngle
        : (displayConfig.wobbleAngle || 0);
      const wobbleCycles = Number.isFinite(definition.wobbleCycles)
        ? definition.wobbleCycles
        : (displayConfig.wobbleCycles || 0);
      const wobblePhase = Number.isFinite(definition.wobblePhase) ? definition.wobblePhase : 0;
      const pathRotationInfluence = clamp(
        Number.isFinite(definition.pathRotationInfluence)
          ? definition.pathRotationInfluence
          : (displayConfig.pathRotationInfluence ?? 0.22),
        0,
        1
      );
      const limitedPathAngle = clamp(sample.angle, -Math.PI / 2, Math.PI / 2);
      const wobble = Math.sin((wrapProgress(progress) * TAU * wobbleCycles) + wobblePhase) * wobbleAngle;

      return {
        x: sample.x,
        y: sample.y,
        angle: normalizeAngle((limitedPathAngle * pathRotationInfluence) + wobble),
        tangentAngle: sample.angle,
        tangentX: sample.tangentX,
        tangentY: sample.tangentY
      };
    }

    function computeTubeSeatPose(tubePose, config = {}, definition = {}) {
      const riderConfig = definition.seat || config.rider || {};
      const offset = rotateOffset(
        Number.isFinite(riderConfig.offsetX) ? riderConfig.offsetX : 0,
        Number.isFinite(riderConfig.offsetY) ? riderConfig.offsetY : 0,
        tubePose?.angle || 0
      );

      return {
        x: (tubePose?.x || 0) + offset.x,
        y: (tubePose?.y || 0) + offset.y,
        scale: Number.isFinite(riderConfig.scale) ? riderConfig.scale : 0.12,
        originX: Number.isFinite(riderConfig.originX) ? riderConfig.originX : 0.5,
        originY: Number.isFinite(riderConfig.originY) ? riderConfig.originY : 0.92,
        cropTopRatio: clamp(
          Number.isFinite(riderConfig.cropTopRatio) ? riderConfig.cropTopRatio : 0,
          0,
          0.9
        ),
        cropBottomRatio: clamp(
          Number.isFinite(riderConfig.cropBottomRatio) ? riderConfig.cropBottomRatio : 0,
          0,
          0.9
        ),
        rotation: normalizeAngle((tubePose?.angle || 0) * (riderConfig.rotationInfluence ?? 0.35))
      };
    }

    function createTubeState(definition, pathMetrics, config = {}) {
      const progress = wrapProgress(definition?.spawnProgress || 0);
      const pose = computeTubePose(progress, pathMetrics, config, definition);

      return {
        id: definition?.id || 'tube',
        progress,
        x: pose.x,
        y: pose.y,
        angle: pose.angle,
        tangentAngle: pose.tangentAngle,
        occupantId: null
      };
    }

    function stepTube(tubeState, dtSeconds, pathMetrics, config = {}, definition = {}) {
      if (!tubeState) {
        return null;
      }

      const totalLength = pathMetrics?.totalLength || 0;
      const speed = Number.isFinite(definition.speed)
        ? definition.speed
        : Number.isFinite(config.physics?.speed)
          ? config.physics.speed
          : 80;
      const progressDelta = totalLength > 0
        ? ((speed * Math.max(dtSeconds, 0)) / totalLength)
        : 0;

      tubeState.progress = wrapProgress((tubeState.progress || 0) + progressDelta);
      const pose = computeTubePose(tubeState.progress, pathMetrics, config, definition);

      tubeState.x = pose.x;
      tubeState.y = pose.y;
      tubeState.angle = pose.angle;
      tubeState.tangentAngle = pose.tangentAngle;
      return tubeState;
    }

    return {
      buildPathMetrics,
      canTubeOccupy,
      computeTubePose,
      computeTubeSeatPose,
      createTubeState,
      findNearestAllowedPoint,
      findNearestTubePosition,
      buildSmoothedWaypoints,
      getTubeCollisionRadius,
      getTubeProbePoints,
      isPointInsideWorldBounds,
      normalizeAngle,
      resolvePathWaypoints,
      rotateOffset,
      samplePath,
      stepTube,
      wrapProgress
    };
  }
));
