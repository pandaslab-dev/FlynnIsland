(function initFlynnLazyRiverConfig(root, factory) {
  const config = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = config;
  }

  root.FlynnLazyRiverConfig = config;
}(
  typeof globalThis !== 'undefined' ? globalThis : this,
  function createFlynnLazyRiverConfig() {
    const assetVersion = typeof window !== 'undefined' && window.FlynnAssetVersion
      ? String(window.FlynnAssetVersion)
      : 'dev';
    const withAssetVersion = (assetPath) => `${assetPath}?v=${encodeURIComponent(assetVersion)}`;

    return Object.freeze({
      mask: Object.freeze({
        textureKey: 'lazy_river_mask',
        imagePath: 'misc_assets/river.png',
        requestPath: withAssetVersion('misc_assets/river.png'),
        offsetX: 0,
        offsetY: 0,
        blockedColorThreshold: 12
      }),
      tubes: Object.freeze([
        Object.freeze({
          id: 'tube-1',
          textureKey: 'lazy_river_tube_1',
          imagePath: 'misc_assets/tube1.png',
          requestPath: withAssetVersion('misc_assets/tube1.png'),
          spawnProgress: 0
        }),
        Object.freeze({
          id: 'tube-2',
          textureKey: 'lazy_river_tube_2',
          imagePath: 'misc_assets/tube2.png',
          requestPath: withAssetVersion('misc_assets/tube2.png'),
          spawnProgress: 0.065
        }),
        Object.freeze({
          id: 'tube-3',
          textureKey: 'lazy_river_tube_3',
          imagePath: 'misc_assets/tube3.png',
          requestPath: withAssetVersion('misc_assets/tube3.png'),
          spawnProgress: 0.13
        }),
        Object.freeze({
          id: 'tube-4',
          textureKey: 'lazy_river_tube_4',
          imagePath: 'misc_assets/tube4.png',
          requestPath: withAssetVersion('misc_assets/tube4.png'),
          spawnProgress: 0.195
        })
      ]),
      display: Object.freeze({
        scale: 0.27,
        depthOffset: 18,
        shadowOffsetY: 24,
        shadowWidth: 136,
        shadowHeight: 40,
        shadowAlpha: 0.18,
        pathRotationInfluence: 0.16,
        wobbleAngle: 0.06,
        wobbleCycles: 7,
        collisionRadius: 60,
        shorePadding: 20,
        probePointCount: 18
      }),
      rider: Object.freeze({
        offsetX: 0,
        offsetY: -16,
        scale: 0.128,
        originX: 0.5,
        originY: 0.9,
        cropTopRatio: 0,
        cropBottomRatio: 0,
        rotationInfluence: 0.35
      }),
      occlusionZones: Object.freeze([
        Object.freeze({
          type: 'ellipse',
          x: 2000,
          y: 1490,
          radiusX: 212,
          radiusY: 94
        })
      ]),
      interaction: Object.freeze({
        boardRadius: 164,
        exitSearchRadius: 240,
        exitSearchStep: 8,
        promptRadius: 184
      }),
      physics: Object.freeze({
        speed: 84,
        constraintSearchRadius: 220,
        constraintSearchStep: 6
      }),
      path: Object.freeze({
        waypointSnapRadius: 220,
        waypointSnapStep: 6,
        curveSamplesPerSegment: 10,
        waypoints: Object.freeze([
          Object.freeze({ x: 244, y: 1412 }),
          Object.freeze({ x: 768, y: 1330 }),
          Object.freeze({ x: 1472, y: 1350 }),
          Object.freeze({ x: 2210, y: 1460 }),
          Object.freeze({ x: 3116, y: 1602 }),
          Object.freeze({ x: 3840, y: 1690 }),
          Object.freeze({ x: 4084, y: 2088 }),
          Object.freeze({ x: 4122, y: 2728 }),
          Object.freeze({ x: 4042, y: 3398 }),
          Object.freeze({ x: 3654, y: 3898 }),
          Object.freeze({ x: 2876, y: 4028 }),
          Object.freeze({ x: 2018, y: 4044 }),
          Object.freeze({ x: 1170, y: 4004 }),
          Object.freeze({ x: 402, y: 3928 }),
          Object.freeze({ x: -94, y: 3684 }),
          Object.freeze({ x: -118, y: 3312 }),
          Object.freeze({ x: -54, y: 2884 }),
          Object.freeze({ x: 6, y: 2448 }),
          Object.freeze({ x: 34, y: 1986 }),
          Object.freeze({ x: 168, y: 1486 })
        ])
      })
    });
  }
));
