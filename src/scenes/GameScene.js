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
    this.shiftKey = null;

    this.isJumping = false;
    this.jumpTween = null;
    this.SPEED = 200;
    this.SPRINT_MULTIPLIER = 1.65;
    this.JUMP_TRAVEL_DISTANCE = 44;

    this.emoteKeys = null;
    this.moveVector = new Phaser.Math.Vector2(0, 0);

    this.joystickBase = null;
    this.joystickThumb = null;
    this.joystickPointerId = null;
    this.joystickPointer = null;
    this.joystickMaxDistance = 70;
    this.joystickVector = new Phaser.Math.Vector2(0, 0);

    this.jumpButton = null;
    this.sprintButton = null;
    this.mobileJumpRequested = false;
    this.mobileSprintHeld = false;
    this.mobileControlHandlers = null;
    this.mobileControlElements = [];
    this.emoteButtonElements = [];
    this.resizeHandler = null;
    this.extraPointersAdded = false;
    this.lastMobileControlLayout = {
      width: 0,
      height: 0,
      isPortrait: null
    };

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

    this.ballSprite = null;
    this.ballState = {
      x: 1024,
      y: 820,
      targetX: 1024,
      targetY: 820,
      vx: 0,
      vy: 0,
      hasServerSnapshot: false
    };
    this.BALL_SCALE = 0.18;
    this.leftScoreText = null;
    this.rightScoreText = null;
    this.scoreboardSprite = null;
    this.topGoalSprite = null;
    this.bottomGoalSprite = null;
    this.SCOREBOARD_X = 1462.3;
    this.SCOREBOARD_Y = 210.23;
    this.TOP_GOAL_X = 831.79;
    this.TOP_GOAL_Y = 227.42;
    this.BOTTOM_GOAL_X = 1347.2;
    this.BOTTOM_GOAL_Y = 875.89;
    this.SCOREBOARD_SCALE = 0.9;
    this.GOAL_SCALE = 0.72;
    this.LEFT_SCORE_OFFSET_X = -101;
    this.RIGHT_SCORE_OFFSET_X = 101;
    this.SCORE_OFFSET_Y = 1;

    this.playerData = {
      name: 'Player',
      dogType: 'Remix'
    };

    this.localLastSafePosition = {
      x: 1024,
      y: 1024
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
    this.load.image('ball', 'misc_assets/ball.png');
    this.load.image('goal_lefttop', 'misc_assets/goal_lefttop.png');
    this.load.image('goal_rightbottom', 'misc_assets/goal_rightbottom.png');
    this.load.image('scoreboard', 'misc_assets/scoreboard.png');

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
    this.updateCameraZoom();

    this.createDogAnimations();
    this.buildIslandCollisionMask();
    this.createBall();
    this.createSoccerMiniGameDecorations();

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
    }

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D');
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

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

    this.resizeHandler = () => this.handleViewportResize();
    this.scale.on('resize', this.resizeHandler);

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

  createBall() {
    this.ballSprite = this.add.image(
      this.ballState.x,
      this.ballState.y,
      'ball'
    );
    this.ballSprite.setScale(this.BALL_SCALE);
    this.ballSprite.setDepth(60);
  }

  createSoccerMiniGameDecorations() {
    this.scoreboardSprite = this.add.image(this.SCOREBOARD_X, this.SCOREBOARD_Y, 'scoreboard');
    this.scoreboardSprite.setOrigin(0.5, 0.5);
    this.scoreboardSprite.setScale(this.SCOREBOARD_SCALE);
    this.scoreboardSprite.setDepth(15);

    this.topGoalSprite = this.add.image(this.TOP_GOAL_X, this.TOP_GOAL_Y, 'goal_lefttop');
    this.topGoalSprite.setOrigin(0.5, 0.5);
    this.topGoalSprite.setScale(this.GOAL_SCALE);
    this.topGoalSprite.setDepth(12);

    this.bottomGoalSprite = this.add.image(this.BOTTOM_GOAL_X, this.BOTTOM_GOAL_Y, 'goal_rightbottom');
    this.bottomGoalSprite.setOrigin(0.5, 0.5);
    this.bottomGoalSprite.setScale(this.GOAL_SCALE);
    this.bottomGoalSprite.setDepth(12);

    const scoreTextStyle = {
      fontSize: '56px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 6,
      align: 'center',
      shadow: {
        offsetX: 0,
        offsetY: 0,
        color: '#000000',
        blur: 4,
        fill: true
      }
    };

    this.leftScoreText = this.add.text(0, 0, '0', scoreTextStyle);
    this.leftScoreText.setOrigin(0.5, 0.5);
    this.leftScoreText.setDepth(16);

    this.rightScoreText = this.add.text(0, 0, '0', scoreTextStyle);
    this.rightScoreText.setOrigin(0.5, 0.5);
    this.rightScoreText.setDepth(16);

    this.updateScoreTextPositionsFromScoreboard();
  }

  updateScoreTextPositionsFromScoreboard() {
    if (!this.scoreboardSprite || !this.leftScoreText || !this.rightScoreText) {
      return;
    }

    this.leftScoreText.setPosition(
      this.scoreboardSprite.x + this.LEFT_SCORE_OFFSET_X,
      this.scoreboardSprite.y + this.SCORE_OFFSET_Y
    );

    this.rightScoreText.setPosition(
      this.scoreboardSprite.x + this.RIGHT_SCORE_OFFSET_X,
      this.scoreboardSprite.y + this.SCORE_OFFSET_Y
    );
  }

  applyBallState(ballSnapshot) {
    if (!ballSnapshot || !Number.isFinite(ballSnapshot.x) || !Number.isFinite(ballSnapshot.y)) {
      return;
    }

    this.ballState.targetX = ballSnapshot.x;
    this.ballState.targetY = ballSnapshot.y;
    this.ballState.vx = Number.isFinite(ballSnapshot.vx) ? ballSnapshot.vx : 0;
    this.ballState.vy = Number.isFinite(ballSnapshot.vy) ? ballSnapshot.vy : 0;

    if (this.ballSprite && !this.ballState.hasServerSnapshot) {
      this.ballSprite.setPosition(this.ballState.targetX, this.ballState.targetY);
    }

    this.ballState.hasServerSnapshot = true;
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
      this.localLastSafePosition.x = playerData.x;
      this.localLastSafePosition.y = playerData.y;
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
    if (worldState && typeof worldState === 'object' && worldState.ball) {
      this.applyBallState(worldState.ball);
    }
    if (worldState && typeof worldState === 'object' && worldState.scores) {
      if (this.leftScoreText && Number.isFinite(worldState.scores.left)) {
        this.leftScoreText.setText(String(worldState.scores.left));
      }
      if (this.rightScoreText && Number.isFinite(worldState.scores.right)) {
        this.rightScoreText.setText(String(worldState.scores.right));
      }
    }

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

  findNearestWalkablePosition(startX, startY, maxRadius = 140, radiusStep = 6) {
    if (this.canPlayerOccupy(startX, startY)) {
      return { x: startX, y: startY };
    }

    const angleStep = Math.PI / 8;
    for (let radius = radiusStep; radius <= maxRadius; radius += radiusStep) {
      for (let angle = 0; angle < (Math.PI * 2); angle += angleStep) {
        const candidateX = startX + (Math.cos(angle) * radius);
        const candidateY = startY + (Math.sin(angle) * radius);

        if (this.canPlayerOccupy(candidateX, candidateY)) {
          return { x: candidateX, y: candidateY };
        }
      }
    }

    return null;
  }

  ensureLocalPlayerOnWalkableGround(localPlayer) {
    if (!localPlayer || !localPlayer.sprite) {
      return;
    }

    const currentX = localPlayer.sprite.x;
    const currentY = localPlayer.sprite.y;

    if (this.canPlayerOccupy(currentX, currentY)) {
      this.localLastSafePosition.x = currentX;
      this.localLastSafePosition.y = currentY;
      return;
    }

    const nearest = this.findNearestWalkablePosition(currentX, currentY);
    if (nearest) {
      localPlayer.sprite.setPosition(nearest.x, nearest.y);
      this.localLastSafePosition.x = nearest.x;
      this.localLastSafePosition.y = nearest.y;
      return;
    }

    localPlayer.sprite.setPosition(this.localLastSafePosition.x, this.localLastSafePosition.y);
  }

  applyJumpEdgePushback(localPlayer) {
    if (!localPlayer || !localPlayer.sprite) {
      return false;
    }

    const playerX = localPlayer.sprite.x;
    const playerY = localPlayer.sprite.y;
    const probeRadius = 44;
    const directions = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
      { x: 0.7071, y: 0.7071 },
      { x: -0.7071, y: 0.7071 },
      { x: 0.7071, y: -0.7071 },
      { x: -0.7071, y: -0.7071 }
    ];

    const pushVector = new Phaser.Math.Vector2(0, 0);
    directions.forEach((direction) => {
      const sampleX = playerX + (direction.x * probeRadius);
      const sampleY = playerY + (direction.y * probeRadius);

      if (this.isBlockedAtWorldPoint(sampleX, sampleY)) {
        // Repel away from blocked edge samples.
        pushVector.x -= direction.x;
        pushVector.y -= direction.y;
      }
    });

    if (pushVector.lengthSq() < 0.01) {
      return false;
    }

    pushVector.normalize();
    const pushDistance = 18;
    const targetX = playerX + (pushVector.x * pushDistance);
    const targetY = playerY + (pushVector.y * pushDistance);

    if (this.canPlayerOccupy(targetX, targetY)) {
      localPlayer.sprite.setPosition(targetX, targetY);
      this.localLastSafePosition.x = targetX;
      this.localLastSafePosition.y = targetY;
      return true;
    }

    const nearest = this.findNearestWalkablePosition(targetX, targetY, 80, 4);
    if (nearest) {
      localPlayer.sprite.setPosition(nearest.x, nearest.y);
      this.localLastSafePosition.x = nearest.x;
      this.localLastSafePosition.y = nearest.y;
      return true;
    }

    return false;
  }

  getIsSprinting() {
    return Boolean((this.shiftKey && this.shiftKey.isDown) || this.mobileSprintHeld);
  }

  resolveJumpLandingPosition(startX, startY, directionX, directionY, jumpDistance) {
    const hasDirection = Math.abs(directionX) > 0.001 || Math.abs(directionY) > 0.001;
    const jumpVector = new Phaser.Math.Vector2(
      hasDirection ? directionX : 0,
      hasDirection ? directionY : -1
    ).normalize();

    const desiredLandingX = startX + (jumpVector.x * jumpDistance);
    const desiredLandingY = startY + (jumpVector.y * jumpDistance);

    if (this.canPlayerOccupy(desiredLandingX, desiredLandingY)) {
      return { x: desiredLandingX, y: desiredLandingY };
    }

    // Find the furthest valid point along the jump path before obstacles.
    for (let step = 7; step >= 1; step -= 1) {
      const t = step / 8;
      const sampleX = startX + ((desiredLandingX - startX) * t);
      const sampleY = startY + ((desiredLandingY - startY) * t);
      if (this.canPlayerOccupy(sampleX, sampleY)) {
        return { x: sampleX, y: sampleY };
      }
    }

    const nearest = this.findNearestWalkablePosition(desiredLandingX, desiredLandingY, 72, 4);
    if (nearest) {
      return nearest;
    }

    return { x: startX, y: startY };
  }

  getViewportFlags() {
    if (window.FlynnViewportScaler && typeof window.FlynnViewportScaler.resolveViewportFlags === 'function') {
      return window.FlynnViewportScaler.resolveViewportFlags(this.scale.width, this.scale.height);
    }

    return {
      isPortrait: this.scale.height > this.scale.width,
      isTablet: false,
      hasTouch: this.sys.game.device.input.touch
    };
  }

  calculateCameraZoom() {
    const flags = this.getViewportFlags();
    const width = this.scale.width;
    const height = this.scale.height;
    const minSide = Math.min(width, height);
    const aspect = width / Math.max(height, 1);

    let zoom = Phaser.Math.Clamp(0.76 + ((minSide - 700) / 500) * 0.2, 0.72, 0.98);

    if (flags.isPortrait) {
      zoom += flags.isTablet ? 0.08 : 0.12;
    }

    if (aspect > 1.8) {
      zoom -= 0.06;
    }

    return Phaser.Math.Clamp(zoom, 0.72, 1.05);
  }

  updateCameraZoom() {
    this.cameras.main.setZoom(this.calculateCameraZoom());
  }

  handleViewportResize() {
    this.updateCameraZoom();
    this.createEmoteButtons();

    if (this.shouldRebuildMobileControls()) {
      this.createMobileControls();
    }
  }

  shouldRebuildMobileControls() {
    if (!this.sys.game.device.input.touch) {
      return false;
    }

    if (!this.joystickBase || !this.jumpButton || !this.sprintButton) {
      return true;
    }

    if (this.joystickPointer && this.joystickPointer.isDown) {
      return false;
    }

    const currentWidth = this.scale.width;
    const currentHeight = this.scale.height;
    const currentIsPortrait = currentHeight >= currentWidth;
    const widthDelta = Math.abs(currentWidth - this.lastMobileControlLayout.width);
    const heightDelta = Math.abs(currentHeight - this.lastMobileControlLayout.height);

    if (this.lastMobileControlLayout.isPortrait !== currentIsPortrait) {
      return true;
    }

    return widthDelta > 120 || heightDelta > 120;
  }

  createEmoteButtons() {
    this.clearEmoteButtons();

    const emojis = ['❤️', '😂', '😭', '😡', '🐾', '❗'];

    const viewportWidth = this.scale.width;
    const viewportHeight = this.scale.height;
    const isTouchDevice = this.sys.game.device.input.touch;

    const sidePadding = 16;
    const buttonSpacing = Phaser.Math.Clamp(Math.floor(viewportWidth * 0.012), 6, 10);
    const maxButtonSizeByWidth = Math.floor(
      (viewportWidth - (sidePadding * 2) - (buttonSpacing * 5)) / 6
    );
    const buttonSize = Phaser.Math.Clamp(maxButtonSizeByWidth, 44, 60);
    const totalWidth = (buttonSize * 6) + (buttonSpacing * 5);

    const firstCenterX = ((viewportWidth - totalWidth) / 2) + (buttonSize / 2);
    const yPosition = isTouchDevice ? (viewportHeight - 220) : (viewportHeight - 68);

    emojis.forEach((emoji, index) => {
      const xPosition = firstCenterX + (index * (buttonSize + buttonSpacing));

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
          stroke: '#ffffff',
          strokeThickness: 4,
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

      this.emoteButtonElements.push(buttonBg, emojiText);
    });
  }

  clearEmoteButtons() {
    this.emoteButtonElements.forEach((element) => {
      if (element && element.active) {
        element.destroy();
      }
    });

    this.emoteButtonElements = [];
  }

  createMobileControls() {
    this.clearMobileControls();

    const isTouchDevice = this.sys.game.device.input.touch;
    if (!isTouchDevice) {
      return;
    }

    if (!this.extraPointersAdded) {
      this.input.addPointer(2);
      this.extraPointersAdded = true;
    }

    const viewportWidth = this.scale.width;
    const viewportHeight = this.scale.height;
    const controlScale = Phaser.Math.Clamp(Math.min(viewportWidth, viewportHeight) / 768, 0.75, 1);

    const baseRadius = Math.round(80 * controlScale);
    const thumbRadius = Math.round(40 * controlScale);
    const jumpRadius = Math.round(60 * controlScale);
    const sprintRadius = Math.round(44 * controlScale);
    const controlY = viewportHeight - (jumpRadius + 24);
    const sideX = Math.max(baseRadius + 24, viewportWidth * 0.15);

    const joystickX = sideX;
    const joystickY = controlY;

    this.joystickMaxDistance = Math.round(70 * controlScale);

    this.joystickBase = this.add.circle(joystickX, joystickY, baseRadius, 0x222222, 0.35);
    this.joystickBase.setStrokeStyle(3, 0xffffff, 0.35);
    this.joystickBase.setScrollFactor(0);
    this.joystickBase.setDepth(1000);

    this.joystickThumb = this.add.circle(joystickX, joystickY, thumbRadius, 0xffffff, 0.55);
    this.joystickThumb.setScrollFactor(0);
    this.joystickThumb.setDepth(1001);

    const jumpX = viewportWidth - sideX;
    const jumpY = controlY;
    const sprintX = jumpX;
    const sprintY = jumpY - jumpRadius - sprintRadius - Math.round(16 * controlScale);

    this.jumpButton = this.add.circle(jumpX, jumpY, jumpRadius, 0x4CAF50, 0.5);
    this.jumpButton.setStrokeStyle(3, 0xffffff, 0.6);
    this.jumpButton.setScrollFactor(0);
    this.jumpButton.setDepth(1000);
    this.jumpButton.setInteractive({ useHandCursor: false });

    const jumpLabel = this.add.text(jumpX, jumpY, 'JUMP', {
      fontSize: `${Math.round(22 * controlScale)}px`,
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    });
    jumpLabel.setOrigin(0.5, 0.5);
    jumpLabel.setScrollFactor(0);
    jumpLabel.setDepth(1001);
    this.mobileControlElements.push(this.joystickBase, this.joystickThumb, this.jumpButton, jumpLabel);

    this.sprintButton = this.add.circle(sprintX, sprintY, sprintRadius, 0x0f766e, 0.55);
    this.sprintButton.setStrokeStyle(3, 0xffffff, 0.6);
    this.sprintButton.setScrollFactor(0);
    this.sprintButton.setDepth(1000);
    this.sprintButton.setInteractive({ useHandCursor: false });

    const sprintLabel = this.add.text(sprintX, sprintY, 'RUN', {
      fontSize: `${Math.round(18 * controlScale)}px`,
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    });
    sprintLabel.setOrigin(0.5, 0.5);
    sprintLabel.setScrollFactor(0);
    sprintLabel.setDepth(1001);
    this.mobileControlElements.push(this.sprintButton, sprintLabel);

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

    this.sprintButton.on('pointerdown', () => {
      this.mobileSprintHeld = true;
      this.sprintButton.setFillStyle(0x14b8a6, 0.85);
    });

    this.sprintButton.on('pointerup', () => {
      this.mobileSprintHeld = false;
      this.sprintButton.setFillStyle(0x0f766e, 0.55);
    });

    this.sprintButton.on('pointerupoutside', () => {
      this.mobileSprintHeld = false;
      this.sprintButton.setFillStyle(0x0f766e, 0.55);
    });

    this.sprintButton.on('pointerout', () => {
      if (!this.mobileSprintHeld) {
        this.sprintButton.setFillStyle(0x0f766e, 0.55);
      }
    });

    this.mobileControlHandlers = {
      pointerdown: (pointer) => {
        if (this.joystickPointer) {
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
        if (distanceFromBase > (baseRadius + (60 * controlScale))) {
          return;
        }

        this.joystickPointer = pointer;
        this.joystickPointerId = pointer.id;
        this.updateJoystick(pointer);
      },
      pointermove: (pointer) => {
        if (pointer !== this.joystickPointer) {
          return;
        }

        this.updateJoystick(pointer);
      },
      pointerup: (pointer) => {
        if (pointer !== this.joystickPointer) {
          return;
        }

        this.resetJoystick();
      },
      pointerupoutside: (pointer) => {
        if (pointer !== this.joystickPointer) {
          return;
        }

        this.resetJoystick();
      }
    };

    this.input.on('pointerdown', this.mobileControlHandlers.pointerdown);
    this.input.on('pointermove', this.mobileControlHandlers.pointermove);
    this.input.on('pointerup', this.mobileControlHandlers.pointerup);
    this.input.on('pointerupoutside', this.mobileControlHandlers.pointerupoutside);

    this.lastMobileControlLayout.width = this.scale.width;
    this.lastMobileControlLayout.height = this.scale.height;
    this.lastMobileControlLayout.isPortrait = this.scale.height >= this.scale.width;
  }

  clearMobileControls() {
    if (this.mobileControlHandlers) {
      this.input.off('pointerdown', this.mobileControlHandlers.pointerdown);
      this.input.off('pointermove', this.mobileControlHandlers.pointermove);
      this.input.off('pointerup', this.mobileControlHandlers.pointerup);
      this.input.off('pointerupoutside', this.mobileControlHandlers.pointerupoutside);
      this.mobileControlHandlers = null;
    }

    this.mobileControlElements.forEach((element) => {
      if (element && element.active) {
        element.destroy();
      }
    });

    this.mobileControlElements = [];
    this.joystickBase = null;
    this.joystickThumb = null;
    this.jumpButton = null;
    this.sprintButton = null;
    this.mobileJumpRequested = false;
    this.mobileSprintHeld = false;
    this.lastMobileControlLayout.width = 0;
    this.lastMobileControlLayout.height = 0;
    this.lastMobileControlLayout.isPortrait = null;
    this.resetJoystick();
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
    this.joystickPointer = null;
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
      this.interpolateBall(delta);
      return;
    }

    if ((Phaser.Input.Keyboard.JustDown(this.spaceKey) || this.mobileJumpRequested) && !this.isJumping) {
      const didPushFromEdge = this.applyJumpEdgePushback(localPlayer);
      if (didPushFromEdge) {
        this.updateAllPlayerDecorations();
      }

      this.isJumping = true;
      this.playEntityAnimation(localPlayer, 'jump');

      if (this.jumpTween) {
        this.jumpTween.stop();
        this.jumpTween = null;
      }

      const jumpStartY = localPlayer.sprite.y;
      const jumpStartX = localPlayer.sprite.x;
      const sprintingNow = this.getIsSprinting();
      const jumpWasDirectional = this.moveVector.lengthSq() > 0;
      const jumpDistance = this.JUMP_TRAVEL_DISTANCE * (sprintingNow ? 1.15 : 1);
      const jumpLanding = this.resolveJumpLandingPosition(
        jumpStartX,
        jumpStartY,
        this.moveVector.x,
        this.moveVector.y,
        jumpDistance
      );
      const jumpApexX = (jumpStartX + jumpLanding.x) / 2;
      const jumpApexY = Math.min(jumpStartY, jumpLanding.y) - 52;

      this.jumpTween = this.tweens.add({
        targets: localPlayer.sprite,
        x: jumpApexX,
        y: jumpApexY,
        duration: 160,
        ease: 'Sine.easeOut',
        onComplete: () => {
          this.jumpTween = this.tweens.add({
            targets: localPlayer.sprite,
            x: jumpLanding.x,
            y: jumpLanding.y,
            duration: 160,
            ease: 'Sine.easeIn',
            onComplete: () => {
              this.jumpTween = null;
              localPlayer.sprite.x = jumpLanding.x;
              localPlayer.sprite.y = jumpLanding.y;
              this.isJumping = false;
              this.ensureLocalPlayerOnWalkableGround(localPlayer);
              this.updateAllPlayerDecorations();

              const landingAnimation = jumpWasDirectional
                ? (sprintingNow ? 'run' : 'walk')
                : 'stand';
              this.sendNetworkInput(this.time.now, landingAnimation, true);
            }
          });
        }
      });

      this.mobileJumpRequested = false;
      this.updateAllPlayerDecorations();
      this.interpolateBall(delta);
      this.sendNetworkInput(time, 'jump', true);
      return;
    }
    this.mobileJumpRequested = false;

    if (this.isJumping) {
      this.updateAllPlayerDecorations();
      this.interpolateRemotePlayers(delta);
      this.interpolateBall(delta);
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

    if (this.joystickPointer && this.joystickPointer.isDown) {
      this.updateJoystick(this.joystickPointer);
    } else if (this.joystickPointer && !this.joystickPointer.isDown) {
      this.resetJoystick();
    }

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

    const isSprinting = this.getIsSprinting() && this.moveVector.lengthSq() > 0;
    const moveSpeed = this.SPEED * (isSprinting ? this.SPRINT_MULTIPLIER : 1);
    const moveStep = moveSpeed * (delta / 1000);
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
      this.playEntityAnimation(localPlayer, isSprinting ? 'run' : 'walk');
    } else {
      this.playEntityAnimation(localPlayer, 'stand');
    }

    this.ensureLocalPlayerOnWalkableGround(localPlayer);
    this.interpolateRemotePlayers(delta);
    this.interpolateBall(delta);
    this.updateAllPlayerDecorations();

    this.sendNetworkInput(time, isMoving ? (isSprinting ? 'run' : 'walk') : 'stand');
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

  interpolateBall(delta) {
    if (!this.ballSprite) {
      return;
    }

    const smoothing = Phaser.Math.Clamp((delta / 1000) * 14, 0, 1);

    this.ballSprite.x = Phaser.Math.Linear(this.ballSprite.x, this.ballState.targetX, smoothing);
    this.ballSprite.y = Phaser.Math.Linear(this.ballSprite.y, this.ballState.targetY, smoothing);

    const speed = Math.sqrt((this.ballState.vx * this.ballState.vx) + (this.ballState.vy * this.ballState.vy));
    const rollDirection = this.ballState.vx < 0 ? -1 : 1;
    this.ballSprite.rotation += ((speed / 650) * (delta / 16.6667)) * 0.08 * rollDirection;
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
        stroke: '#ffffff',
        strokeThickness: 6,
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
    if (this.resizeHandler) {
      this.scale.off('resize', this.resizeHandler);
      this.resizeHandler = null;
    }

    if (this.network && typeof this.network.disconnect === 'function') {
      this.network.disconnect();
    }

    Object.keys(this.players).forEach((playerId) => {
      this.removePlayer(playerId);
    });

    this.players = {};
    this.clearEmoteButtons();
    this.clearMobileControls();
    this.extraPointersAdded = false;

    if (this.jumpTween) {
      this.jumpTween.stop();
      this.jumpTween = null;
    }
    this.isJumping = false;

    if (this.ballSprite) {
      this.ballSprite.destroy();
      this.ballSprite = null;
    }
  }
}
