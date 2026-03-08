(function initFlynnFetchConfig(root, factory) {
  const config = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = config;
  }

  root.FlynnFetchConfig = config;
}(
  typeof globalThis !== 'undefined' ? globalThis : this,
  function createFlynnFetchConfig() {
    const assetVersion = typeof window !== 'undefined' && window.FlynnAssetVersion
      ? String(window.FlynnAssetVersion)
      : 'dev';
    const withAssetVersion = (assetPath) => `${assetPath}?v=${encodeURIComponent(assetVersion)}`;

    return Object.freeze({
      ball: Object.freeze({
        id: 'island-tennis-ball',
        textureKey: 'tennisball',
        imagePath: 'misc_assets/tennisball.png',
        requestPath: withAssetVersion('misc_assets/tennisball.png'),
        displayScale: 0.0225,
        hudScale: 0.0135,
        radius: 22,
        holdOffsetX: 48,
        holdOffsetY: -6,
        dropOffsetY: 12
      }),
      interaction: Object.freeze({
        pickupRadius: 88,
        promptRadius: 88
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
  }
));
