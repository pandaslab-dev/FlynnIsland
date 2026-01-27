// ============================================
// GAME SCENE
// ============================================
// The main gameplay - player movement, jump, name/dog labels

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
      name: "Player",
      dogType: "Remix"
    };
  }
  
  // Receive data from DogSelectScene
  init(data) {
    if (data.playerName) {
      this.playerData.name = data.playerName;
    }
    if (data.dogType) {
      this.playerData.dogType = data.dogType;
    }
  }
  
  preload() {
    const dogKey = this.playerData.dogType.toLowerCase();
    
    // Load island background
    this.load.image('island', 'misc_assets/island.png');
    
    // Load selected dog's sprites
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
    const dogKey = this.playerData.dogType.toLowerCase();
    
    // Add island background at center of world
    const island = this.add.image(1024, 1024, 'island');
    island.setOrigin(0.5, 0.5);
    
    // Create player sprite at center of island
    this.player = this.add.sprite(1024, 1024, `${dogKey}_stand`);
    this.player.setScale(0.3);
    
    // Set up camera to follow player
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, 2048, 2048);
    this.cameras.main.setZoom(0.8);
    
    // Create animations
    this.anims.create({
      key: 'walk',
      frames: [
        { key: `${dogKey}_walk1` },
        { key: `${dogKey}_walk2` },
        { key: `${dogKey}_walk3` }
      ],
      frameRate: 8,
      repeat: -1
    });
    
    this.anims.create({
      key: 'run',
      frames: [
        { key: `${dogKey}_run1` },
        { key: `${dogKey}_run2` }
      ],
      frameRate: 10,
      repeat: -1
    });
    
    this.anims.create({
      key: 'jump',
      frames: [
        { key: `${dogKey}_jump_up` },
        { key: `${dogKey}_jump_down` }
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
    
    // Setup keyboard controls
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D');
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    
    // Listen for jump animation completion
    this.player.on('animationcomplete', (animation) => {
      if (animation.key === 'jump') {
        this.isJumping = false;
      }
    });
  }
  
  update(time, delta) {
    // Check for jump input
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
    
    // Handle movement
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
      const dogKey = this.playerData.dogType.toLowerCase();
      this.player.setTexture(`${dogKey}_stand`);
    }
    
    this.updateTextPositions();
  }
  
  updateTextPositions() {
    this.playerNameText.setPosition(this.player.x, this.player.y - 100);
    this.dogTypeText.setPosition(this.player.x, this.player.y - 75);
  }
}
