// ============================================
// FLYNN ISLAND - Main Configuration
// ============================================
// This file initializes Phaser and registers all scenes

const config = {
  type: Phaser.AUTO,              // Use WebGL if available, fallback to Canvas
  width: 1024,                     // Canvas width in pixels
  height: 768,                     // Canvas height in pixels
  backgroundColor: '#1a1a1a',      // Fallback background color
  pixelArt: true,                  // Crisp pixel rendering (good for your 512x512 sprites)
  
  // Register all scenes in order
  // First scene in array (TitleScene) starts automatically
  scene: [
    TitleScene,         // Scene 1: Logo + Play Now button
    NameInputScene,     // Scene 2: Player enters their name
    DogSelectScene,     // Scene 3: Player chooses their dog
    GameScene           // Scene 4: Actual gameplay
  ]
};

// Create and start the game
const game = new Phaser.Game(config);