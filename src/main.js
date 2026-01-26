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

let isJumping = false;
let spaceKey;

// NEW: Text labels
let playerNameText;               // Player's name (e.g., "Panda")
let dogTypeText;                  // Dog breed (e.g., "remix")

// NEW: Player data (later this will come from name/dog select screens)
const playerData = {
  name: "panda",                  // Placeholder - will be set in name screen
  dogType: "remix"                // Placeholder - will be set in dog select
};

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
  
  // Jump animation
  this.anims.create({
    key: 'jump',
    frames: [
      { key: 'remix_jump_up' },
      { key: 'remix_jump_down' }
    ],
    frameRate: 10,
    repeat: 0
  });
  
  // NEW: Create player name text (on top)
  playerNameText = this.add.text(
    player.x,                      // x position (will update in update())
    player.y - 100,                // y position (above the dog)
    playerData.name,               // Text content
    {
      fontSize: '24px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      stroke: '#000000',           // Black outline
      strokeThickness: 4,          // Outline thickness
      align: 'center'
    }
  );
  playerNameText.setOrigin(0.5, 0.5);  // Center the text on its position
  
  // NEW: Create dog type text (below player name)
  dogTypeText = this.add.text(
    player.x,
    player.y - 75,                 // Below the player name
    playerData.dogType,
    {
      fontSize: '18px',
      fontFamily: 'Arial, sans-serif',
      color: '#FFD700',            // Gold color for dog type
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center'
    }
  );
  dogTypeText.setOrigin(0.5, 0.5);
  
  cursors = this.input.keyboard.createCursorKeys();
  keys = this.input.keyboard.addKeys('W,A,S,D');
  spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  
  player.on('animationcomplete', (animation) => {
    if (animation.key === 'jump') {
      isJumping = false;
    }
  });
}

// ============================================
// UPDATE
// ============================================
function update(time, delta) {
  // Jump input
  if (Phaser.Input.Keyboard.JustDown(spaceKey) && !isJumping) {
    isJumping = true;
    player.play('jump');
    
    this.tweens.add({
      targets: player,
      y: player.y - 50,
      duration: 250,
      yoyo: true,
      ease: 'Quad.easeOut'
    });
    
    return;
  }
  
  if (isJumping) {
    // NEW: Update text positions even while jumping
    updateTextPositions();
    return;
  }
  
  // Movement
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
  
  // NEW: Update text positions to follow player
  updateTextPositions();
}

// ============================================
// NEW: Helper function to update text positions
// ============================================
function updateTextPositions() {
  // Position player name above the dog
  playerNameText.setPosition(player.x, player.y - 100);
  
  // Position dog type below player name
  dogTypeText.setPosition(player.x, player.y - 75);
}