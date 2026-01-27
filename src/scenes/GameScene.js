// ============================================
// GAME SCENE
// ============================================

class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    
    this.player = null;
    this.playerNameText = null;
    this.dogTypeText = null;
    
    this.cursors = null;
    this.keys = null;
    this.spaceKey = null;
    
    this.isJumping = false;
    this.SPEED = 200;
    
    this.currentEmote = null;
    this.emoteKeys = null;
    
    this.playerData = {
      name: "Player",
      dogType: "Remix"
    };
  }
  
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
    
    this.load.image('island', 'misc_assets/island.png');
    
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
    
    const island = this.add.image(1024, 1024, 'island');
    island.setOrigin(0.5, 0.5);
    
    this.player = this.add.sprite(1024, 1024, `${dogKey}_stand`);
    this.player.setScale(0.3);
    
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, 2048, 2048);
    this.cameras.main.setZoom(0.8);
    
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
    
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D');
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    
    this.emoteKeys = this.input.keyboard.addKeys({
      one: Phaser.Input.Keyboard.KeyCodes.ONE,
      two: Phaser.Input.Keyboard.KeyCodes.TWO,
      three: Phaser.Input.Keyboard.KeyCodes.THREE,
      four: Phaser.Input.Keyboard.KeyCodes.FOUR,
      five: Phaser.Input.Keyboard.KeyCodes.FIVE,
      six: Phaser.Input.Keyboard.KeyCodes.SIX
    });
    
    this.player.on('animationcomplete', (animation) => {
      if (animation.key === 'jump') {
        this.isJumping = false;
      }
    });
    
    // NEW: Create emoji button UI
    this.createEmoteButtons();
  }
  
  // NEW: Create on-screen emote buttons
  createEmoteButtons() {
    // Define emojis in order
    const emojis = ['❤️', '😂', '😭', '😡', '🐾', '❗'];
    
    // Button dimensions
    const buttonSize = 60;
    const buttonSpacing = 10;
    const totalWidth = (buttonSize * 6) + (buttonSpacing * 5);
    
    // Starting X position to center buttons
    const startX = (1024 - totalWidth) / 2;  // Canvas width is 1024
    const yPosition = 700;  // Near bottom of canvas (768 height)
    
    // Create each button
    emojis.forEach((emoji, index) => {
      const xPosition = startX + (index * (buttonSize + buttonSpacing));
      
      // Create button background (rounded rectangle)
      const buttonBg = this.add.rectangle(
        xPosition,
        yPosition,
        buttonSize,
        buttonSize,
        0x333333,  // Dark gray
        0.8        // Slightly transparent
      );
      buttonBg.setStrokeStyle(3, 0xffffff, 0.6);  // White border
      
      // Create emoji text on top of button
      const emojiText = this.add.text(
        xPosition,
        yPosition,
        emoji,
        {
          fontSize: '36px',
          align: 'center'
        }
      );
      emojiText.setOrigin(0.5, 0.5);
      
      // Make button interactive
      buttonBg.setInteractive({ useHandCursor: true });
      
      // Hover effect - lighten background
      buttonBg.on('pointerover', () => {
        buttonBg.setFillStyle(0x555555, 0.9);  // Lighter gray
        this.tweens.add({
          targets: [buttonBg, emojiText],
          scaleX: 1.1,
          scaleY: 1.1,
          duration: 100,
          ease: 'Power2'
        });
      });
      
      // Hover out - back to normal
      buttonBg.on('pointerout', () => {
        buttonBg.setFillStyle(0x333333, 0.8);  // Back to dark gray
        this.tweens.add({
          targets: [buttonBg, emojiText],
          scaleX: 1.0,
          scaleY: 1.0,
          duration: 100,
          ease: 'Power2'
        });
      });
      
      // Click handler - show emote
      buttonBg.on('pointerdown', () => {
        // Visual feedback - quick scale down
        this.tweens.add({
          targets: [buttonBg, emojiText],
          scaleX: 0.9,
          scaleY: 0.9,
          duration: 50,
          yoyo: true,
          ease: 'Power2'
        });
        
        // Trigger emote
        this.showEmote(emoji);
      });
      
      // Fix buttons to camera (don't scroll with world)
      buttonBg.setScrollFactor(0);
      emojiText.setScrollFactor(0);
    });
  }
  
  update(time, delta) {
    // Check for jump
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
    
    // Check for emote keys
    if (Phaser.Input.Keyboard.JustDown(this.emoteKeys.one)) {
      this.showEmote('❤️');
    } else if (Phaser.Input.Keyboard.JustDown(this.emoteKeys.two)) {
      this.showEmote('😂');
    } else if (Phaser.Input.Keyboard.JustDown(this.emoteKeys.three)) {
      this.showEmote('😭');
    } else if (Phaser.Input.Keyboard.JustDown(this.emoteKeys.four)) {
      this.showEmote('😡');
    } else if (Phaser.Input.Keyboard.JustDown(this.emoteKeys.five)) {
      this.showEmote('🐾');
    } else if (Phaser.Input.Keyboard.JustDown(this.emoteKeys.six)) {
      this.showEmote('❗');
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
  
  showEmote(emoji) {
    if (this.currentEmote) {
      this.currentEmote.destroy();
    }
    
    this.currentEmote = this.add.text(
      this.player.x,
      this.player.y - 140,
      emoji,
      {
        fontSize: '48px',
        align: 'center'
      }
    );
    this.currentEmote.setOrigin(0.5, 0.5);
    
    this.currentEmote.setScale(0);
    this.tweens.add({
      targets: this.currentEmote,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 150,
      ease: 'Back.easeOut',
      yoyo: true,
      onComplete: () => {
        this.time.delayedCall(1000, () => {
          if (this.currentEmote) {
            this.tweens.add({
              targets: this.currentEmote,
              alpha: 0,
              y: this.currentEmote.y - 20,
              duration: 1500,
              ease: 'Power2',
              onComplete: () => {
                if (this.currentEmote) {
                  this.currentEmote.destroy();
                  this.currentEmote = null;
                }
              }
            });
          }
        });
      }
    });
  }
  
  updateTextPositions() {
    this.playerNameText.setPosition(this.player.x, this.player.y - 100);
    this.dogTypeText.setPosition(this.player.x, this.player.y - 75);
    
    if (this.currentEmote && this.currentEmote.active) {
      if (this.currentEmote.alpha === 1) {
        this.currentEmote.setPosition(this.player.x, this.player.y - 140);
      }
    }
  }
}