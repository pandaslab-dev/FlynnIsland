// ============================================
// GAME SCENE
// ============================================

class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });

    this.players = {};
    this.localPlayerId = 'local';

    this.cursors = null;
    this.keys = null;
    this.spaceKey = null;

    this.isJumping = false;
    this.SPEED = 200;

    this.emoteKeys = null;
    this.moveVector = new Phaser.Math.Vector2(0, 0);

    this.joystickBase = null;
    this.joystickThumb = null;
    this.joystickPointerId = null;
    this.joystickMaxDistance = 70;
    this.joystickVector = new Phaser.Math.Vector2(0, 0);

    this.jumpButton = null;
    this.mobileJumpRequested = false;

    this.network = null;
    this.lastInputSentAt = 0;
    this.NETWORK_SEND_INTERVAL_MS = 50;

    this.DOG_KEYS = ['alice', 'remix', 'sapphire', 'wendy'];
    this.DOG_LABELS = {
      alice: 'Alice',
      remix: 'Remix',
      sapphire: 'Sapphire',
      wendy: 'Wendy'
    };

    this.worldBounds = {
      x: 0,
      y: 0,
      width: 2048,
      height: 2048
    };

    this.islandMaskPixels = null;
    this.islandMaskWidth = 0;
    this.islandMaskHeight = 0;

    this.playerData = {
      name: 'Player',
      dogType: 'Remix'
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
    this.load.image('island', 'misc_assets/island.png');
    this.load.image('islandedge', 'misc_assets/islandedge.png');

    this.DOG_KEYS.forEach((dogKey) => {
      this.loadDogAssets(dogKey);
    });
  }

  create() {
    const island = this.add.image(1024, 1024, 'island');
    island.setOrigin(0.5, 0.5);

    this.physics.world.setBounds(
      this.worldBounds.x,
      this.worldBounds.y,
      this.worldBounds.width,
      this.worldBounds.height
    );

    this.cameras.main.setBounds(0, 0, 2048, 2048);
    this.cameras.main.setZoom(0.8);

    this.createDogAnimations();
    this.buildIslandCollisionMask();

    this.setupNetworkBridge();

    this.addOrUpdatePlayer({
      id: this.localPlayerId,
      name: this.playerData.name,
      dogType: this.playerData.dogType,
      x: 1024,
      y: 1024,
      isLocal: true
    });

    const localPlayer = this.getLocalPlayer();
    if (localPlayer) {
      this.cameras.main.startFollow(localPlayer.sprite, true, 0.1, 0.1);

      localPlayer.sprite.on('animationcomplete', (animation) => {
        if (animation.key === this.getAnimationKey(localPlayer, 'jump')) {
          this.isJumping = false;
        }
      });
    }

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

    this.createEmoteButtons();
    this.createMobileControls();

    this.events.once('shutdown', this.handleSceneShutdown, this);
    this.events.once('destroy', this.handleSceneShutdown, this);
  }

  loadDogAssets(dogKey) {
    this.load.image(`${dogKey}_stand`, `sprites/dogs/${dogKey}/${dogKey}_stand.png`);
    this.load.image(`${dogKey}_walk1`, `sprites/dogs/${dogKey}/${dogKey}_walk1.png`);
    this.load.image(`${dogKey}_walk2`, `sprites/dogs/${dogKey}/${dogKey}_walk2.png`);
    this.load.image(`${dogKey}_walk3`, `sprites/dogs/${dogKey}/${dogKey}_walk3.png`);
    this.load.image(`${dogKey}_run1`, `sprites/dogs/${dogKey}/${dogKey}_run1.png`);
    this.load.image(`${dogKey}_run2`, `sprites/dogs/${dogKey}/${dogKey}_run2.png`);
    this.load.image(`${dogKey}_jump_up`, `sprites/dogs/${dogKey}/${dogKey}_jump_up.png`);
    this.load.image(`${dogKey}_jump_down`, `sprites/dogs/${dogKey}/${dogKey}_jump_down.png`);
  }

  buildIslandCollisionMask() {
    const maskTexture = this.textures.get('islandedge');
    if (!maskTexture) {
      return;
    }

    const sourceImage = maskTexture.getSourceImage();
    if (!sourceImage || !sourceImage.width || !sourceImage.height) {
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = sourceImage.width;
    canvas.height = sourceImage.height;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      return;
    }

    ctx.drawImage(sourceImage, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    this.islandMaskPixels = imageData.data;
    this.islandMaskWidth = canvas.width;
    this.islandMaskHeight = canvas.height;
  }

  isBlockedAtWorldPoint(worldX, worldY) {
    if (!this.islandMaskPixels) {
      return false;
    }

    const pixelX = Math.floor(worldX);
    const pixelY = Math.floor(worldY);

    if (
      pixelX < 0 ||
      pixelY < 0 ||
      pixelX >= this.islandMaskWidth ||
      pixelY >= this.islandMaskHeight
    ) {
      return true;
    }

    const pixelIndex = ((pixelY * this.islandMaskWidth) + pixelX) * 4;
    const r = this.islandMaskPixels[pixelIndex];
    const g = this.islandMaskPixels[pixelIndex + 1];
    const b = this.islandMaskPixels[pixelIndex + 2];
    const a = this.islandMaskPixels[pixelIndex + 3];

    if (a === 0) {
      return false;
    }

    return r < 12 && g < 12 && b < 12;
  }

  canPlayerOccupy(worldX, worldY) {
    const sampleRadius = 34;
    const points = [
      { x: worldX, y: worldY },
      { x: worldX + sampleRadius, y: worldY },
      { x: worldX - sampleRadius, y: worldY },
      { x: worldX, y: worldY + sampleRadius },
      { x: worldX, y: worldY - sampleRadius }
    ];

    for (const point of points) {
      if (this.isBlockedAtWorldPoint(point.x, point.y)) {
        return false;
      }
    }

    return true;
  }

  createDogAnimations() {
    this.DOG_KEYS.forEach((dogKey) => {
      const walkKey = `${dogKey}_walk`;
      const runKey = `${dogKey}_run`;
      const jumpKey = `${dogKey}_jump`;

      if (!this.anims.exists(walkKey)) {
        this.anims.create({
          key: walkKey,
          frames: [
            { key: `${dogKey}_walk1` },
            { key: `${dogKey}_walk2` },
            { key: `${dogKey}_walk3` }
          ],
          frameRate: 8,
          repeat: -1
        });
      }

      if (!this.anims.exists(runKey)) {
        this.anims.create({
          key: runKey,
          frames: [
            { key: `${dogKey}_run1` },
            { key: `${dogKey}_run2` }
          ],
          frameRate: 10,
          repeat: -1
        });
      }

      if (!this.anims.exists(jumpKey)) {
        this.anims.create({
          key: jumpKey,
          frames: [
            { key: `${dogKey}_jump_up` },
            { key: `${dogKey}_jump_down` }
          ],
          frameRate: 10,
          repeat: 0
        });
      }
    });
  }

  setupNetworkBridge() {
    if (typeof FlynnNetworkBridge !== 'function') {
      return;
    }

    this.network = new FlynnNetworkBridge();

    this.network.onConnected((serverPlayerId) => {
      this.reassignLocalPlayerId(serverPlayerId);
    });

    this.network.onWorldState((worldState) => {
      this.applyWorldState(worldState);
    });

    this.localPlayerId = this.network.connect({
      id: this.localPlayerId,
      name: this.playerData.name,
      dogType: this.playerData.dogType,
      x: 1024,
      y: 1024
    }) || this.localPlayerId;
  }

  reassignLocalPlayerId(nextLocalPlayerId) {
    if (!nextLocalPlayerId || nextLocalPlayerId === this.localPlayerId) {
      return;
    }

    const currentLocalPlayer = this.players[this.localPlayerId];
    if (!currentLocalPlayer) {
      this.localPlayerId = nextLocalPlayerId;
      return;
    }

    this.players[nextLocalPlayerId] = currentLocalPlayer;
    delete this.players[this.localPlayerId];

    currentLocalPlayer.id = nextLocalPlayerId;
    currentLocalPlayer.isLocal = true;

    this.localPlayerId = nextLocalPlayerId;
  }

  normalizeDogKey(dogType) {
    if (!dogType) {
      return 'remix';
    }

    const candidate = String(dogType).toLowerCase();
    if (this.DOG_KEYS.includes(candidate)) {
      return candidate;
    }

    return 'remix';
  }

  getDogLabel(dogKey) {
    return this.DOG_LABELS[dogKey] || this.DOG_LABELS.remix;
  }

  addOrUpdatePlayer(playerData) {
    const playerId = playerData.id;
    if (!playerId) {
      return null;
    }

    const dogKey = this.normalizeDogKey(playerData.dogType);
    const dogLabel = this.getDogLabel(dogKey);

    let playerEntity = this.players[playerId];

    if (!playerEntity) {
      const sprite = this.physics.add.sprite(
        playerData.x ?? 1024,
        playerData.y ?? 1024,
        `${dogKey}_stand`
      );
      sprite.setScale(0.3);
      sprite.setCollideWorldBounds(false);
      sprite.body.setSize(150, 150);
      sprite.body.setOffset(180, 180);

      const playerNameText = this.add.text(
        sprite.x,
        sprite.y - 100,
        playerData.name || 'Player',
        {
          fontSize: '24px',
          fontFamily: 'Arial, sans-serif',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 4,
          align: 'center'
        }
      );
      playerNameText.setOrigin(0.5, 0.5);

      const dogTypeText = this.add.text(
        sprite.x,
        sprite.y - 75,
        dogLabel,
        {
          fontSize: '18px',
          fontFamily: 'Arial, sans-serif',
          color: '#FFD700',
          stroke: '#000000',
          strokeThickness: 3,
          align: 'center'
        }
      );
      dogTypeText.setOrigin(0.5, 0.5);

      playerEntity = {
        id: playerId,
        name: playerData.name || 'Player',
        dogKey,
        sprite,
        playerNameText,
        dogTypeText,
        currentEmote: null,
        isLocal: Boolean(playerData.isLocal),
        targetX: sprite.x,
        targetY: sprite.y,
        remoteAnimation: 'stand'
      };

      this.players[playerId] = playerEntity;
    } else {
      playerEntity.name = playerData.name || playerEntity.name;
      playerEntity.playerNameText.setText(playerEntity.name);

      if (playerEntity.dogKey !== dogKey) {
        playerEntity.dogKey = dogKey;
        playerEntity.sprite.setTexture(`${dogKey}_stand`);
      }

      if (typeof playerData.x === 'number' && typeof playerData.y === 'number') {
        playerEntity.targetX = playerData.x;
        playerEntity.targetY = playerData.y;
      }
    }

    playerEntity.isLocal = Boolean(playerData.isLocal);
    playerEntity.dogTypeText.setText(dogLabel);

    if (typeof playerData.flipX === 'boolean') {
      playerEntity.sprite.setFlipX(playerData.flipX);
    }

    if (typeof playerData.x === 'number' && typeof playerData.y === 'number' && playerEntity.isLocal) {
      playerEntity.sprite.setPosition(playerData.x, playerData.y);
      playerEntity.targetX = playerData.x;
      playerEntity.targetY = playerData.y;
    }

    this.updatePlayerDecorations(playerEntity);
    return playerEntity;
  }

  removePlayer(playerId) {
    const playerEntity = this.players[playerId];
    if (!playerEntity) {
      return;
    }

    if (playerEntity.currentEmote) {
      playerEntity.currentEmote.destroy();
    }

    playerEntity.playerNameText.destroy();
    playerEntity.dogTypeText.destroy();
    playerEntity.sprite.destroy();

    delete this.players[playerId];
  }

  applyWorldState(worldState) {
    const playersSnapshot = Array.isArray(worldState)
      ? worldState
      : Array.isArray(worldState?.players)
        ? worldState.players
        : [];

    const activeIds = new Set();

    playersSnapshot.forEach((snapshot) => {
      if (!snapshot || !snapshot.id) {
        return;
      }

      activeIds.add(snapshot.id);

      const isLocalPlayer = snapshot.id === this.localPlayerId;
      if (isLocalPlayer) {
        // Local player is currently client-driven; skip snapshot correction
        // to avoid jitter/rubber-banding until reconciliation is implemented.
        return;
      }

      const playerEntity = this.addOrUpdatePlayer({
        id: snapshot.id,
        name: snapshot.name,
        dogType: snapshot.dogType,
        x: snapshot.x,
        y: snapshot.y,
        flipX: snapshot.flipX,
        isLocal: false
      });

      if (!playerEntity) {
        return;
      }

      if (!isLocalPlayer && typeof snapshot.animation === 'string') {
        playerEntity.remoteAnimation = snapshot.animation;
        this.playEntityAnimation(playerEntity, snapshot.animation);
      }

      if (snapshot.emote) {
        this.showEmoteForPlayer(snapshot.id, snapshot.emote);
      }
    });

    Object.keys(this.players).forEach((playerId) => {
      if (playerId === this.localPlayerId) {
        return;
      }

      if (!activeIds.has(playerId)) {
        this.removePlayer(playerId);
      }
    });
  }

  getLocalPlayer() {
    return this.players[this.localPlayerId] || null;
  }

  getAnimationKey(playerEntity, action) {
    return `${playerEntity.dogKey}_${action}`;
  }

  playEntityAnimation(playerEntity, animationState) {
    if (!playerEntity || !playerEntity.sprite) {
      return;
    }

    if (animationState === 'walk') {
      playerEntity.sprite.play(this.getAnimationKey(playerEntity, 'walk'), true);
      return;
    }

    if (animationState === 'run') {
      playerEntity.sprite.play(this.getAnimationKey(playerEntity, 'run'), true);
      return;
    }

    if (animationState === 'jump') {
      playerEntity.sprite.play(this.getAnimationKey(playerEntity, 'jump'), true);
      return;
    }

    playerEntity.sprite.anims.stop();
    playerEntity.sprite.setTexture(`${playerEntity.dogKey}_stand`);
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
      buttonBg.setDepth(3000);

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
      emojiText.setDepth(3001);

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
    const localPlayer = this.getLocalPlayer();
    if (!localPlayer) {
      return;
    }

    if ((Phaser.Input.Keyboard.JustDown(this.spaceKey) || this.mobileJumpRequested) && !this.isJumping) {
      this.isJumping = true;
      this.playEntityAnimation(localPlayer, 'jump');

      this.tweens.add({
        targets: localPlayer.sprite,
        y: localPlayer.sprite.y - 50,
        duration: 250,
        yoyo: true,
        ease: 'Quad.easeOut'
      });

      this.mobileJumpRequested = false;
      this.updateAllPlayerDecorations();
      this.sendNetworkInput(time, 'jump', true);
      return;
    }
    this.mobileJumpRequested = false;

    if (this.isJumping) {
      this.updateAllPlayerDecorations();
      this.interpolateRemotePlayers(delta);
      return;
    }

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

    if (this.joystickVector.lengthSq() > 0) {
      this.moveVector.copy(this.joystickVector);
    }

    localPlayer.sprite.setVelocity(0, 0);

    const moveStep = this.SPEED * (delta / 1000);
    const targetX = localPlayer.sprite.x + (this.moveVector.x * moveStep);
    const targetY = localPlayer.sprite.y + (this.moveVector.y * moveStep);

    if (this.canPlayerOccupy(targetX, localPlayer.sprite.y)) {
      localPlayer.sprite.x = targetX;
    }
    if (this.canPlayerOccupy(localPlayer.sprite.x, targetY)) {
      localPlayer.sprite.y = targetY;
    }

    const isMoving = this.moveVector.lengthSq() > 0;

    if (this.moveVector.x < -0.05) {
      localPlayer.sprite.setFlipX(true);
    } else if (this.moveVector.x > 0.05) {
      localPlayer.sprite.setFlipX(false);
    }

    if (isMoving) {
      this.playEntityAnimation(localPlayer, 'walk');
    } else {
      this.playEntityAnimation(localPlayer, 'stand');
    }

    this.interpolateRemotePlayers(delta);
    this.updateAllPlayerDecorations();

    this.sendNetworkInput(time, isMoving ? 'walk' : 'stand');
  }

  interpolateRemotePlayers(delta) {
    const smoothing = Phaser.Math.Clamp((delta / 1000) * 12, 0, 1);

    Object.values(this.players).forEach((playerEntity) => {
      if (playerEntity.isLocal) {
        return;
      }

      if (typeof playerEntity.targetX === 'number' && typeof playerEntity.targetY === 'number') {
        playerEntity.sprite.x = Phaser.Math.Linear(playerEntity.sprite.x, playerEntity.targetX, smoothing);
        playerEntity.sprite.y = Phaser.Math.Linear(playerEntity.sprite.y, playerEntity.targetY, smoothing);
      }
    });
  }

  sendNetworkInput(time, animationState, force = false) {
    if (!this.network || typeof this.network.sendInput !== 'function') {
      return;
    }

    if (!force && (time - this.lastInputSentAt < this.NETWORK_SEND_INTERVAL_MS)) {
      return;
    }

    const localPlayer = this.getLocalPlayer();
    if (!localPlayer) {
      return;
    }

    this.network.sendInput({
      moveX: this.moveVector.x,
      moveY: this.moveVector.y,
      jump: this.isJumping,
      animation: animationState,
      x: localPlayer.sprite.x,
      y: localPlayer.sprite.y,
      flipX: localPlayer.sprite.flipX
    });

    this.lastInputSentAt = time;
  }

  showEmote(emoji) {
    this.showEmoteForPlayer(this.localPlayerId, emoji);

    if (this.network && typeof this.network.sendEmote === 'function') {
      this.network.sendEmote(emoji);
    }
  }

  showEmoteForPlayer(playerId, emoji) {
    const playerEntity = this.players[playerId];
    if (!playerEntity) {
      return;
    }

    if (playerEntity.currentEmote) {
      playerEntity.currentEmote.destroy();
    }

    playerEntity.currentEmote = this.add.text(
      playerEntity.sprite.x,
      playerEntity.sprite.y - 140,
      emoji,
      {
        fontSize: '48px',
        align: 'center'
      }
    );
    playerEntity.currentEmote.setOrigin(0.5, 0.5);

    playerEntity.currentEmote.setScale(0);
    this.tweens.add({
      targets: playerEntity.currentEmote,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 450,
      ease: 'Back.easeOut',
      yoyo: true,
      onComplete: () => {
        this.time.delayedCall(1000, () => {
          if (playerEntity.currentEmote) {
            this.tweens.add({
              targets: playerEntity.currentEmote,
              alpha: 0,
              y: playerEntity.currentEmote.y - 20,
              duration: 500,
              ease: 'Power2',
              onComplete: () => {
                if (playerEntity.currentEmote) {
                  playerEntity.currentEmote.destroy();
                  playerEntity.currentEmote = null;
                }
              }
            });
          }
        });
      }
    });
  }

  updateAllPlayerDecorations() {
    Object.values(this.players).forEach((playerEntity) => {
      this.updatePlayerDecorations(playerEntity);
    });
  }

  updatePlayerDecorations(playerEntity) {
    playerEntity.playerNameText.setPosition(playerEntity.sprite.x, playerEntity.sprite.y - 100);
    playerEntity.dogTypeText.setPosition(playerEntity.sprite.x, playerEntity.sprite.y - 75);

    if (playerEntity.currentEmote && playerEntity.currentEmote.active && playerEntity.currentEmote.alpha === 1) {
      playerEntity.currentEmote.setPosition(playerEntity.sprite.x, playerEntity.sprite.y - 140);
    }
  }

  handleSceneShutdown() {
    if (this.network && typeof this.network.disconnect === 'function') {
      this.network.disconnect();
    }

    Object.keys(this.players).forEach((playerId) => {
      this.removePlayer(playerId);
    });

    this.players = {};
    this.resetJoystick();
  }
}
