(function initFlynnRacingConfig(root, factory) {
  const config = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = config;
  }

  root.FlynnRacingConfig = config;
}(
  typeof globalThis !== 'undefined' ? globalThis : this,
  function createFlynnRacingConfig() {
    const assetVersion = typeof window !== 'undefined' && window.FlynnAssetVersion
      ? String(window.FlynnAssetVersion)
      : 'dev';
    const withAssetVersion = (assetPath) => `${assetPath}?v=${encodeURIComponent(assetVersion)}`;

    return Object.freeze({
      trackMask: Object.freeze({
        imagePath: 'misc_assets/racing/racetrack-mask.png',
        blockedColorThreshold: 12
      }),
      cars: Object.freeze([
        Object.freeze({
          id: 'red',
          textureKey: 'racecar_red',
          imagePath: 'misc_assets/racing/racecar_red.png',
          requestPath: withAssetVersion('misc_assets/racing/racecar_red.png'),
          spawn: Object.freeze({
            x: 1490,
            y: 248,
            angle: 0
          }),
          display: Object.freeze({
            scale: 0.52,
            originX: 0.5,
            originY: 0.82
          }),
          seat: Object.freeze({
            offsetX: -30,
            offsetY: -18,
            scale: 0.136,
            originX: 0.5,
            originY: 0.95,
            flipX: true
          }),
          physics: Object.freeze({
            halfLength: 102,
            halfWidth: 38,
            collisionRadius: 70,
            entryRadius: 104,
            exitDistance: 148
          }),
          trails: Object.freeze({
            rearOffsetX: -62,
            laneOffsetY: 20
          })
        }),
        Object.freeze({
          id: 'blue',
          textureKey: 'racecar_blue',
          imagePath: 'misc_assets/racing/racecar_blue.png',
          requestPath: withAssetVersion('misc_assets/racing/racecar_blue.png'),
          spawn: Object.freeze({
            x: 1736,
            y: 262,
            angle: 0
          }),
          display: Object.freeze({
            scale: 0.52,
            originX: 0.5,
            originY: 0.82
          }),
          seat: Object.freeze({
            offsetX: -40,
            offsetY: -12,
            scale: 0.136,
            originX: 0.5,
            originY: 0.95,
            flipX: true
          }),
          physics: Object.freeze({
            halfLength: 102,
            halfWidth: 38,
            collisionRadius: 70,
            entryRadius: 104,
            exitDistance: 148
          }),
          trails: Object.freeze({
            rearOffsetX: -62,
            laneOffsetY: 20
          })
        })
      ]),
      physics: Object.freeze({
        acceleration: 840,
        reverseAcceleration: 520,
        boostAcceleration: 1160,
        maxSpeed: 560,
        boostMaxSpeed: 860,
        reverseMaxSpeed: 220,
        drag: 1.4,
        coastDrag: 2.1,
        lateralGrip: 6.6,
        spinOutGrip: 1.6,
        steeringRate: 2.75,
        reverseTurnMultiplier: 0.72,
        angularDamping: 3.6,
        spinOutAngularDamping: 0.95,
        steeringAngularImpulse: 4.2,
        maxStepDistance: 14,
        wallResolveStep: 7,
        wallResolveAttempts: 18,
        wallBounce: 0.6,
        wallVelocityDamping: 0.9,
        wallSpinFactor: 0.012,
        wallSpinOutThreshold: 220,
        wallSpinOutDurationMs: 760,
        carBounce: 0.98,
        carSpinFactor: 0.018,
        carSpinOutThreshold: 230,
        carSpinOutDurationMs: 980,
        trailLifetimeMs: 2600,
        trailMinDistance: 12,
        trailMinSpeed: 190,
        trailTurnThreshold: 0.38,
        trailAlpha: 0.4,
        trailWidth: 2
      })
    });
  }
));
