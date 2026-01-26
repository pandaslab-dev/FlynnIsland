// ============================================
// FLYNN ISLAND - Main Configuration
// ============================================

const config = {
  type: Phaser.AUTO,
  width: 1024,
  height: 768,
  backgroundColor: '#1a1a1a',
  pixelArt: true,
  scene: [
    TitleScene,      // First scene that loads
    GameScene        // Game scene (starts when Play Now is clicked)
  ]
};

// Start the game
const game = new Phaser.Game(config);