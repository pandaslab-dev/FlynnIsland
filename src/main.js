// ============================================
// PHASER CONFIG
// ============================================
// This tells Phaser how to initialize your game
const config = {
  type: Phaser.AUTO,              // Use WebGL if available, fall back to Canvas
  width: 1024,                     // Game canvas width
  height: 768,                     // Game canvas height
  backgroundColor: '#87CEEB',      // Sky blue background
  pixelArt: true,                  // Crisp pixel scaling (good for your 512x512 sprites)
  scene: {
    preload: preload,              // Load assets BEFORE game starts
    create: create,                // Set up game objects ONCE
    update: update                 // Runs every frame (60 times/sec)
  }
};

// Start the game
const game = new Phaser.Game(config);

// ============================================
// GAME STATE
// ============================================
// These variables live outside the functions so they persist
let player;                        // The dog sprite
let cursors;                       // Keyboard arrow keys
let keys;                          // WASD keys
const SPEED = 200;                 // Pixels per second

// ============================================
// PRELOAD - Load all assets
// ============================================
function preload() {
  // Load Remix's sprites
  // 'remix_stand' is the key we'll use in code
  // 'sprites/dogs/remix/remix_stand.png' is the file path
  this.load.image('remix_stand', 'sprites/dogs/remix/remix_stand.png');
  
  this.load.image('remix_walk1', 'sprites/dogs/remix/remix_walk1.png');
  this.load.image('remix_walk2', 'sprites/dogs/remix/remix_walk2.png');
  this.load.image('remix_walk3', 'sprites/dogs/remix/remix_walk3.png');
  
  this.load.image('remix_run1', 'sprites/dogs/remix/remix_run1.png');
  this.load.image('remix_run2', 'sprites/dogs/remix/remix_run2.png');
  
  this.load.image('remix_jump_up', 'sprites/dogs/remix/remix_jump_up.png');
  this.load.image('remix_jump_down', 'sprites/dogs/remix/remix_jump_down.png');
}

// ============================================
// CREATE - Set up the game world
// ============================================
function create() {
  // Add the player sprite at center of screen
  // this.add.sprite(x, y, textureKey)
  player = this.add.sprite(512, 384, 'remix_stand');
  
  // Scale down from 512x512 to something reasonable
  player.setScale(0.3);
  
  // Create walk animation
  // This defines a sequence of frames that will loop
  this.anims.create({
    key: 'walk',                   // Name we'll use to play this animation
    frames: [
      { key: 'remix_walk1' },
      { key: 'remix_walk2' },
      { key: 'remix_walk3' }
    ],
    frameRate: 8,                  // 8 frames per second
    repeat: -1                     // Loop forever
  });
  
  // Create run animation
  this.anims.create({
    key: 'run',
    frames: [
      { key: 'remix_run1' },
      { key: 'remix_run2' }
    ],
    frameRate: 10,
    repeat: -1
  });
  
  // Set up keyboard controls
  cursors = this.input.keyboard.createCursorKeys();  // Arrow keys
  keys = this.input.keyboard.addKeys('W,A,S,D');     // WASD
}

// ============================================
// UPDATE - Runs every frame
// ============================================
function update(time, delta) {
  // delta = milliseconds since last frame (useful for smooth movement)
  
  // Track if player is moving
  let velocityX = 0;
  let velocityY = 0;
  let isMoving = false;
  
  // Check horizontal movement
  if (keys.A.isDown || cursors.left.isDown) {
    velocityX = -SPEED;
    player.setFlipX(true);         // Flip sprite to face left
    isMoving = true;
  } else if (keys.D.isDown || cursors.right.isDown) {
    velocityX = SPEED;
    player.setFlipX(false);        // Face right (normal)
    isMoving = true;
  }
  
  // Check vertical movement
  if (keys.W.isDown || cursors.up.isDown) {
    velocityY = -SPEED;
    isMoving = true;
  } else if (keys.S.isDown || cursors.down.isDown) {
    velocityY = SPEED;
    isMoving = true;
  }
  
  // Apply movement
  // delta / 1000 converts milliseconds to seconds for smooth speed
  player.x += velocityX * (delta / 1000);
  player.y += velocityY * (delta / 1000);
  
  // Update animation based on movement
  if (isMoving) {
    // Play walk animation (true = don't restart if already playing)
    player.play('walk', true);
  } else {
    // Stop animation and show standing sprite
    player.anims.stop();
    player.setTexture('remix_stand');
  }
}