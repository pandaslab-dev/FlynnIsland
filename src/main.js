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
    TitleScene,         // First scene
    NameInputScene,     // Name input (MAKE SURE THIS IS HERE)
    GameScene           // Game scene
  ]
};

// Start the game
const game = new Phaser.Game(config);