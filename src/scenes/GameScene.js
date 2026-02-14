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
    this.moveVector = new Phaser.Math.Vector2(0, 0);
    
    this.joystickBase = null;
    this.joystickThumb = null;
    this.joystickPointerId = null;
    this.joystickMaxDistance = 70;
    this.joystickVector = new Phaser.Math.Vector2(0, 0);
    
    this.jumpButton = null;
    this.mobileJumpRequested = false;
    
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
    
    // Add island background
    const island = this.add.image(1024, 1024, 'island');
    island.setOrigin(0.5, 0.5);
    
    // NEW: Set physics world bounds (island boundaries)
    // The island has some water, so we'll make the bounds smaller than 2048x2048
    // Adjust these values to match where the beach ends
    this.physics.world.setBounds(300, 300, 1450, 1150);
    
    // NEW: Convert player to physics sprite (was regular sprite)
    this.player = this.physics.add.sprite(1024, 1024, `${dogKey}_stand`);
    this.player.setScale(0.3);
    
    // NEW: Enable collision with world bounds
    this.player.setCollideWorldBounds(true);
    
    // NEW: Set collision body size (smaller than sprite for better feel)
    // This makes collision feel more natural - checks center of dog, not edges
    this.player.body.setSize(150, 150);  // Adjust based on your preference
    this.player.body.setOffset(180, 180);  // Center the collision box
    
    // Camera setup
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, 2048, 2048);
    this.cameras.main.setZoom(0.8);
    
    // Animations
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
    
    // Text labels
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
    
    // Input
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
    
    // Emoji buttons
    this.createEmoteButtons();
    
    // Mobile controls
    this.createMobileControls();
  }
  
  createEmoteButtons() {
    const emojis = ['❤️', '😂', '😭', '😡', '🐾', '❗'];
    
    const buttonSize = 60;
    const buttonSpacing = 10;
    const totalWidth = (buttonSize * 6) + (buttonSpacing * 5);
    
    const startX = (1024 - totalWidth) / 2;
    const yPosition = 700;
    
    emojis.forEach((emoji, index) => {
      const xPosition = startX + (index * (buttonSize + buttonSpacing));
      
      const buttonBg = this.add.rectangle(
        xPosition,
        yPosition,
        buttonSize,
        buttonSize,
        0x333333,
        0.8
      );
      buttonBg.setStrokeStyle(3, 0xffffff, 0.6);
      
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
      
      buttonBg.setInteractive({ useHandCursor: true });
      
      buttonBg.on('pointerover', () => {
        buttonBg.setFillStyle(0x555555, 0.9);
        this.tweens.add({
          targets: [buttonBg, emojiText],
          scaleX: 1.1,
          scaleY: 1.1,
          duration: 100,
          ease: 'Power2'
        });
      });
      
      buttonBg.on('pointerout', () => {
        buttonBg.setFillStyle(0x333333, 0.8);
        this.tweens.add({
          targets: [buttonBg, emojiText],
          scaleX: 1.0,
          scaleY: 1.0,
          duration: 100,
          ease: 'Power2'
        });
      });
      
      buttonBg.on('pointerdown', () => {
        this.tweens.add({
          targets: [buttonBg, emojiText],
          scaleX: 0.9,
          scaleY: 0.9,
          duration: 50,
          yoyo: true,
          ease: 'Power2'
        });
        
        this.showEmote(emoji);
      });
      
      buttonBg.setScrollFactor(0);
      emojiText.setScrollFactor(0);
    });
  }
  
  createMobileControls() {
    const isTouchDevice = this.sys.game.device.input.touch;
    if (!isTouchDevice) {
      return;
    }
    
    this.input.addPointer(2);
    
    const joystickX = 140;
    const joystickY = 620;
    
    this.joystickBase = this.add.circle(joystickX, joystickY, 80, 0x222222, 0.35);
    this.joystickBase.setStrokeStyle(3, 0xffffff, 0.35);
    this.joystickBase.setScrollFactor(0);
    this.joystickBase.setDepth(1000);
    
    this.joystickThumb = this.add.circle(joystickX, joystickY, 40, 0xffffff, 0.55);
    this.joystickThumb.setScrollFactor(0);
    this.joystickThumb.setDepth(1001);
    
    this.jumpButton = this.add.circle(900, 620, 60, 0x4CAF50, 0.5);
    this.jumpButton.setStrokeStyle(3, 0xffffff, 0.6);
    this.jumpButton.setScrollFactor(0);
    this.jumpButton.setDepth(1000);
    this.jumpButton.setInteractive({ useHandCursor: false });
    
    const jumpLabel = this.add.text(900, 620, 'JUMP', {
      fontSize: '22px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    });
    jumpLabel.setOrigin(0.5, 0.5);
    jumpLabel.setScrollFactor(0);
    jumpLabel.setDepth(1001);
    
    this.jumpButton.on('pointerdown', () => {
      this.mobileJumpRequested = true;
      this.jumpButton.setFillStyle(0x66BB6A, 0.75);
    });
    
    this.jumpButton.on('pointerup', () => {
      this.jumpButton.setFillStyle(0x4CAF50, 0.5);
    });
    
    this.jumpButton.on('pointerout', () => {
      this.jumpButton.setFillStyle(0x4CAF50, 0.5);
    });
    
    this.input.on('pointerdown', (pointer) => {
      if (this.joystickPointerId !== null) {
        return;
      }
      
      if (pointer.x > this.scale.width / 2) {
        return;
      }
      
      const distanceFromBase = Phaser.Math.Distance.Between(
        pointer.x,
        pointer.y,
        this.joystickBase.x,
        this.joystickBase.y
      );
      if (distanceFromBase > 140) {
        return;
      }
      
      this.joystickPointerId = pointer.id;
      this.updateJoystick(pointer);
    });
    
    this.input.on('pointermove', (pointer) => {
      if (pointer.id !== this.joystickPointerId) {
        return;
      }
      
      this.updateJoystick(pointer);
    });
    
    this.input.on('pointerup', (pointer) => {
      if (pointer.id !== this.joystickPointerId) {
        return;
      }
      
      this.resetJoystick();
    });
  }
  
  updateJoystick(pointer) {
    if (!this.joystickBase || !this.joystickThumb) {
      return;
    }
    
    const dx = pointer.x - this.joystickBase.x;
    const dy = pointer.y - this.joystickBase.y;
    const distance = Math.sqrt((dx * dx) + (dy * dy));
    const clampedDistance = Math.min(distance, this.joystickMaxDistance);
    
    let angle = 0;
    if (distance > 0) {
      angle = Math.atan2(dy, dx);
    }
    
    this.joystickThumb.x = this.joystickBase.x + (Math.cos(angle) * clampedDistance);
    this.joystickThumb.y = this.joystickBase.y + (Math.sin(angle) * clampedDistance);
    
    if (distance < 6) {
      this.joystickVector.set(0, 0);
      return;
    }
    
    const strength = clampedDistance / this.joystickMaxDistance;
    this.joystickVector.set(Math.cos(angle) * strength, Math.sin(angle) * strength);
  }
  
  resetJoystick() {
    this.joystickPointerId = null;
    this.joystickVector.set(0, 0);
    
    if (this.joystickBase && this.joystickThumb) {
      this.joystickThumb.x = this.joystickBase.x;
      this.joystickThumb.y = this.joystickBase.y;
    }
  }
  
  update(time, delta) {
    // Jump
    if ((Phaser.Input.Keyboard.JustDown(this.spaceKey) || this.mobileJumpRequested) && !this.isJumping) {
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
      this.mobileJumpRequested = false;
      return;
    }
    this.mobileJumpRequested = false;
    
    if (this.isJumping) {
      this.updateTextPositions();
      return;
    }
    
    // Emote keys
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
    
    // NEW: Use physics velocity instead of direct position changes
    this.moveVector.set(0, 0);
    
    if (this.keys.A.isDown || this.cursors.left.isDown) {
      this.moveVector.x = -1;
    }
    if (this.keys.D.isDown || this.cursors.right.isDown) {
      this.moveVector.x = 1;
    }
    
    if (this.keys.W.isDown || this.cursors.up.isDown) {
      this.moveVector.y = -1;
    }
    if (this.keys.S.isDown || this.cursors.down.isDown) {
      this.moveVector.y = 1;
    }
    
    if (this.moveVector.lengthSq() > 0) {
      this.moveVector.normalize();
    }
    
    // Touch joystick overrides keyboard direction when active.
    if (this.joystickVector.lengthSq() > 0) {
      this.moveVector.copy(this.joystickVector);
    }
    
    // NEW: Set velocity on physics body (replaces manual position changes)
    this.player.setVelocity(
      this.moveVector.x * this.SPEED,
      this.moveVector.y * this.SPEED
    );
    
    const isMoving = this.moveVector.lengthSq() > 0;
    
    if (this.moveVector.x < -0.05) {
      this.player.setFlipX(true);
    } else if (this.moveVector.x > 0.05) {
      this.player.setFlipX(false);
    }
    
    // Animation
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
              duration: 500,
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
