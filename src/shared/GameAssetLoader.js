(function initFlynnGameAssetLoader(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  root.FlynnGameAssetLoader = api;
}(
  typeof globalThis !== 'undefined' ? globalThis : this,
  function createFlynnGameAssetLoader() {
    function queueImage(scene, key, path) {
      if (!scene?.load || !scene?.textures || !key || !path) {
        return;
      }

      if (scene.textures.exists(key)) {
        return;
      }

      scene.load.image(key, path);
    }

    function queueDogAssets(scene, dogKeys) {
      dogKeys.forEach((dogKey) => {
        queueImage(scene, `${dogKey}_stand`, `sprites/dogs/${dogKey}/${dogKey}_stand.png`);
        queueImage(scene, `${dogKey}_sit`, `sprites/dogs/${dogKey}/${dogKey}_sit.png`);
        queueImage(scene, `${dogKey}_walk1`, `sprites/dogs/${dogKey}/${dogKey}_walk1.png`);
        queueImage(scene, `${dogKey}_walk2`, `sprites/dogs/${dogKey}/${dogKey}_walk2.png`);
        queueImage(scene, `${dogKey}_walk3`, `sprites/dogs/${dogKey}/${dogKey}_walk3.png`);
        queueImage(scene, `${dogKey}_run1`, `sprites/dogs/${dogKey}/${dogKey}_run1.png`);
        queueImage(scene, `${dogKey}_run2`, `sprites/dogs/${dogKey}/${dogKey}_run2.png`);
        queueImage(scene, `${dogKey}_jump_up`, `sprites/dogs/${dogKey}/${dogKey}_jump_up.png`);
        queueImage(scene, `${dogKey}_jump_down`, `sprites/dogs/${dogKey}/${dogKey}_jump_down.png`);
      });
    }

    function queueGameAssets(scene, worldConfig, racingConfig, dogKeys, fetchConfig, lazyRiverConfig) {
      if (!scene || !worldConfig || !racingConfig) {
        return;
      }

      queueImage(
        scene,
        worldConfig.islandArt.textureKey,
        worldConfig.islandArt.requestPath || worldConfig.islandArt.imagePath
      );
      queueImage(
        scene,
        worldConfig.collisionMask.textureKey,
        worldConfig.collisionMask.requestPath || worldConfig.collisionMask.imagePath
      );

      queueDogAssets(scene, Array.isArray(dogKeys) ? dogKeys : []);

      const carDefinitions = Array.isArray(racingConfig.cars) ? racingConfig.cars : [];
      carDefinitions.forEach((definition) => {
        queueImage(
          scene,
          definition.textureKey,
          definition.requestPath || definition.imagePath
        );
      });

      if (fetchConfig?.ball?.textureKey && (fetchConfig.ball.requestPath || fetchConfig.ball.imagePath)) {
        queueImage(
          scene,
          fetchConfig.ball.textureKey,
          fetchConfig.ball.requestPath || fetchConfig.ball.imagePath
        );
      }

      if (lazyRiverConfig?.mask?.textureKey && (lazyRiverConfig.mask.requestPath || lazyRiverConfig.mask.imagePath)) {
        queueImage(
          scene,
          lazyRiverConfig.mask.textureKey,
          lazyRiverConfig.mask.requestPath || lazyRiverConfig.mask.imagePath
        );
      }

      const lazyRiverTubes = Array.isArray(lazyRiverConfig?.tubes) ? lazyRiverConfig.tubes : [];
      lazyRiverTubes.forEach((definition) => {
        if (!definition?.textureKey || (!definition.requestPath && !definition.imagePath)) {
          return;
        }

        queueImage(
          scene,
          definition.textureKey,
          definition.requestPath || definition.imagePath
        );
      });
    }

    return {
      queueDogAssets,
      queueGameAssets
    };
  }
));
