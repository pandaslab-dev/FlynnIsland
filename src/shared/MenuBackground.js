(function initFlynnMenuBackground(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  root.FlynnMenuBackground = api;
}(
  typeof globalThis !== 'undefined' ? globalThis : this,
  function createFlynnMenuBackground() {
    const DEFAULT_KEY = 'main_blur_bg';
    const DEFAULT_PATH = 'misc_assets/main-blur-bg.png';

    function preload(scene, key = DEFAULT_KEY, path = DEFAULT_PATH) {
      if (!scene?.load || !scene?.textures || !key || !path) {
        return;
      }

      if (scene.textures.exists(key)) {
        return;
      }

      scene.load.image(key, path);
    }

    function create(scene, key = DEFAULT_KEY) {
      if (!scene?.add || !scene?.textures || !scene.textures.exists(key)) {
        return null;
      }

      const background = scene.add.image(0, 0, key);
      background.setOrigin(0.5, 0.5);
      background.setScrollFactor(0);
      background.setDepth(-1000);
      layout(scene, background);
      return background;
    }

    function layout(scene, background) {
      if (!scene?.scale || !background) {
        return;
      }

      const width = Math.max(scene.scale.width, 1);
      const height = Math.max(scene.scale.height, 1);
      const scale = Math.max(width / Math.max(background.width, 1), height / Math.max(background.height, 1));

      background.setPosition(width / 2, height / 2);
      background.setScale(scale);
    }

    return {
      preload,
      create,
      layout
    };
  }
));
