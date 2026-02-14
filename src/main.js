// ============================================
// FLYNN ISLAND - Main Configuration
// ============================================

const config = {
  type: Phaser.AUTO,
  width: 1024,
  height: 768,
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