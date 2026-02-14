// ============================================
// FLYNN ISLAND - Main Configuration
// ============================================

const isPortraitViewport = window.innerHeight > window.innerWidth;
const baseWidth = isPortraitViewport ? 576 : 1024;
const baseHeight = isPortraitViewport ? 1024 : 768;

const config = {
  type: Phaser.AUTO,
  width: baseWidth,
  height: baseHeight,
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
