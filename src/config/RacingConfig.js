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
            angle: Math.PI
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
            exitDistance: 184,
            sideExitDistance: 84
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
            angle: Math.PI
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
            exitDistance: 184,
            sideExitDistance: 84
          }),
          trails: Object.freeze({
            rearOffsetX: -62,
            laneOffsetY: 20
          })
        })
      ]),
      physics: Object.freeze({
        acceleration: 1320,
        reverseAcceleration: 620,
        boostAcceleration: 1680,
        maxSpeed: 620,
        boostMaxSpeed: 820,
        reverseMaxSpeed: 260,
        drag: 1.2,
        coastDrag: 1.8,
        coastDeceleration: 1320,
        lateralGrip: 8.4,
        spinOutGrip: 1.6,
        steeringRate: 2.75,
        reverseTurnMultiplier: 0.72,
        directionalTurnSpeed: 8.2,
        directionalTurnResponsiveness: 16,
        angularDamping: 8.5,
        spinOutAngularDamping: 0.95,
        steeringAngularImpulse: 4.2,
        maxStepDistance: 14,
        wallResolveStep: 7,
        wallResolveAttempts: 18,
        wallBounce: 0.12,
        wallVelocityDamping: 0.58,
        wallSpinFactor: 0.0015,
        wallSpinOutThreshold: 999999,
        wallSpinOutDurationMs: 0,
        carBounce: 0.72,
        carSpinFactor: 0.002,
        carSpinOutThreshold: 999999,
        carSpinOutDurationMs: 0,
        trailLifetimeMs: 2600,
        trailMinDistance: 12,
        trailMinSpeed: 180,
        trailTurnThreshold: 0.38,
        trailAlpha: 0.4,
        trailWidth: 2
      })
    });
  }
));
