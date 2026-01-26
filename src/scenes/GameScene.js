// ============================================
// GAME SCENE
// ============================================
// The main gameplay - player movement, jump, labels

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
    
    // Player data (later will come from previous scenes)
    this.playerData = {
      name: "Panda",
      dogType: "Remix"
    };
  }
  
  preload() {
    // Load all dog sprites
    this.load.image('remix_stand', 'sprites/dogs/remix/remix_stand.png');
    
    this.load.image('remix_walk1', 'sprites/dogs/remix/remix_walk1.png');
    this.load.image('remix_walk2', 'sprites/dogs/remix/remix_walk2.png');
    this.load.image('remix_walk3', 'sprites/dogs/remix/remix_walk3.png');
    
    this.load.image('remix_run1', 'sprites/dogs/remix/remix_run1.png');
    this.load.image('remix_run2', 'sprites/dogs/remix/remix_run2.png');
    
    this.load.image('remix_jump_up', 'sprites/dogs/remix/remix_jump_up.png');
    this.load.image('remix_jump_down', 'sprites/dogs/remix/remix_jump_down.png');
  }
  
  create() {
    // Set background
    this.cameras.main.setBackgroundColor('#87CEEB');
    
    // Create player sprite
    this.player = this.add.sprite(512, 384, 'remix_stand');
    this.player.setScale(0.3);
    
    // Create animations
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
    
    this.anims.create({
      key: 'run',
      frames: [
        { key: 'remix_run1' },
        { key: 'remix_run2' }
      ],
      frameRate: 10,
      repeat: -1
    });
    
    this.anims.create({
      key: 'jump',
      frames: [
        { key: 'remix_jump_up' },
        { key: 'remix_jump_down' }
      ],
      frameRate: 10,
      repeat: 0
    });
    
    // Create text labels
    this.playerNameText = this.add.text(
      this.player.x,
      this.player.y - 100,
      this.playerData.name,
      {
        fontSize: '24px',
        fontFamily: 'Arial, sans-serif',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center'
      }
    );
    this.playerNameText.setOrigin(0.5, 0.5);
    
    this.dogTypeText = this.add.text(
      this.player.x,
      this.player.y - 75,
      this.playerData.dogType,
      {
        fontSize: '18px',
        fontFamily: 'Arial, sans-serif',
        color: '#FFD700',
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center'
      }
    );
    this.dogTypeText.setOrigin(0.5, 0.5);
    
    // Setup input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D');
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    
    // Animation complete listener
    this.player.on('animationcomplete', (animation) => {
      if (animation.key === 'jump') {
        this.isJumping = false;
      }
    });
  }
  
  update(time, delta) {
    // Jump input
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey) && !this.isJumping) {
      this.isJumping = true;
      this.player.play('jump');
      
      this.tweens.add({
        targets: this.player,
        y: this.player.y - 50,
        duration: 250,
        yoyo: true,
        ease: 'Quad.easeOut'
      });
      
      this.updateTextPositions();
      return;
    }
    
    if (this.isJumping) {
      this.updateTextPositions();
      return;
    }
    
    // Movement
    let velocityX = 0;
    let velocityY = 0;
    let isMoving = false;
    
    if (this.keys.A.isDown || this.cursors.left.isDown) {
      velocityX = -this.SPEED;
      this.player.setFlipX(true);
      isMoving = true;
    } else if (this.keys.D.isDown || this.cursors.right.isDown) {
      velocityX = this.SPEED;
      this.player.setFlipX(false);
      isMoving = true;
    }
    
    if (this.keys.W.isDown || this.cursors.up.isDown) {
      velocityY = -this.SPEED;
      isMoving = true;
    } else if (this.keys.S.isDown || this.cursors.down.isDown) {
      velocityY = this.SPEED;
      isMoving = true;
    }
    
    this.player.x += velocityX * (delta / 1000);
    this.player.y += velocityY * (delta / 1000);
    
    if (isMoving) {
      this.player.play('walk', true);
    } else {
      this.player.anims.stop();
      this.player.setTexture('remix_stand');
    }
    
    this.updateTextPositions();
  }
  
  updateTextPositions() {
    this.playerNameText.setPosition(this.player.x, this.player.y - 100);
    this.dogTypeText.setPosition(this.player.x, this.player.y - 75);
  }
}