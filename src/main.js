// ============================================
// FLYNN ISLAND - Main Configuration
// ============================================

function getScaledGameSize() {
  if (window.FlynnViewportScaler && typeof window.FlynnViewportScaler.getGameSize === 'function') {
    return window.FlynnViewportScaler.getGameSize();
  }

  const isPortraitViewport = window.innerHeight > window.innerWidth;
  return {
    width: isPortraitViewport ? 576 : 1024,
    height: isPortraitViewport ? 1024 : 768
  };
}

const initialGameSize = getScaledGameSize();

const config = {
  type: Phaser.AUTO,
  width: initialGameSize.width,
  height: initialGameSize.height,
  backgroundColor: '#1a1a1a',
  pixelArt: true,
  
  // NEW: Enable physics
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },  // No gravity (top-down game)
      debug: false        // Set to true to see collision boundaries
    }
  },
  
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },


  scene: [
    TitleScene,
    NameInputScene,
    DogSelectScene,
    GameScene
  ]
};

const game = new Phaser.Game(config);

let lastGameSize = { width: initialGameSize.width, height: initialGameSize.height };
let resizeTimerId = null;

function isMobileTextEntryActive() {
  const activeElement = document.activeElement;
  if (!activeElement || activeElement.id !== 'nameInput') {
    return false;
  }

  return window.matchMedia('(pointer: coarse)').matches;
}

function applyDynamicScale() {
  if (isMobileTextEntryActive()) {
    return;
  }

  const nextGameSize = getScaledGameSize();
  if (
    nextGameSize.width === lastGameSize.width &&
    nextGameSize.height === lastGameSize.height
  ) {
    return;
  }

  lastGameSize = {
    width: nextGameSize.width,
    height: nextGameSize.height
  };

  game.scale.setGameSize(nextGameSize.width, nextGameSize.height);
}

function queueDynamicScale() {
  if (resizeTimerId !== null) {
    window.clearTimeout(resizeTimerId);
  }

  resizeTimerId = window.setTimeout(() => {
    resizeTimerId = null;
    applyDynamicScale();
  }, 140);
}

window.addEventListener('resize', queueDynamicScale, { passive: true });
window.addEventListener('orientationchange', queueDynamicScale, { passive: true });
