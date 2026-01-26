// ============================================
// GAME SCENE
// ============================================
// The main gameplay - player movement, jump, name/dog labels
// Receives player name and dog choice from previous scenes

class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    
    // Scene-specific properties
    this.player = null;
    this.playerNameText = null;
    this.dogTypeText = null;
    
    this.cursors = null;
    this.keys = null;
    this.spaceKey = null;
    
    this.isJumping = false;
    this.SPEED = 200;
    
    // Player data - will be set by init()
    this.playerData = {
      name: "Player",    // Default fallback
      dogType: "Remix"   // Default fallback
    };
  }
  
  // Receive data from DogSelectScene
  init(data) {
    // init() runs before preload()
    if (data.playerName) {
      this.playerData.name = data.playerName;
    }
    if (data.dogType) {
      this.playerData.dogType = data.dogType;
    }
  }
  
  preload() {
    // Dynamically load the selected dog's sprites
    // This is more efficient than loading all 4 dogs every time
    
    const dogKey = this.playerData.dogType.toLowerCase();  // "Alice" → "alice"
    
    // Load all animation frames for selected dog
    this.load.image(`${dogKey}_stand`, `sprites/dogs/${dogKey}/${dogKey}_stand.png`);
    
    this.load.image(`${dogKey}_walk1`, `sprites/dogs/${dogKey}/${dogKey}_walk1.png`);
    this.load.image(`${dogKey}_walk2`, `sprites/dogs/${dogKey}/${dogKey}_walk2.png`);
    this.load.image(`${dogKey}_walk3`, `sprites/dogs/${dogKey}/${dogKey}_walk3.png`);
    
    this.load.image(`${dogKey}_run1`, `sprites/dogs/${dogKey}/${dogKey}_run1.png`);
    this.load.image(`${dogKey}_run2`, `sprites/dogs/${dogKey}/${dogKey}_run2.png`);
    
    this.load.image(`${dogKey}_jump_up`, `sprites/dogs/${dogKey}/${dogKey}_jump_up.png`);
    this.load.image(`${dogKey}_jump_down`, `sprites/dogs/${dogKey}/${dogKey}_jump_down.png`);
  }
  
  create() {
    // Set background
    this.cameras.main.setBackgroundColor('#87CEEB');
    
    const dogKey = this.playerData.dogType.toLowerCase();
    
    // Create player sprite with selected dog
    this.player = this.add.sprite(512, 384, `${dogKey}_stand`);
    this.player.setScale(0.3);
    
    // Create walk animation using selected dog's frames
    this.anims.create({
      key: 'walk',
      frames: [
        { key: `${dogKey}_walk1` },
        { key: `${dogKey}_walk2` },
        { key: `${dogKey}_walk3` }
      ],
      frameRate: 8,      // 8 frames per second
      repeat: -1         // Loop forever
    });
    
    // Create run animation
    this.anims.create({
      key: 'run',
      frames: [
        { key: `${dogKey}_run1` },
        { key: `${dogKey}_run2` }
      ],
      frameRate: 10,
      repeat: -1
    });
    
    // Create jump animation
    this.anims.create({
      key: 'jump',
      frames: [
        { key: `${dogKey}_jump_up` },
        { key: `${dogKey}_jump_down` }
      ],
      frameRate: 10,
      repeat: 0          // Play once, don't loop
    });
    
    // Create player name text label (above dog)
    this.playerNameText = this.add.text(
      this.player.x,
      this.player.y - 100,
      this.playerData.name,  // Player's entered name
      {
        fontSize: '24px',
        fontFamily: 'Arial, sans-serif',
        color: '#ffffff',    // White text
        stroke: '#000000',   // Black outline for readability
        strokeThickness: 4,
        align: 'center'
      }
    );
    this.playerNameText.setOrigin(0.5, 0.5);  // Center on position
    
    // Create dog type text label (below player name)
    this.dogTypeText = this.add.text(
      this.player.x,
      this.player.y - 75,
      this.playerData.dogType,  // Dog name (Alice, Remix, etc.)
      {
        fontSize: '18px',
        fontFamily: 'Arial, sans-serif',
        color: '#FFD700',    // Gold color
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center'
      }
    );
    this.dogTypeText.setOrigin(0.5, 0.5);
    
    // Setup keyboard controls
    this.cursors = this.input.keyboard.createCursorKeys();  // Arrow keys
    this.keys = this.input.keyboard.addKeys('W,A,S,D');     // WASD keys
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    
    // Listen for jump animation completion
    this.player.on('animationcomplete', (animation) => {
      if (animation.key === 'jump') {
        this.isJumping = false;  // Allow jumping again
      }
    });
  }
  
  update(time, delta) {
    // Runs 60 times per second (game loop)
    
    // Check for jump input (spacebar pressed, not held)
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey) && !this.isJumping) {
      this.isJumping = true;
      this.player.play('jump');
      
      // Add hop effect - tween the y position
      this.tweens.add({
        targets: this.player,
        y: this.player.y - 50,  // Jump up 50 pixels
        duration: 250,           // Take 250ms to jump
        yoyo: true,              // Automatically come back down
        ease: 'Quad.easeOut'     // Smooth jump curve
      });
      
      // Update text positions even while jumping
      this.updateTextPositions();
      return;  // Skip rest of update while jumping
    }
    
    // Skip movement if jumping
    if (this.isJumping) {
      this.updateTextPositions();
      return;
    }
    
    // Handle movement input
    let velocityX = 0;
    let velocityY = 0;
    let isMoving = false;
    
    // Check horizontal movement (A/D or Left/Right)
    if (this.keys.A.isDown || this.cursors.left.isDown) {
      velocityX = -this.SPEED;
      this.player.setFlipX(true);   // Flip sprite to face left
      isMoving = true;
    } else if (this.keys.D.isDown || this.cursors.right.isDown) {
      velocityX = this.SPEED;
      this.player.setFlipX(false);  // Face right (normal)
      isMoving = true;
    }
    
    // Check vertical movement (W/S or Up/Down)
    if (this.keys.W.isDown || this.cursors.up.isDown) {
      velocityY = -this.SPEED;
      isMoving = true;
    } else if (this.keys.S.isDown || this.cursors.down.isDown) {
      velocityY = this.SPEED;
      isMoving = true;
    }
    
    // Apply movement
    // delta / 1000 converts milliseconds to seconds for smooth speed
    this.player.x += velocityX * (delta / 1000);
    this.player.y += velocityY * (delta / 1000);
    
    // Update animation based on movement state
    if (isMoving) {
      // Play walk animation (true = don't restart if already playing)
      this.player.play('walk', true);
    } else {
      // Stop animation and show standing sprite
      this.player.anims.stop();
      const dogKey = this.playerData.dogType.toLowerCase();
      this.player.setTexture(`${dogKey}_stand`);
    }
    
    // Update text positions to follow player
    this.updateTextPositions();
  }
  
  updateTextPositions() {
    // Keep text labels centered above the player
    // Called every frame to make labels follow the sprite
    this.playerNameText.setPosition(this.player.x, this.player.y - 100);
    this.dogTypeText.setPosition(this.player.x, this.player.y - 75);
  }
}