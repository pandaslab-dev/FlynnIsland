(function initFlynnIslandWorldConfig(root, factory) {
  const config = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = config;
  }

  root.FlynnIslandWorldConfig = config;
}(
  typeof globalThis !== 'undefined' ? globalThis : this,
  function createFlynnIslandWorldConfig() {
    const worldWidth = 4096;
    const worldHeight = 4096;
    const islandAssetPath = 'misc_assets/island-4096.png';
    const collisionMaskAssetPath = 'misc_assets/island-4096-edge.png';
    const assetVersion = typeof window !== 'undefined' && window.FlynnAssetVersion
      ? String(window.FlynnAssetVersion)
      : 'dev';
    const withAssetVersion = (assetPath) => `${assetPath}?v=${encodeURIComponent(assetVersion)}`;

    return Object.freeze({
      worldBounds: Object.freeze({
        x: 0,
        y: 0,
        width: worldWidth,
        height: worldHeight
      }),
      spawn: Object.freeze({
        x: worldWidth / 2,
        y: worldHeight / 2
      }),
      islandArt: Object.freeze({
        textureKey: 'island',
        imagePath: islandAssetPath,
        requestPath: withAssetVersion(islandAssetPath),
        centerX: worldWidth / 2,
        centerY: worldHeight / 2
      }),
      collisionMask: Object.freeze({
        textureKey: 'islandedge',
        imagePath: collisionMaskAssetPath,
        requestPath: withAssetVersion(collisionMaskAssetPath),
        offsetX: 0,
        offsetY: 0,
        blockedColorThreshold: 12
      })
    });
  }
));
