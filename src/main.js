// ============================================
// PHASER CONFIG
// ============================================
const config = {
  type: Phaser.AUTO,
  width: 1024,
  height: 768,
  backgroundColor: '#87CEEB',
  pixelArt: true,
  scene: {
    preload: preload,
    create: create,
    update: update
  }
};

const game = new Phaser.Game(config);

// ============================================
// GAME STATE
// ============================================
let player;
let cursors;
let keys;
const SPEED = 200;

// NEW: Jump state tracking
let isJumping = false;              // Prevents jumping while already jumping
let spaceKey;                       // Spacebar key object

// ============================================
// PRELOAD
// ============================================
function preload() {
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
// CREATE
// ============================================
function create() {
  player = this.add.sprite(512, 384, 'remix_stand');
  player.setScale(0.3);
  
  // Walk animation
  this.anims.create({
    key: 'walk',
    frames: [
      { key: 'remix_walk1' },
      { key: 'remix_walk2' },
      { key: 'remix_walk3' }
    ],
    frameRate: 8,
    repeat: -1
  });
  
  // Run animation
  this.anims.create({
    key: 'run',
    frames: [
      { key: 'remix_run1' },
      { key: 'remix_run2' }
    ],
    frameRate: 10,
    repeat: -1
  });
  
  // NEW: Jump animation (plays once, doesn't loop)
  this.anims.create({
    key: 'jump',
    frames: [
      { key: 'remix_jump_up' },
      { key: 'remix_jump_down' }
    ],
    frameRate: 10,
    repeat: 0                      // Play once (0 = no repeat)
  });
  
  cursors = this.input.keyboard.createCursorKeys();
  keys = this.input.keyboard.addKeys('W,A,S,D');
  
  // NEW: Set up spacebar key
  spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  
  // NEW: Listen for animation complete event
  // This fires when the jump animation finishes
  player.on('animationcomplete', (animation) => {
    if (animation.key === 'jump') {
      isJumping = false;           // Allow jumping again
    }
  });
}

// ============================================
// UPDATE
// ============================================
function update(time, delta) {
  // NEW: Check for jump input (only if not already jumping)
  if (Phaser.Input.Keyboard.JustDown(spaceKey) && !isJumping) {
    isJumping = true;
    player.play('jump');
    
    // Optional: Add a little hop effect using a tween
    // This makes the dog actually move up and down
    this.tweens.add({
      targets: player,
      y: player.y - 50,            // Jump up 50 pixels
      duration: 250,               // Take 250ms to go up
      yoyo: true,                  // Come back down automatically
      ease: 'Quad.easeOut'         // Smooth jump curve
    });
    
    // Don't process movement during jump
    return;
  }
  
  // Skip movement processing if jumping
  if (isJumping) {
    return;
  }
  
  // Regular movement code (unchanged)
  let velocityX = 0;
  let velocityY = 0;
  let isMoving = false;
  
  if (keys.A.isDown || cursors.left.isDown) {
    velocityX = -SPEED;
    player.setFlipX(true);
    isMoving = true;
  } else if (keys.D.isDown || cursors.right.isDown) {
    velocityX = SPEED;
    player.setFlipX(false);
    isMoving = true;
  }
  
  if (keys.W.isDown || cursors.up.isDown) {
    velocityY = -SPEED;
    isMoving = true;
  } else if (keys.S.isDown || cursors.down.isDown) {
    velocityY = SPEED;
    isMoving = true;
  }
  
  player.x += velocityX * (delta / 1000);
  player.y += velocityY * (delta / 1000);
  
  if (isMoving) {
    player.play('walk', true);
  } else {
    player.anims.stop();
    player.setTexture('remix_stand');
  }
}