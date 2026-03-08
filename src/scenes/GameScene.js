// ============================================
// GAME SCENE
// ============================================

const FALLBACK_ISLAND_WORLD_CONFIG = Object.freeze({
  worldBounds: Object.freeze({
    x: 0,
    y: 0,
    width: 4096,
    height: 4096
  }),
  spawn: Object.freeze({
    x: 2048,
    y: 2048
  }),
  islandArt: Object.freeze({
    textureKey: 'island',
    imagePath: 'misc_assets/island-4096.png',
    requestPath: 'misc_assets/island-4096.png',
    centerX: 2048,
    centerY: 2048
  }),
  collisionMask: Object.freeze({
    textureKey: 'islandedge',
    imagePath: 'misc_assets/island-4096-edge.png',
    requestPath: 'misc_assets/island-4096-edge.png',
    offsetX: 0,
    offsetY: 0,
    blockedColorThreshold: 12
  })
});

const FALLBACK_RACING_CONFIG = Object.freeze({
  trackMask: Object.freeze({
    imagePath: 'misc_assets/racing/racetrack-mask.png',
    blockedColorThreshold: 12
  }),
  cars: Object.freeze([]),
  physics: Object.freeze({
    trailLifetimeMs: 2600,
    trailMinDistance: 12,
    trailMinSpeed: 170,
    trailTurnThreshold: 0.45,
    trailAlpha: 0.4,
    trailWidth: 2
  })
});

const FALLBACK_FETCH_CONFIG = Object.freeze({
  ball: Object.freeze({
    id: 'island-tennis-ball',
    textureKey: 'tennisball',
    imagePath: 'misc_assets/tennisball.png',
    requestPath: 'misc_assets/tennisball.png',
    displayScale: 0.0225,
    hudScale: 0.0135,
    radius: 22,
    holdOffsetX: 48,
    holdOffsetY: -6,
    dropOffsetY: 12
  }),
  interaction: Object.freeze({
    pickupRadius: 88,
    promptRadius: 88
  }),
  spawn: Object.freeze({
    attempts: 84,
    margin: 40,
    minDistanceFromSpawn: 150,
    anchorRadius: 280,
    searchRadius: 240,
    searchStep: 10
  }),
  physics: Object.freeze({
    throwSpeed: 760,
    rollingDrag: 340,
    maxSpeed: 920,
    minSpeed: 6,
    wallBounce: 0.74,
    carBounce: 0.88,
    playerBounce: 0.54,
    carVelocityTransfer: 0.18,
    playerVelocityTransfer: 0.08,
    nudgeImpulse: 210,
    nudgeSpeedThreshold: 32,
    nudgeSpeedFactor: 0.12,
    playerCollisionRadius: 34,
    playerCollisionOffsetY: 34,
    carCollisionPadding: 10,
    sweepStep: 8,
    maxStepDistance: 14,
    pickupCooldownMs: 180
  }),
  throwDirections: Object.freeze([
    Object.freeze({ id: 'up', label: 'Up', emoji: '⬆️', x: 0, y: -1 }),
    Object.freeze({ id: 'right', label: 'Right', emoji: '➡️', x: 1, y: 0 }),
    Object.freeze({ id: 'down', label: 'Down', emoji: '⬇️', x: 0, y: 1 }),
    Object.freeze({ id: 'left', label: 'Left', emoji: '⬅️', x: -1, y: 0 })
  ])
});

function getIslandWorldConfig() {
  if (window.FlynnIslandWorldConfig && window.FlynnIslandWorldConfig.worldBounds) {
    return window.FlynnIslandWorldConfig;
  }

  return FALLBACK_ISLAND_WORLD_CONFIG;
}

function getRacingConfig() {
  if (window.FlynnRacingConfig && Array.isArray(window.FlynnRacingConfig.cars)) {
    return window.FlynnRacingConfig;
  }

  return FALLBACK_RACING_CONFIG;
}

function getRacingShared() {
  if (window.FlynnRacingShared) {
    return window.FlynnRacingShared;
  }

  return null;
}

function getFetchConfig() {
  if (window.FlynnFetchConfig && window.FlynnFetchConfig.ball) {
    return window.FlynnFetchConfig;
  }

  return FALLBACK_FETCH_CONFIG;
}

function getFetchShared() {
  if (window.FlynnFetchShared) {
    return window.FlynnFetchShared;
  }

  return null;
}

class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });

    this.players = {};
    this.localPlayerId = 'local';

    this.cursors = null;
    this.keys = null;
    this.spaceKey = null;
    this.shiftKey = null;
    this.interactKey = null;
    this.dropKey = null;
    this.escapeKey = null;

    this.isJumping = false;
    this.jumpTween = null;
    this.pendingCarExitRequest = false;
    this.PLAYER_SCALE = 0.3;
    this.SPEED = 200;
    this.SPRINT_MULTIPLIER = 1.65;
    this.JUMP_TRAVEL_DISTANCE = 44;
    this.PLAYER_COLLISION_RADIUS = 18;
    this.PLAYER_COLLISION_OFFSET_Y = 72;
    this.PLAYER_TORSO_COLLISION_RADIUS = 22;
    this.PLAYER_TORSO_COLLISION_OFFSET_Y = 38;
    this.COLLISION_SWEEP_STEP = 4;
    this.UI_DEPTH = 20000;
    this.UI_OVERLAY_DEPTH = 21000;
    this.hasWarnedMissingIslandMask = false;

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
    this.jumpButtonLabel = null;
    this.sprintButtonLabel = null;
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
    this.NETWORK_SEND_INTERVAL_MS = 33;

    this.DOG_KEYS = ['alice', 'remix', 'sapphire', 'wendy'];
    this.DOG_LABELS = {
      alice: 'Alice',
      remix: 'Remix',
      sapphire: 'Sapphire',
      wendy: 'Wendy'
    };
    this.worldConfig = getIslandWorldConfig();
    this.racingConfig = getRacingConfig();
    this.racingShared = getRacingShared();
    this.fetchConfig = getFetchConfig();
    this.fetchShared = getFetchShared();
    this.carDefinitions = Array.isArray(this.racingConfig.cars) ? this.racingConfig.cars : [];
    this.carDefinitionMap = new Map(this.carDefinitions.map((definition) => [definition.id, definition]));
    this.spawnPoint = {
      x: this.worldConfig.spawn.x,
      y: this.worldConfig.spawn.y
    };

    this.worldBounds = {
      x: this.worldConfig.worldBounds.x,
      y: this.worldConfig.worldBounds.y,
      width: this.worldConfig.worldBounds.width,
      height: this.worldConfig.worldBounds.height
    };

    this.islandMaskPixels = null;
    this.islandMaskWidth = 0;
    this.islandMaskHeight = 0;
    this.cars = {};
    this.tireTrackGraphics = null;
    this.tireTrackSegments = [];
    this.carExitHintText = null;
    this.currentControlMode = 'foot';
    this.fetchBall = null;
    this.fetchPromptUi = null;
    this.fetchHudUi = null;
    this.throwHudUi = null;
    this.throwHudOpen = false;
    this.throwHudBallTween = null;
    this.fetchUiPointerHandler = null;
    this.topMessageUi = null;
    this.topMessageQueue = [];
    this.activeTopMessageTween = null;
    this.hasReceivedNetworkWorldState = false;

    this.playerData = {
      name: 'Player',
      dogType: 'Remix'
    };

    this.localLastSafePosition = {
      x: this.spawnPoint.x,
      y: this.spawnPoint.y
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
    if (window.FlynnGameAssetLoader && typeof window.FlynnGameAssetLoader.queueGameAssets === 'function') {
      window.FlynnGameAssetLoader.queueGameAssets(
        this,
        this.worldConfig,
        this.racingConfig,
        this.DOG_KEYS,
        this.fetchConfig
      );
      return;
    }

    this.load.image(
      this.worldConfig.islandArt.textureKey,
      this.worldConfig.islandArt.requestPath || this.worldConfig.islandArt.imagePath
    );
    this.load.image(
      this.worldConfig.collisionMask.textureKey,
      this.worldConfig.collisionMask.requestPath || this.worldConfig.collisionMask.imagePath
    );
    this.loadDogAssets(this.DOG_KEYS);

    this.carDefinitions.forEach((definition) => {
      this.load.image(
        definition.textureKey,
        definition.requestPath || definition.imagePath
      );
    });

    this.load.image(
      this.fetchConfig.ball.textureKey,
      this.fetchConfig.ball.requestPath || this.fetchConfig.ball.imagePath
    );
  }

  create() {
    const island = this.add.image(
      this.worldConfig.islandArt.centerX,
      this.worldConfig.islandArt.centerY,
      this.worldConfig.islandArt.textureKey
    );
    island.setOrigin(0.5, 0.5);

    this.physics.world.setBounds(
      this.worldBounds.x,
      this.worldBounds.y,
      this.worldBounds.width,
      this.worldBounds.height
    );

    this.cameras.main.setBounds(
      this.worldBounds.x,
      this.worldBounds.y,
      this.worldBounds.width,
      this.worldBounds.height
    );
    this.updateCameraZoom();

    this.createDogAnimations();
    this.buildIslandCollisionMask();
    this.createRacingEntities();
    this.spawnPoint = this.resolveInitialSpawnPoint();
    this.localLastSafePosition = {
      x: this.spawnPoint.x,
      y: this.spawnPoint.y
    };

    this.setupNetworkBridge();

    this.addOrUpdatePlayer({
      id: this.localPlayerId,
      name: this.playerData.name,
      dogType: this.playerData.dogType,
      x: this.spawnPoint.x,
      y: this.spawnPoint.y,
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
    this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.dropKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    this.escapeKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

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
    this.createFetchSystems();
    this.updateControlModeUi();
    this.updateCarExitHintPosition();

    this.resizeHandler = () => this.handleViewportResize();
    this.scale.on('resize', this.resizeHandler);

    this.events.once('shutdown', this.handleSceneShutdown, this);
    this.events.once('destroy', this.handleSceneShutdown, this);
  }

  loadDogAssets(dogKeys) {
    const keys = Array.isArray(dogKeys) ? dogKeys : [dogKeys];

    keys.forEach((dogKey) => {
      this.load.image(`${dogKey}_stand`, `sprites/dogs/${dogKey}/${dogKey}_stand.png`);
      this.load.image(`${dogKey}_sit`, `sprites/dogs/${dogKey}/${dogKey}_sit.png`);
      this.load.image(`${dogKey}_walk1`, `sprites/dogs/${dogKey}/${dogKey}_walk1.png`);
      this.load.image(`${dogKey}_walk2`, `sprites/dogs/${dogKey}/${dogKey}_walk2.png`);
      this.load.image(`${dogKey}_walk3`, `sprites/dogs/${dogKey}/${dogKey}_walk3.png`);
      this.load.image(`${dogKey}_run1`, `sprites/dogs/${dogKey}/${dogKey}_run1.png`);
      this.load.image(`${dogKey}_run2`, `sprites/dogs/${dogKey}/${dogKey}_run2.png`);
      this.load.image(`${dogKey}_jump_up`, `sprites/dogs/${dogKey}/${dogKey}_jump_up.png`);
      this.load.image(`${dogKey}_jump_down`, `sprites/dogs/${dogKey}/${dogKey}_jump_down.png`);
    });
  }

  buildIslandCollisionMask() {
    const maskTexture = this.textures.get(this.worldConfig.collisionMask.textureKey);
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
    this.hasWarnedMissingIslandMask = false;
  }

  resolveInitialSpawnPoint() {
    const configuredSpawn = this.worldConfig.spawn;
    const walkableSpawn = this.findNearestWalkablePosition(
      configuredSpawn.x,
      configuredSpawn.y,
      220,
      8
    );

    return walkableSpawn || {
      x: configuredSpawn.x,
      y: configuredSpawn.y
    };
  }

  isBlockedAtWorldPoint(worldX, worldY) {
    if (!this.islandMaskPixels) {
      if (!this.hasWarnedMissingIslandMask) {
        console.warn('Island collision mask is unavailable on client; blocking movement until mask is loaded.');
        this.hasWarnedMissingIslandMask = true;
      }
      return true;
    }

    const pixelX = Math.floor(worldX + this.worldConfig.collisionMask.offsetX);
    const pixelY = Math.floor(worldY + this.worldConfig.collisionMask.offsetY);

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

    const blockedColorThreshold = this.worldConfig.collisionMask.blockedColorThreshold;
    return r < blockedColorThreshold && g < blockedColorThreshold && b < blockedColorThreshold;
  }

  canPlayerOccupy(worldX, worldY) {
    const points = this.getPlayerCollisionProbePoints(worldX, worldY);

    for (const point of points) {
      if (this.isBlockedAtWorldPoint(point.x, point.y)) {
        return false;
      }
    }

    return true;
  }

  getPlayerCollisionProbePoints(worldX, worldY) {
    return [
      ...this.buildCollisionProbeRing(
        worldX,
        worldY + this.PLAYER_COLLISION_OFFSET_Y,
        this.PLAYER_COLLISION_RADIUS
      ),
      ...this.buildCollisionProbeRing(
        worldX,
        worldY + this.PLAYER_TORSO_COLLISION_OFFSET_Y,
        this.PLAYER_TORSO_COLLISION_RADIUS
      )
    ];
  }

  buildCollisionProbeRing(originX, originY, radius) {
    const diagonalRadius = radius * 0.78;
    const innerRadius = radius * 0.5;

    return [
      { x: originX, y: originY },
      { x: originX + radius, y: originY },
      { x: originX - radius, y: originY },
      { x: originX, y: originY + radius },
      { x: originX, y: originY - radius },
      { x: originX + diagonalRadius, y: originY + diagonalRadius },
      { x: originX - diagonalRadius, y: originY + diagonalRadius },
      { x: originX + diagonalRadius, y: originY - diagonalRadius },
      { x: originX - diagonalRadius, y: originY - diagonalRadius },
      { x: originX + innerRadius, y: originY },
      { x: originX - innerRadius, y: originY },
      { x: originX, y: originY + innerRadius },
      { x: originX, y: originY - innerRadius }
    ];
  }

  sweepToWalkablePosition(startX, startY, targetX, targetY, stepSize = this.COLLISION_SWEEP_STEP) {
    const deltaX = targetX - startX;
    const deltaY = targetY - startY;
    const distance = Math.sqrt((deltaX * deltaX) + (deltaY * deltaY));
    const steps = Math.max(1, Math.ceil(distance / Math.max(stepSize, 1)));

    let lastWalkableX = startX;
    let lastWalkableY = startY;

    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps;
      const sampleX = startX + (deltaX * t);
      const sampleY = startY + (deltaY * t);

      if (!this.canPlayerOccupy(sampleX, sampleY)) {
        break;
      }

      lastWalkableX = sampleX;
      lastWalkableY = sampleY;
    }

    return {
      x: lastWalkableX,
      y: lastWalkableY
    };
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

    if (typeof this.network.onUiMessage === 'function') {
      this.network.onUiMessage((payload) => {
        if (payload?.text) {
          this.queueTopMessage(payload.text, {
            durationMs: payload.durationMs
          });
        }
      });
    }

    this.localPlayerId = this.network.connect({
      id: this.localPlayerId,
      name: this.playerData.name,
      dogType: this.playerData.dogType,
      x: this.spawnPoint.x,
      y: this.spawnPoint.y
    }) || this.localPlayerId;
  }

  reassignLocalPlayerId(nextLocalPlayerId) {
    if (!nextLocalPlayerId || nextLocalPlayerId === this.localPlayerId) {
      return;
    }

    const previousLocalPlayerId = this.localPlayerId;
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

    if (this.fetchBall?.state?.holderId === previousLocalPlayerId) {
      this.fetchBall.state.holderId = nextLocalPlayerId;
      this.syncHeldBallOwnershipFlags(nextLocalPlayerId);
    }
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

  getCarDefinition(carId) {
    return this.carDefinitionMap.get(carId) || null;
  }

  getCarRenderAngle(angle = 0) {
    return Phaser.Math.Angle.Wrap(angle + Math.PI);
  }

  createRacingEntities() {
    if (!this.carDefinitions.length) {
      return;
    }

    if (!this.tireTrackGraphics) {
      this.tireTrackGraphics = this.add.graphics();
      this.tireTrackGraphics.setDepth(6);
    }

    this.carDefinitions.forEach((definition) => {
      this.addOrUpdateCar({
        id: definition.id,
        x: definition.spawn?.x ?? 0,
        y: definition.spawn?.y ?? 0,
        angle: definition.spawn?.angle ?? 0,
        occupantId: null,
        speed: 0,
        turnRate: 0,
        isBoosting: false,
        isSpinningOut: false
      }, true);
    });

    this.createCarExitHintText();
  }

  addOrUpdateCar(snapshot, snapToPosition = false) {
    if (!snapshot?.id) {
      return null;
    }

    const definition = this.getCarDefinition(snapshot.id);
    if (!definition) {
      return null;
    }

    let carEntity = this.cars[snapshot.id];
    const initialX = snapshot.x ?? definition.spawn?.x ?? 0;
    const initialY = snapshot.y ?? definition.spawn?.y ?? 0;
    const initialAngle = this.getCarRenderAngle(snapshot.angle ?? definition.spawn?.angle ?? 0);

    if (!carEntity) {
      const sprite = this.add.image(initialX, initialY, definition.textureKey);
      sprite.setScale(definition.display?.scale ?? 0.4);
      sprite.setOrigin(definition.display?.originX ?? 0.5, definition.display?.originY ?? 0.5);
      sprite.setRotation(initialAngle);

      carEntity = {
        id: snapshot.id,
        sprite,
        x: initialX,
        y: initialY,
        angle: initialAngle,
        targetX: initialX,
        targetY: initialY,
        targetAngle: initialAngle,
        vx: Number.isFinite(snapshot.vx) ? snapshot.vx : 0,
        vy: Number.isFinite(snapshot.vy) ? snapshot.vy : 0,
        targetVx: Number.isFinite(snapshot.vx) ? snapshot.vx : 0,
        targetVy: Number.isFinite(snapshot.vy) ? snapshot.vy : 0,
        speed: snapshot.speed || 0,
        targetSpeed: snapshot.speed || 0,
        turnRate: snapshot.turnRate || 0,
        targetTurnRate: snapshot.turnRate || 0,
        occupantId: snapshot.occupantId || null,
        isBoosting: Boolean(snapshot.isBoosting),
        isSpinningOut: Boolean(snapshot.isSpinningOut),
        lastTrailAnchors: null
      };

      this.cars[snapshot.id] = carEntity;
      this.applyCarTransform(carEntity, true);
      return carEntity;
    }

    carEntity.targetX = typeof snapshot.x === 'number' ? snapshot.x : carEntity.targetX;
    carEntity.targetY = typeof snapshot.y === 'number' ? snapshot.y : carEntity.targetY;
    carEntity.targetAngle = typeof snapshot.angle === 'number'
      ? this.getCarRenderAngle(snapshot.angle)
      : carEntity.targetAngle;
    carEntity.targetVx = Number.isFinite(snapshot.vx) ? snapshot.vx : carEntity.targetVx;
    carEntity.targetVy = Number.isFinite(snapshot.vy) ? snapshot.vy : carEntity.targetVy;
    carEntity.targetSpeed = Number.isFinite(snapshot.speed) ? snapshot.speed : carEntity.targetSpeed;
    carEntity.targetTurnRate = Number.isFinite(snapshot.turnRate) ? snapshot.turnRate : carEntity.targetTurnRate;
    carEntity.occupantId = snapshot.occupantId || null;
    carEntity.isBoosting = Boolean(snapshot.isBoosting);
    carEntity.isSpinningOut = Boolean(snapshot.isSpinningOut);

    if (snapToPosition) {
      carEntity.sprite.setPosition(carEntity.targetX, carEntity.targetY);
      carEntity.sprite.setRotation(carEntity.targetAngle);
      carEntity.vx = carEntity.targetVx;
      carEntity.vy = carEntity.targetVy;
      carEntity.speed = carEntity.targetSpeed;
      carEntity.turnRate = carEntity.targetTurnRate;
      this.applyCarTransform(carEntity, true);
      carEntity.lastTrailAnchors = null;
    }

    return carEntity;
  }

  removeCar(carId) {
    const carEntity = this.cars[carId];
    if (!carEntity) {
      return;
    }

    if (carEntity.sprite) {
      carEntity.sprite.destroy();
    }

    delete this.cars[carId];
  }

  createCarExitHintText() {
    if (this.carExitHintText) {
      this.carExitHintText.destroy();
    }

    this.carExitHintText = this.add.text(0, 0, 'Jump to exit car', {
      fontSize: '22px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center'
    });
    this.carExitHintText.setOrigin(0.5, 0.5);
    this.carExitHintText.setScrollFactor(0);
    this.carExitHintText.setDepth(this.UI_DEPTH + 20);
    this.carExitHintText.setAlpha(0);
    this.updateCarExitHintPosition();
  }

  updateCarExitHintPosition() {
    if (!this.carExitHintText) {
      return;
    }

    const hintY = this.sys.game.device.input.touch ? 72 : 52;
    this.carExitHintText.setPosition(this.scale.width / 2, hintY);
  }

  showCarExitHint() {
    if (!this.carExitHintText) {
      return;
    }

    this.tweens.killTweensOf(this.carExitHintText);
    this.carExitHintText.setAlpha(0);
    this.carExitHintText.setY(this.sys.game.device.input.touch ? 84 : 64);

    this.tweens.add({
      targets: this.carExitHintText,
      alpha: 1,
      y: this.sys.game.device.input.touch ? 72 : 52,
      duration: 180,
      ease: 'Power2',
      onComplete: () => {
        this.tweens.add({
          targets: this.carExitHintText,
          alpha: 0,
          y: this.carExitHintText.y - 10,
          delay: 1200,
          duration: 650,
          ease: 'Power2'
        });
      }
    });
  }

  updateControlModeUi() {
    const localPlayer = this.getLocalPlayer();
    const nextMode = localPlayer && localPlayer.carId ? 'car' : 'foot';
    this.currentControlMode = nextMode;

    if (this.jumpButtonLabel) {
      this.jumpButtonLabel.setText(nextMode === 'car' ? 'EXIT' : 'JUMP');
    }

    if (this.sprintButtonLabel) {
      this.sprintButtonLabel.setText(nextMode === 'car' ? 'BOOST' : 'RUN');
    }
  }

  applyCarTransform(carEntity, snapTrailAnchor = false) {
    if (!carEntity?.sprite) {
      return;
    }

    const definition = this.getCarDefinition(carEntity.id);
    carEntity.sprite.setScale(definition?.display?.scale ?? 0.4);
    carEntity.sprite.setOrigin(definition?.display?.originX ?? 0.5, definition?.display?.originY ?? 0.5);
    carEntity.sprite.setDepth(carEntity.sprite.y + 8);

    carEntity.x = carEntity.sprite.x;
    carEntity.y = carEntity.sprite.y;
    carEntity.angle = carEntity.sprite.rotation;

    if (snapTrailAnchor && this.racingShared && typeof this.racingShared.computeTrailAnchors === 'function') {
      carEntity.lastTrailAnchors = this.racingShared.computeTrailAnchors({
        x: carEntity.x,
        y: carEntity.y,
        angle: carEntity.angle
      }, definition);
    }
  }

  applyOnFootSpriteState(playerEntity) {
    if (!playerEntity?.sprite) {
      return;
    }

    if (playerEntity.currentPose !== 'foot') {
      playerEntity.sprite.setCrop();
      playerEntity.sprite.setRotation(0);
      playerEntity.sprite.setOrigin(0.5, 0.5);
      playerEntity.sprite.setScale(this.PLAYER_SCALE);
      playerEntity.currentPose = 'foot';
    }

    playerEntity.sprite.setDepth(playerEntity.sprite.y + 20);
  }

  applyCarSeatedState(playerEntity, carEntity) {
    if (!playerEntity?.sprite || !carEntity?.sprite || !this.racingShared) {
      return;
    }

    const definition = this.getCarDefinition(carEntity.id);
    if (!definition) {
      return;
    }

    const seatPose = this.racingShared.computeSeatPose({
      x: carEntity.sprite.x,
      y: carEntity.sprite.y,
      angle: carEntity.sprite.rotation
    }, definition);

    playerEntity.sprite.anims.stop();
    playerEntity.sprite.setTexture(`${playerEntity.dogKey}_sit`);
    const seatedFrame = playerEntity.sprite.frame;
    const seatedCropWidth = seatedFrame?.cutWidth || playerEntity.sprite.width || 0;
    const seatedCropHeight = Math.floor((seatedFrame?.cutHeight || playerEntity.sprite.height || 0) * 0.7);
    playerEntity.sprite.setCrop(0, 0, seatedCropWidth, seatedCropHeight);
    playerEntity.sprite.setOrigin(seatPose.originX, seatPose.originY);
    playerEntity.sprite.setScale(seatPose.scale);
    playerEntity.sprite.setRotation(seatPose.rotation);
    playerEntity.sprite.setPosition(seatPose.x, seatPose.y);
    playerEntity.sprite.setFlipX(Boolean(definition.seat?.flipX));
    playerEntity.sprite.setDepth(carEntity.sprite.depth + 2);
    playerEntity.currentPose = 'car';
  }

  shouldSnapLocalPlayerToSnapshot(playerEntity, snapshot) {
    if (!playerEntity || typeof snapshot?.x !== 'number' || typeof snapshot?.y !== 'number') {
      return false;
    }

    const distance = Phaser.Math.Distance.Between(
      playerEntity.sprite.x,
      playerEntity.sprite.y,
      snapshot.x,
      snapshot.y
    );

    return distance > 56;
  }

  applyLocalPlayerSnapshot(playerEntity, snapshot) {
    const previousCarId = playerEntity.carId;
    playerEntity.serverAnimation = typeof snapshot.animation === 'string'
      ? snapshot.animation
      : playerEntity.serverAnimation;
    playerEntity.remoteAnimation = playerEntity.serverAnimation;
    playerEntity.carId = snapshot.carId || null;

    if (typeof snapshot.x === 'number' && typeof snapshot.y === 'number') {
      playerEntity.serverX = snapshot.x;
      playerEntity.serverY = snapshot.y;
      playerEntity.targetX = snapshot.x;
      playerEntity.targetY = snapshot.y;
    }

    if (playerEntity.carId) {
      if (!previousCarId) {
        if (this.jumpTween) {
          this.jumpTween.stop();
          this.jumpTween = null;
        }
        this.isJumping = false;
        this.pendingCarExitRequest = false;
        this.showCarExitHint();
      }

      if (typeof snapshot.x === 'number' && typeof snapshot.y === 'number') {
        playerEntity.sprite.setPosition(snapshot.x, snapshot.y);
      }

      return;
    }

    if (previousCarId && !playerEntity.carId) {
      this.applyOnFootSpriteState(playerEntity);
    }

    if (typeof snapshot.flipX === 'boolean') {
      playerEntity.sprite.setFlipX(snapshot.flipX);
    }

    if (this.shouldSnapLocalPlayerToSnapshot(playerEntity, snapshot)) {
      playerEntity.sprite.setPosition(snapshot.x, snapshot.y);
      this.localLastSafePosition.x = snapshot.x;
      this.localLastSafePosition.y = snapshot.y;
    }
  }

  applyPlayerSnapshot(playerEntity, snapshot) {
    if (!playerEntity || !snapshot) {
      return;
    }

    if (playerEntity.isLocal) {
      this.applyLocalPlayerSnapshot(playerEntity, snapshot);
      return;
    }

    playerEntity.remoteAnimation = typeof snapshot.animation === 'string'
      ? snapshot.animation
      : playerEntity.remoteAnimation;
    playerEntity.serverAnimation = playerEntity.remoteAnimation;
    playerEntity.carId = snapshot.carId || null;

    if (typeof snapshot.x === 'number' && typeof snapshot.y === 'number') {
      playerEntity.targetX = snapshot.x;
      playerEntity.targetY = snapshot.y;
      playerEntity.serverX = snapshot.x;
      playerEntity.serverY = snapshot.y;
    }

    if (!playerEntity.carId) {
      if (typeof snapshot.flipX === 'boolean') {
        playerEntity.sprite.setFlipX(snapshot.flipX);
      }

      if (typeof snapshot.animation === 'string') {
        this.playEntityAnimation(playerEntity, snapshot.animation);
      }
    }
  }

  syncPlayersToCars() {
    Object.values(this.players).forEach((playerEntity) => {
      if (playerEntity.carId) {
        const carEntity = this.cars[playerEntity.carId];
        if (carEntity) {
          this.applyCarSeatedState(playerEntity, carEntity);
          return;
        }

        playerEntity.carId = null;
      }

      if (playerEntity.currentPose === 'car') {
        this.playEntityAnimation(
          playerEntity,
          playerEntity.serverAnimation || playerEntity.remoteAnimation || 'stand'
        );
      }
    });
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
      const spawnX = playerData.x ?? this.spawnPoint.x;
      const spawnY = playerData.y ?? this.spawnPoint.y;
      const sprite = this.physics.add.sprite(
        spawnX,
        spawnY,
        `${dogKey}_stand`
      );
      sprite.setScale(this.PLAYER_SCALE);
      sprite.setCollideWorldBounds(false);
      sprite.body.setSize(150, 150);
      sprite.body.setOffset(180, 180);
      sprite.setOrigin(0.5, 0.5);

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
        remoteAnimation: 'stand',
        serverAnimation: 'stand',
        serverX: sprite.x,
        serverY: sprite.y,
        vx: 0,
        vy: 0,
        carId: null,
        currentPose: 'foot',
        heldBallId: null
      };

      this.players[playerId] = playerEntity;
    } else {
      playerEntity.name = playerData.name || playerEntity.name;
      playerEntity.playerNameText.setText(playerEntity.name);

      if (playerEntity.dogKey !== dogKey) {
        playerEntity.dogKey = dogKey;
        playerEntity.sprite.setTexture(`${dogKey}_${playerEntity.carId ? 'sit' : 'stand'}`);
      }

      if (typeof playerData.x === 'number' && typeof playerData.y === 'number') {
        playerEntity.targetX = playerData.x;
        playerEntity.targetY = playerData.y;
        playerEntity.serverX = playerData.x;
        playerEntity.serverY = playerData.y;
      }
    }

    playerEntity.isLocal = Boolean(playerData.isLocal);
    playerEntity.heldBallId = playerData.heldBallId || null;
    playerEntity.dogTypeText.setText(dogLabel);

    if (typeof playerData.flipX === 'boolean') {
      playerEntity.sprite.setFlipX(playerData.flipX);
    }

    if (
      typeof playerData.x === 'number' &&
      typeof playerData.y === 'number' &&
      (playerData.snapToPosition || (!playerEntity.isLocal))
    ) {
      playerEntity.sprite.setPosition(playerData.x, playerData.y);
    }

    if (typeof playerData.x === 'number' && typeof playerData.y === 'number' && playerEntity.isLocal) {
      playerEntity.targetX = playerData.x;
      playerEntity.targetY = playerData.y;
      playerEntity.serverX = playerData.x;
      playerEntity.serverY = playerData.y;

      if (playerData.snapToPosition) {
        this.localLastSafePosition.x = playerData.x;
        this.localLastSafePosition.y = playerData.y;
      }
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
    const wasUsingLocalFetchAuthority = !this.hasReceivedNetworkWorldState;
    this.hasReceivedNetworkWorldState = true;
    const playersSnapshot = Array.isArray(worldState)
      ? worldState
      : Array.isArray(worldState?.players)
        ? worldState.players
        : [];
    const carsSnapshot = Array.isArray(worldState?.cars)
      ? worldState.cars
      : [];
    const ballSnapshot = worldState?.fetch?.ball || worldState?.ball || null;

    const activeIds = new Set();
    const activeCarIds = new Set();

    carsSnapshot.forEach((snapshot) => {
      if (!snapshot?.id) {
        return;
      }

      activeCarIds.add(snapshot.id);
      this.addOrUpdateCar(snapshot);
    });

    Object.keys(this.cars).forEach((carId) => {
      if (!activeCarIds.has(carId)) {
        this.removeCar(carId);
      }
    });

    playersSnapshot.forEach((snapshot) => {
      if (!snapshot || !snapshot.id) {
        return;
      }

      activeIds.add(snapshot.id);

      const isLocalPlayer = snapshot.id === this.localPlayerId;
      const playerEntity = this.addOrUpdatePlayer({
        id: snapshot.id,
        name: snapshot.name,
        dogType: snapshot.dogType,
        x: snapshot.x,
        y: snapshot.y,
        flipX: snapshot.flipX,
        isLocal: isLocalPlayer,
        snapToPosition: !isLocalPlayer
      });

      if (!playerEntity) {
        return;
      }

      this.applyPlayerSnapshot(playerEntity, snapshot);

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

    if (ballSnapshot) {
      this.applyFetchBallSnapshot(ballSnapshot, wasUsingLocalFetchAuthority);
    } else if (this.fetchBall) {
      this.fetchBall.state = null;
      this.syncHeldBallOwnershipFlags(null);
      this.updateFetchUi();
    }
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

    this.applyOnFootSpriteState(playerEntity);

    if (animationState === 'sit') {
      playerEntity.sprite.anims.stop();
      playerEntity.sprite.setTexture(`${playerEntity.dogKey}_sit`);
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

  interpolateCars(delta) {
    const baseSmoothing = Phaser.Math.Clamp((delta / 1000) * 10, 0, 1);

    Object.values(this.cars).forEach((carEntity) => {
      const isLocalDriven = carEntity.occupantId === this.localPlayerId;
      const smoothing = isLocalDriven
        ? Phaser.Math.Clamp((delta / 1000) * 18, 0, 1)
        : baseSmoothing;

      carEntity.sprite.x = Phaser.Math.Linear(carEntity.sprite.x, carEntity.targetX, smoothing);
      carEntity.sprite.y = Phaser.Math.Linear(carEntity.sprite.y, carEntity.targetY, smoothing);

      if (this.racingShared && typeof this.racingShared.lerpAngle === 'function') {
        carEntity.sprite.rotation = this.racingShared.lerpAngle(
          carEntity.sprite.rotation,
          carEntity.targetAngle,
          smoothing
        );
      } else {
        carEntity.sprite.rotation = carEntity.targetAngle;
      }

      carEntity.speed = Phaser.Math.Linear(carEntity.speed || 0, carEntity.targetSpeed || 0, smoothing);
      carEntity.turnRate = Phaser.Math.Linear(carEntity.turnRate || 0, carEntity.targetTurnRate || 0, smoothing);
      carEntity.vx = Phaser.Math.Linear(carEntity.vx || 0, carEntity.targetVx || 0, smoothing);
      carEntity.vy = Phaser.Math.Linear(carEntity.vy || 0, carEntity.targetVy || 0, smoothing);
      this.applyCarTransform(carEntity);
    });
  }

  recordTireTracks(carEntity, time) {
    if (!this.tireTrackGraphics || !this.racingShared) {
      return;
    }

    const definition = this.getCarDefinition(carEntity.id);
    if (!definition) {
      return;
    }

    const currentAnchors = this.racingShared.computeTrailAnchors({
      x: carEntity.sprite.x,
      y: carEntity.sprite.y,
      angle: carEntity.sprite.rotation
    }, definition);

    if (!carEntity.lastTrailAnchors) {
      carEntity.lastTrailAnchors = currentAnchors;
      return;
    }

    const trailDistance = Phaser.Math.Distance.Between(
      currentAnchors.left.x,
      currentAnchors.left.y,
      carEntity.lastTrailAnchors.left.x,
      carEntity.lastTrailAnchors.left.y
    );

    if (trailDistance > 120) {
      carEntity.lastTrailAnchors = currentAnchors;
      return;
    }

    const trailConfig = this.racingConfig.physics || FALLBACK_RACING_CONFIG.physics;
    const shouldDrawTrail =
      (carEntity.speed || 0) >= (trailConfig.trailMinSpeed || 170) &&
      (
        Math.abs(carEntity.turnRate || 0) >= (trailConfig.trailTurnThreshold || 0.45) ||
        carEntity.isBoosting ||
        carEntity.isSpinningOut
      );

    if (shouldDrawTrail && trailDistance >= (trailConfig.trailMinDistance || 12)) {
      this.tireTrackSegments.push({
        x1: carEntity.lastTrailAnchors.left.x,
        y1: carEntity.lastTrailAnchors.left.y,
        x2: currentAnchors.left.x,
        y2: currentAnchors.left.y,
        createdAt: time
      });
      this.tireTrackSegments.push({
        x1: carEntity.lastTrailAnchors.right.x,
        y1: carEntity.lastTrailAnchors.right.y,
        x2: currentAnchors.right.x,
        y2: currentAnchors.right.y,
        createdAt: time
      });
    }

    carEntity.lastTrailAnchors = currentAnchors;
  }

  redrawTireTracks(time) {
    if (!this.tireTrackGraphics) {
      return;
    }

    const trailConfig = this.racingConfig.physics || FALLBACK_RACING_CONFIG.physics;
    const trailLifetimeMs = trailConfig.trailLifetimeMs || 2600;
    const trailAlpha = trailConfig.trailAlpha || 0.4;
    const trailWidth = trailConfig.trailWidth || 2;

    this.tireTrackSegments = this.tireTrackSegments.filter((segment) => {
      return (time - segment.createdAt) <= trailLifetimeMs;
    });

    this.tireTrackGraphics.clear();

    this.tireTrackSegments.forEach((segment) => {
      const age = time - segment.createdAt;
      const alpha = trailAlpha * Math.max(0, 1 - (age / trailLifetimeMs));
      if (alpha <= 0) {
        return;
      }

      this.tireTrackGraphics.lineStyle(trailWidth, 0xd9d9d9, alpha);
      this.tireTrackGraphics.beginPath();
      this.tireTrackGraphics.moveTo(segment.x1, segment.y1);
      this.tireTrackGraphics.lineTo(segment.x2, segment.y2);
      this.tireTrackGraphics.strokePath();
    });
  }

  updateTireTracks(time) {
    Object.values(this.cars).forEach((carEntity) => {
      this.recordTireTracks(carEntity, time);
    });

    this.redrawTireTracks(time);
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
    const collisionOriginY = playerY + this.PLAYER_COLLISION_OFFSET_Y;
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
      const sampleY = collisionOriginY + (direction.y * probeRadius);

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

    const sweptLanding = this.sweepToWalkablePosition(startX, startY, desiredLandingX, desiredLandingY);
    if (
      Math.abs(sweptLanding.x - desiredLandingX) < 0.01 &&
      Math.abs(sweptLanding.y - desiredLandingY) < 0.01
    ) {
      return sweptLanding;
    }

    if (Math.abs(sweptLanding.x - startX) > 0.01 || Math.abs(sweptLanding.y - startY) > 0.01) {
      return sweptLanding;
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
    this.updateCarExitHintPosition();
    this.layoutTopMessageUi();
    this.layoutFetchUi();

    if (this.shouldRebuildMobileControls()) {
      this.createMobileControls();
    }

    this.updateControlModeUi();
    this.updateFetchUi();
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
      buttonBg.setDepth(this.UI_DEPTH + 30);

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
      emojiText.setDepth(this.UI_DEPTH + 31);

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
    this.joystickBase.setDepth(this.UI_DEPTH + 10);

    this.joystickThumb = this.add.circle(joystickX, joystickY, thumbRadius, 0xffffff, 0.55);
    this.joystickThumb.setScrollFactor(0);
    this.joystickThumb.setDepth(this.UI_DEPTH + 11);

    const jumpX = viewportWidth - sideX;
    const jumpY = controlY;
    const sprintX = jumpX;
    const sprintY = jumpY - jumpRadius - sprintRadius - Math.round(16 * controlScale);

    this.jumpButton = this.add.circle(jumpX, jumpY, jumpRadius, 0x4CAF50, 0.5);
    this.jumpButton.setStrokeStyle(3, 0xffffff, 0.6);
    this.jumpButton.setScrollFactor(0);
    this.jumpButton.setDepth(this.UI_DEPTH + 10);
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
    jumpLabel.setDepth(this.UI_DEPTH + 11);
    this.jumpButtonLabel = jumpLabel;
    this.mobileControlElements.push(this.joystickBase, this.joystickThumb, this.jumpButton, jumpLabel);

    this.sprintButton = this.add.circle(sprintX, sprintY, sprintRadius, 0x0f766e, 0.55);
    this.sprintButton.setStrokeStyle(3, 0xffffff, 0.6);
    this.sprintButton.setScrollFactor(0);
    this.sprintButton.setDepth(this.UI_DEPTH + 10);
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
    sprintLabel.setDepth(this.UI_DEPTH + 11);
    this.sprintButtonLabel = sprintLabel;
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
        if (pointer.__fetchUiConsumed || this.isPointerOverTopFetchUi(pointer) || this.tryHandleFetchUiPointer(pointer)) {
          return;
        }

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
    this.jumpButtonLabel = null;
    this.sprintButtonLabel = null;
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

  updateMoveVectorFromInput() {
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
  }

  createFetchSystems() {
    this.createTopMessageSystem();
    this.createFetchBallEntity();
    this.createFetchUi();
    this.bindFetchUiPointerHandler();
    this.initializeOfflineFetchBallIfNeeded();
    this.updateFetchUi();
  }

  normalizeUiDimension(value, minimum = 2) {
    const rounded = Math.max(minimum, Math.round(value));
    return rounded % 2 === 0 ? rounded : rounded + 1;
  }

  createUiRect(width, height, fillColor, fillAlpha, options = {}) {
    const rect = this.add.graphics();
    rect.setScrollFactor(0);
    rect.__uiStyle = {
      fillColor,
      fillAlpha,
      strokeThickness: options.strokeThickness || 0,
      strokeColor: options.strokeColor || 0xffffff,
      strokeAlpha: options.strokeAlpha ?? 1
    };
    this.resizeUiRect(rect, width, height);
    return rect;
  }

  resizeUiRect(rect, width, height) {
    if (!rect) {
      return;
    }

    const normalizedWidth = this.normalizeUiDimension(width);
    const normalizedHeight = this.normalizeUiDimension(height);
    const style = rect.__uiStyle || {};

    rect.clear();

    if ((style.fillAlpha ?? 0) > 0) {
      rect.fillStyle(style.fillColor || 0xffffff, style.fillAlpha);
      rect.fillRect(
        -normalizedWidth / 2,
        -normalizedHeight / 2,
        normalizedWidth,
        normalizedHeight
      );
    }

    if ((style.strokeThickness || 0) > 0) {
      rect.lineStyle(style.strokeThickness, style.strokeColor || 0xffffff, style.strokeAlpha ?? 1);
      rect.strokeRect(
        -normalizedWidth / 2,
        -normalizedHeight / 2,
        normalizedWidth,
        normalizedHeight
      );
    }

    rect.uiWidth = normalizedWidth;
    rect.uiHeight = normalizedHeight;
  }

  createUiEllipse(width, height, fillColor, fillAlpha, options = {}) {
    const ellipse = this.add.graphics();
    ellipse.setScrollFactor(0);
    ellipse.__uiStyle = {
      fillColor,
      fillAlpha,
      strokeThickness: options.strokeThickness || 0,
      strokeColor: options.strokeColor || 0xffffff,
      strokeAlpha: options.strokeAlpha ?? 1
    };
    this.resizeUiEllipse(ellipse, width, height);
    return ellipse;
  }

  resizeUiEllipse(ellipse, width, height) {
    if (!ellipse) {
      return;
    }

    const normalizedWidth = this.normalizeUiDimension(width);
    const normalizedHeight = this.normalizeUiDimension(height);
    const style = ellipse.__uiStyle || {};

    ellipse.clear();

    if ((style.fillAlpha ?? 0) > 0) {
      ellipse.fillStyle(style.fillColor || 0xffffff, style.fillAlpha);
      ellipse.fillEllipse(0, 0, normalizedWidth, normalizedHeight);
    }

    if ((style.strokeThickness || 0) > 0) {
      ellipse.lineStyle(style.strokeThickness, style.strokeColor || 0xffffff, style.strokeAlpha ?? 1);
      ellipse.strokeEllipse(0, 0, normalizedWidth, normalizedHeight);
    }

    ellipse.uiWidth = normalizedWidth;
    ellipse.uiHeight = normalizedHeight;
  }

  createTopMessageSystem() {
    if (this.topMessageUi?.container) {
      this.topMessageUi.container.destroy();
    }

    const container = this.add.container(0, 0);
    container.setScrollFactor(0);
    container.setDepth(this.UI_OVERLAY_DEPTH + 20);
    container.setVisible(false);

    const background = this.createUiRect(280, 52, 0x111827, 0.88, {
      strokeThickness: 3,
      strokeColor: 0xf8fafc,
      strokeAlpha: 0.45
    });

    const text = this.add.text(0, 0, '', {
      fontSize: '24px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center'
    });
    text.setOrigin(0.5, 0.5);

    container.add([background, text]);

    this.topMessageUi = {
      container,
      background,
      text
    };

    this.layoutTopMessageUi();
  }

  getTopMessageTargetY() {
    if (this.fetchHudUi?.container?.visible) {
      return this.fetchHudUi.container.y + ((this.fetchHudUi.panel.uiHeight || 78) / 2) + 34;
    }

    if (this.fetchPromptUi?.container?.visible) {
      return this.fetchPromptUi.container.y + (this.fetchPromptUi.height / 2) + 28;
    }

    return this.sys.game.device.input.touch ? 42 : 34;
  }

  layoutTopMessageUi() {
    if (!this.topMessageUi?.container) {
      return;
    }

    this.topMessageUi.container.setPosition(this.scale.width / 2, this.getTopMessageTargetY());
  }

  queueTopMessage(text, options = {}) {
    if (!text || !this.topMessageUi) {
      return;
    }

    this.topMessageQueue.push({
      text: String(text),
      durationMs: Number.isFinite(options.durationMs) ? options.durationMs : 2300
    });

    if (this.topMessageUi.container.visible || this.activeTopMessageTween) {
      return;
    }

    this.showNextTopMessage();
  }

  showNextTopMessage() {
    if (!this.topMessageUi || !this.topMessageQueue.length) {
      return;
    }

    const nextMessage = this.topMessageQueue.shift();
    const targetY = this.getTopMessageTargetY();
    const container = this.topMessageUi.container;
    const background = this.topMessageUi.background;
    const text = this.topMessageUi.text;

    text.setText(nextMessage.text);
    text.setWordWrapWidth(Math.max(220, this.scale.width - 80), true);
    this.resizeUiRect(
      background,
      Math.min(this.scale.width - 32, Math.max(220, text.width + 54)),
      Math.max(48, text.height + 20)
    );
    this.layoutTopMessageUi();

    this.tweens.killTweensOf(container);
    container.setVisible(true);
    container.setAlpha(0);
    container.setScale(0.94);
    container.setY(targetY - 12);

    this.activeTopMessageTween = this.tweens.add({
      targets: container,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      y: targetY,
      duration: 180,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(nextMessage.durationMs, () => {
          this.activeTopMessageTween = this.tweens.add({
            targets: container,
            alpha: 0,
            y: targetY - 16,
            duration: 420,
            ease: 'Power2',
            onComplete: () => {
              container.setVisible(false);
              this.activeTopMessageTween = null;
              this.showNextTopMessage();
            }
          });
        });
      }
    });
  }

  createUiButton(width, height, label, options = {}) {
    const container = this.add.container(0, 0);
    container.setScrollFactor(0);
    container.setDepth(options.depth || (this.UI_DEPTH + 40));

    const background = this.add.rectangle(0, 0, width, height, options.fillColor || 0x243042, options.alpha || 0.95);
    background.setStrokeStyle(
      options.strokeThickness || 3,
      options.strokeColor || 0xffffff,
      options.strokeAlpha || 0.5
    );

    const text = this.add.text(options.labelX || 0, options.labelY || 0, label, {
      fontSize: options.fontSize || '24px',
      fontFamily: 'Arial, sans-serif',
      color: options.textColor || '#ffffff',
      stroke: options.textStroke || '#000000',
      strokeThickness: options.textStrokeThickness || 4,
      align: 'center'
    });
    text.setOrigin(0.5, 0.5);

    const hitArea = this.add.rectangle(0, 0, width, height, 0xffffff, 0.001);
    container.add([background, text, hitArea]);
    const trigger = () => {
      const now = this.time.now;
      if ((trigger.lastTriggeredAt || 0) && (now - trigger.lastTriggeredAt) < 80) {
        return;
      }

      trigger.lastTriggeredAt = now;
      background.setFillStyle(options.pressColor || options.hoverColor || options.fillColor || 0x243042, options.alpha || 0.95);
      this.tweens.add({
        targets: container,
        scaleX: 0.94,
        scaleY: 0.94,
        duration: 70,
        yoyo: true,
        ease: 'Power2'
      });

      if (typeof options.onClick === 'function') {
        options.onClick();
      }
    };

    if (typeof options.onClick === 'function') {
      hitArea.setInteractive({ useHandCursor: true });

      hitArea.on('pointerover', () => {
        background.setFillStyle(options.hoverColor || options.fillColor || 0x243042, options.alpha || 0.95);
        this.tweens.add({
          targets: container,
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 100,
          ease: 'Power2'
        });
      });

      hitArea.on('pointerout', () => {
        background.setFillStyle(options.fillColor || 0x243042, options.alpha || 0.95);
        this.tweens.add({
          targets: container,
          scaleX: 1,
          scaleY: 1,
          duration: 100,
          ease: 'Power2'
        });
      });

      hitArea.on('pointerdown', () => {
        trigger();
      });

      hitArea.on('pointerup', () => {
        background.setFillStyle(options.fillColor || 0x243042, options.alpha || 0.95);
      });

      hitArea.on('pointerupoutside', () => {
        background.setFillStyle(options.fillColor || 0x243042, options.alpha || 0.95);
      });
    }

    return {
      container,
      background,
      text,
      hitArea,
      actionZone: null,
      trigger,
      width,
      height
    };
  }

  createScreenButtonZone(button) {
    if (!button) {
      return null;
    }

    const zone = this.add.zone(0, 0, button.width, button.height);
    zone.setOrigin(0.5, 0.5);
    zone.setScrollFactor(0);
    zone.setDepth(this.UI_OVERLAY_DEPTH + 40);
    zone.setInteractive({ useHandCursor: true });
    zone.setActive(false);
    zone.setVisible(false);

    zone.on('pointerdown', (pointer, localX, localY, event) => {
      if (event?.stopPropagation) {
        event.stopPropagation();
      }

      pointer.__fetchUiConsumed = true;
      this.time.delayedCall(0, () => {
        pointer.__fetchUiConsumed = false;
      });
      button.trigger();
    });

    zone.on('pointerup', (pointer, localX, localY, event) => {
      if (event?.stopPropagation) {
        event.stopPropagation();
      }
    });

    zone.on('pointerupoutside', (pointer, localX, localY, event) => {
      if (event?.stopPropagation) {
        event.stopPropagation();
      }
    });

    button.actionZone = zone;
    return zone;
  }

  destroyScreenButtonZone(button) {
    if (button?.actionZone) {
      button.actionZone.destroy();
      button.actionZone = null;
    }
  }

  setScreenButtonPosition(button, x, y) {
    if (!button?.actionZone) {
      return;
    }

    button.actionZone.setPosition(x, y);
  }

  syncScreenButtonVisibility(button, isVisible) {
    if (!button?.actionZone) {
      return;
    }

    button.actionZone.setActive(isVisible);
    button.actionZone.setVisible(isVisible);
  }

  isPointerInsideZone(pointer, zone) {
    if (!pointer || !zone?.active) {
      return false;
    }

    const halfWidth = zone.width / 2;
    const halfHeight = zone.height / 2;

    return (
      pointer.x >= (zone.x - halfWidth) &&
      pointer.x <= (zone.x + halfWidth) &&
      pointer.y >= (zone.y - halfHeight) &&
      pointer.y <= (zone.y + halfHeight)
    );
  }

  isPointerOverTopFetchUi(pointer) {
    return Boolean(
      (!this.throwHudOpen && this.fetchPromptUi?.container?.visible && this.isPointerInsideUiButton(pointer, this.fetchPromptUi))
      || (!this.throwHudOpen && this.fetchHudUi?.container?.visible && this.isPointerInsideUiButton(pointer, this.fetchHudUi?.dropButton, this.fetchHudUi.container))
      || (!this.throwHudOpen && this.fetchHudUi?.container?.visible && this.isPointerInsideUiButton(pointer, this.fetchHudUi?.throwButton, this.fetchHudUi.container))
    );
  }

  bindFetchUiPointerHandler() {
    if (this.fetchUiPointerHandler) {
      this.input.off('pointerdown', this.fetchUiPointerHandler);
    }

    this.fetchUiPointerHandler = (pointer) => {
      if (this.tryHandleFetchUiPointer(pointer)) {
        pointer.__fetchUiConsumed = true;
        this.time.delayedCall(0, () => {
          pointer.__fetchUiConsumed = false;
        });
      }
    };

    this.input.on('pointerdown', this.fetchUiPointerHandler);
  }

  getUiButtonScreenPosition(button, parentContainer = null) {
    if (!button?.container) {
      return { x: 0, y: 0 };
    }

    return {
      x: (parentContainer?.x || 0) + button.container.x,
      y: (parentContainer?.y || 0) + button.container.y
    };
  }

  isPointerInsideUiButton(pointer, button, parentContainer = null) {
    if (!pointer || !button?.container || !button.container.visible) {
      return false;
    }

    const position = this.getUiButtonScreenPosition(button, parentContainer);
    const scaleX = Math.abs(button.container.scaleX || 1);
    const scaleY = Math.abs(button.container.scaleY || 1);
    const halfWidth = (button.width * scaleX) / 2;
    const halfHeight = (button.height * scaleY) / 2;

    return (
      pointer.x >= (position.x - halfWidth) &&
      pointer.x <= (position.x + halfWidth) &&
      pointer.y >= (position.y - halfHeight) &&
      pointer.y <= (position.y + halfHeight)
    );
  }

  tryHandleFetchUiPointer(pointer) {
    if (!pointer) {
      return false;
    }

    if (!this.throwHudOpen) {
      if (this.fetchPromptUi?.container?.visible && this.isPointerInsideUiButton(pointer, this.fetchPromptUi)) {
        this.fetchPromptUi.trigger();
        return true;
      }

      if (this.fetchHudUi?.container?.visible) {
        if (this.isPointerInsideUiButton(pointer, this.fetchHudUi.dropButton, this.fetchHudUi.container)) {
          this.fetchHudUi.dropButton.trigger();
          return true;
        }

        if (this.isPointerInsideUiButton(pointer, this.fetchHudUi.throwButton, this.fetchHudUi.container)) {
          this.fetchHudUi.throwButton.trigger();
          return true;
        }
      }
    }

    if (this.throwHudOpen && this.throwHudUi?.container?.visible) {
      for (const entry of this.throwHudUi.directionButtons) {
        if (this.isPointerInsideUiButton(pointer, entry.button, this.throwHudUi.container)) {
          entry.button.trigger();
          return true;
        }
      }

      if (this.isPointerInsideUiButton(pointer, this.throwHudUi.cancelButton, this.throwHudUi.container)) {
        this.throwHudUi.cancelButton.trigger();
        return true;
      }
    }

    return false;
  }

  createFetchBallEntity() {
    if (this.fetchBall?.sprite) {
      this.fetchBall.sprite.destroy();
    }
    if (this.fetchBall?.shadow) {
      this.fetchBall.shadow.destroy();
    }

    const shadow = this.add.ellipse(0, 0, 42, 18, 0x000000, 0.18);
    shadow.setVisible(false);

    const sprite = this.add.image(0, 0, this.fetchConfig.ball.textureKey);
    sprite.setScale(this.fetchConfig.ball.displayScale);
    sprite.setVisible(false);

    this.fetchBall = {
      sprite,
      shadow,
      state: null,
      renderX: 0,
      renderY: 0,
      targetX: 0,
      targetY: 0
    };
  }

  createFetchUi() {
    this.destroyScreenButtonZone(this.fetchPromptUi);
    this.destroyScreenButtonZone(this.fetchHudUi?.dropButton);
    this.destroyScreenButtonZone(this.fetchHudUi?.throwButton);

    if (this.fetchPromptUi?.container) {
      this.fetchPromptUi.container.destroy();
    }
    if (this.fetchHudUi?.container) {
      this.fetchHudUi.container.destroy();
    }
    if (this.throwHudUi?.container) {
      this.throwHudUi.container.destroy();
    }
    if (this.throwHudBallTween) {
      this.throwHudBallTween.stop();
      this.throwHudBallTween = null;
    }

    const promptButton = this.createUiButton(
      this.sys.game.device.input.touch ? 184 : 204,
      60,
      this.sys.game.device.input.touch ? 'FETCH!' : 'FETCH! [E]',
      {
        fillColor: 0x2f855a,
        hoverColor: 0x38a169,
        pressColor: 0x276749,
        fontSize: '26px',
        onClick: () => this.requestFetchPickup(),
        depth: this.UI_DEPTH + 40
      }
    );
    const promptBallIcon = this.add.image(-66, 0, this.fetchConfig.ball.textureKey);
    promptBallIcon.setScale(this.fetchConfig.ball.hudScale);
    promptButton.container.add(promptBallIcon);
    promptButton.text.setX(18);
    promptButton.container.setVisible(false);
    this.createScreenButtonZone(promptButton);
    this.fetchPromptUi = promptButton;

    const hudContainer = this.add.container(0, 0);
    hudContainer.setScrollFactor(0);
    hudContainer.setDepth(this.UI_DEPTH + 50);
    hudContainer.setVisible(false);

    const hudPanel = this.createUiRect(360, 78, 0x111827, 0.88, {
      strokeThickness: 3,
      strokeColor: 0xf8fafc,
      strokeAlpha: 0.45
    });
    const hudBadge = this.add.circle(-140, 0, 25, 0xffffff, 0.08);
    const hudBallIcon = this.add.image(-140, 0, this.fetchConfig.ball.textureKey);
    hudBallIcon.setScale(this.fetchConfig.ball.hudScale);
    const hudTitle = this.add.text(-104, 0, 'Ball', {
      fontSize: '28px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4
    });
    hudTitle.setOrigin(0, 0.5);

    const dropButton = this.createUiButton(98, 48, 'DROP', {
      fillColor: 0x475569,
      hoverColor: 0x64748b,
      pressColor: 0x334155,
      fontSize: '22px',
      onClick: () => this.dropHeldFetchBall()
    });
    const throwButton = this.createUiButton(112, 48, 'THROW', {
      fillColor: 0x7c2d12,
      hoverColor: 0x9a3412,
      pressColor: 0x6b210d,
      fontSize: '22px',
      onClick: () => this.openThrowHud()
    });

    hudContainer.add([
      hudPanel,
      hudBadge,
      hudBallIcon,
      hudTitle,
      dropButton.container,
      throwButton.container
    ]);

    this.fetchHudUi = {
      container: hudContainer,
      panel: hudPanel,
      badge: hudBadge,
      ballIcon: hudBallIcon,
      title: hudTitle,
      dropButton,
      throwButton
    };
    this.createScreenButtonZone(dropButton);
    this.createScreenButtonZone(throwButton);

    const throwContainer = this.add.container(0, 0);
    throwContainer.setScrollFactor(0);
    throwContainer.setDepth(this.UI_OVERLAY_DEPTH + 10);
    throwContainer.setVisible(false);

    const scrim = this.createUiRect(this.scale.width, this.scale.height, 0x0b1220, 0.18);
    const panel = this.createUiRect(560, 520, 0x0b1220, 0.44, {
      strokeThickness: 2,
      strokeColor: 0xf8fafc,
      strokeAlpha: 0.16
    });

    const glow = this.createUiEllipse(260, 90, 0xffffff, 0.08);
    const ballImage = this.add.image(0, 0, this.fetchConfig.ball.textureKey);
    ballImage.setScale(0.06);

    const whichWayText = this.add.text(0, 0, 'Which way?', {
      fontSize: '36px',
      fontFamily: 'Arial, sans-serif',
      color: '#f8fafc',
      stroke: '#000000',
      strokeThickness: 6
    });
    whichWayText.setOrigin(0.5, 0.5);

    const archLetters = 'FETCH!'.split('').map((character) => {
      const letterText = this.add.text(0, 0, character, {
        fontSize: '52px',
        fontFamily: 'Arial, sans-serif',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 7
      });
      letterText.setOrigin(0.5, 0.5);
      return letterText;
    });

    const directionButtons = this.fetchConfig.throwDirections.map((direction) => {
      const directionButton = this.createUiButton(78, 78, direction.emoji, {
        fillColor: 0x1e293b,
        hoverColor: 0x334155,
        pressColor: 0x0f172a,
        fontSize: '34px',
        onClick: () => this.throwFetchBallInDirection(direction.x, direction.y)
      });

      return {
        direction,
        button: directionButton
      };
    });

    const cancelButton = this.createUiButton(222, 58, 'Nevermind', {
      fillColor: 0x334155,
      hoverColor: 0x475569,
      pressColor: 0x1e293b,
      fontSize: '24px',
      onClick: () => this.cancelThrowHud()
    });

    throwContainer.add([
      scrim,
      panel,
      glow,
      ballImage,
      whichWayText,
      cancelButton.container,
      ...archLetters,
      ...directionButtons.map((entry) => entry.button.container)
    ]);

    this.throwHudUi = {
      container: throwContainer,
      scrim,
      panel,
      glow,
      ballImage,
      whichWayText,
      archLetters,
      directionButtons,
      cancelButton
    };

    this.layoutFetchUi();
  }

  layoutFetchUi() {
    if (!this.fetchPromptUi || !this.fetchHudUi || !this.throwHudUi) {
      return;
    }

    const width = this.scale.width;
    const height = this.scale.height;
    const isTouchDevice = this.sys.game.device.input.touch;
    const minSide = Math.min(width, height);

    const promptY = isTouchDevice ? 146 : 120;
    this.fetchPromptUi.container.setPosition(width / 2, promptY);
    this.setScreenButtonPosition(this.fetchPromptUi, width / 2, promptY);

    const titleWidth = this.fetchHudUi.title.width;
    const badgeDiameter = 50;
    const iconToTitleGap = 18;
    const titleToButtonsGap = 32;
    const buttonGap = 12;
    const sidePadding = isTouchDevice ? 22 : 30;
    const maxHudWidth = Math.max(320, width - 32);
    const minHudWidth = Math.min(maxHudWidth, isTouchDevice ? 360 : 460);
    const contentWidth = badgeDiameter
      + iconToTitleGap
      + titleWidth
      + titleToButtonsGap
      + this.fetchHudUi.dropButton.width
      + buttonGap
      + this.fetchHudUi.throwButton.width;
    const hudPanelWidth = Phaser.Math.Clamp(contentWidth + (sidePadding * 2), minHudWidth, maxHudWidth);
    this.resizeUiRect(this.fetchHudUi.panel, hudPanelWidth, 78);
    this.fetchHudUi.container.setPosition(
      width / 2,
      isTouchDevice ? 82 : 62
    );
    const leftEdge = -hudPanelWidth / 2;
    const rightEdge = hudPanelWidth / 2;
    this.fetchHudUi.badge.setPosition(leftEdge + sidePadding + (badgeDiameter / 2), 0);
    this.fetchHudUi.ballIcon.setPosition(this.fetchHudUi.badge.x, 0);
    this.fetchHudUi.title.setPosition(this.fetchHudUi.badge.x + (badgeDiameter / 2) + iconToTitleGap, 0);
    const rightInset = sidePadding;
    const throwX = rightEdge - rightInset - (this.fetchHudUi.throwButton.width / 2);
    const dropX = throwX
      - (this.fetchHudUi.throwButton.width / 2)
      - buttonGap
      - (this.fetchHudUi.dropButton.width / 2);
    this.fetchHudUi.dropButton.container.setPosition(dropX, 0);
    this.fetchHudUi.throwButton.container.setPosition(throwX, 0);
    this.setScreenButtonPosition(
      this.fetchHudUi.dropButton,
      this.fetchHudUi.container.x + dropX,
      this.fetchHudUi.container.y
    );
    this.setScreenButtonPosition(
      this.fetchHudUi.throwButton,
      this.fetchHudUi.container.x + throwX,
      this.fetchHudUi.container.y
    );

    this.resizeUiRect(this.throwHudUi.scrim, width, height);
    this.throwHudUi.scrim.setPosition(width / 2, height / 2);
    this.resizeUiRect(
      this.throwHudUi.panel,
      Phaser.Math.Clamp(width * (isTouchDevice ? 0.68 : 0.54), 320, 560),
      Phaser.Math.Clamp(height * (isTouchDevice ? 0.56 : 0.7), 300, 540)
    );
    this.throwHudUi.panel.setPosition(width / 2, height / 2);

    const ballCenterX = width / 2;
    const ballCenterY = height * (isTouchDevice ? 0.54 : 0.58);
    const arcBaseY = height * (isTouchDevice ? 0.2 : 0.18);
    const arcRadiusX = Phaser.Math.Clamp(width * 0.18, 92, 154);
    const arcRadiusY = Phaser.Math.Clamp(height * 0.06, 26, 54);
    const directionRadiusX = Phaser.Math.Clamp(width * 0.22, 112, 196);
    const directionRadiusY = Phaser.Math.Clamp(height * 0.18, 110, 168);
    const ballScale = Phaser.Math.Clamp(minSide / 9500, 0.05, 0.074);

    this.throwHudUi.glow.setPosition(ballCenterX, ballCenterY + 12);
    this.resizeUiEllipse(
      this.throwHudUi.glow,
      Phaser.Math.Clamp(minSide * 0.42, 180, 340),
      Phaser.Math.Clamp(minSide * 0.18, 70, 120)
    );

    this.throwHudUi.ballImage.setPosition(ballCenterX, ballCenterY);
    this.throwHudUi.ballImage.setScale(ballScale);
    this.throwHudUi.whichWayText.setPosition(ballCenterX, ballCenterY - directionRadiusY - 72);
    this.throwHudUi.cancelButton.container.setPosition(ballCenterX, height - (isTouchDevice ? 82 : 64));

    const archAngles = [-1.05, -0.63, -0.21, 0.21, 0.63, 1.05];
    this.throwHudUi.archLetters.forEach((letterText, index) => {
      const angle = archAngles[index] || 0;
      letterText.setPosition(
        ballCenterX + (Math.sin(angle) * arcRadiusX),
        arcBaseY - (Math.cos(angle) * arcRadiusY)
      );
      letterText.setRotation(angle * 0.35);
    });

    this.throwHudUi.directionButtons.forEach((entry) => {
      if (entry.direction.id === 'up') {
        entry.button.container.setPosition(ballCenterX, ballCenterY - directionRadiusY);
      } else if (entry.direction.id === 'right') {
        entry.button.container.setPosition(ballCenterX + directionRadiusX, ballCenterY);
      } else if (entry.direction.id === 'down') {
        entry.button.container.setPosition(ballCenterX, ballCenterY + directionRadiusY);
      } else {
        entry.button.container.setPosition(ballCenterX - directionRadiusX, ballCenterY);
      }
    });

    if (this.throwHudBallTween) {
      this.throwHudBallTween.stop();
      this.throwHudBallTween = null;
    }

    this.throwHudBallTween = this.tweens.add({
      targets: this.throwHudUi.ballImage,
      y: ballCenterY - 10,
      angle: 4,
      duration: 1200,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });

    this.updateFetchUi();
  }

  shouldUseLocalFetchAuthority() {
    return !this.hasReceivedNetworkWorldState;
  }

  getLocalFetchBallState() {
    return this.fetchBall?.state || null;
  }

  getFetchNow() {
    return Date.now();
  }

  syncHeldBallOwnershipFlags(holderId) {
    Object.values(this.players).forEach((playerEntity) => {
      playerEntity.heldBallId = playerEntity.id === holderId ? this.fetchConfig.ball.id : null;
    });
  }

  buildBallCarrierDescriptor(playerEntity) {
    return {
      id: playerEntity.id,
      name: playerEntity.name,
      x: playerEntity.sprite.x,
      y: playerEntity.sprite.y,
      flipX: playerEntity.sprite.flipX,
      vx: playerEntity.vx || 0,
      vy: playerEntity.vy || 0
    };
  }

  canBallOccupy(worldX, worldY) {
    if (this.fetchShared?.canBallOccupyPosition) {
      return this.fetchShared.canBallOccupyPosition(
        worldX,
        worldY,
        (sampleX, sampleY) => this.isBlockedAtWorldPoint(sampleX, sampleY),
        this.fetchConfig
      );
    }

    return this.canPlayerOccupy(worldX, worldY);
  }

  createOfflineFetchBallState() {
    if (!this.fetchShared?.findBallSpawnPosition || !this.fetchShared?.createBallState) {
      return {
        id: this.fetchConfig.ball.id,
        x: this.spawnPoint.x + 140,
        y: this.spawnPoint.y - 90,
        vx: 0,
        vy: 0,
        radius: this.fetchConfig.ball.radius,
        holderId: null,
        pickupEnabledAt: 0,
        lastThrowerId: null,
        lastThrowerName: null,
        lastThrownAt: 0
      };
    }

    const spawnPoint = this.fetchShared.findBallSpawnPosition({
      config: this.fetchConfig,
      worldBounds: this.worldBounds,
      canOccupy: (candidateX, candidateY) => this.canBallOccupy(candidateX, candidateY),
      anchorPoint: {
        x: this.spawnPoint.x,
        y: this.spawnPoint.y
      },
      avoidPoints: [
        {
          x: this.spawnPoint.x,
          y: this.spawnPoint.y,
          minDistance: this.fetchConfig.spawn.minDistanceFromSpawn
        }
      ],
      fallbackPoint: {
        x: this.spawnPoint.x + 140,
        y: this.spawnPoint.y - 90
      }
    });

    return this.fetchShared.createBallState(spawnPoint, this.fetchConfig);
  }

  initializeOfflineFetchBallIfNeeded() {
    if (!this.fetchBall || this.hasReceivedNetworkWorldState || this.fetchBall.state) {
      return;
    }

    const state = this.createOfflineFetchBallState();
    this.fetchBall.state = state;
    this.fetchBall.renderX = state.x;
    this.fetchBall.renderY = state.y;
    this.fetchBall.targetX = state.x;
    this.fetchBall.targetY = state.y;
    this.syncHeldBallOwnershipFlags(null);
  }

  applyFetchBallSnapshot(snapshot, forceSnap = false) {
    if (!this.fetchBall) {
      return;
    }

    if (!snapshot) {
      return;
    }

    const previousHolderId = this.fetchBall.state?.holderId || null;
    const nextHolderId = snapshot.holderId || null;
    const shouldSnapPosition = forceSnap || !this.fetchBall.state || previousHolderId !== nextHolderId;

    this.fetchBall.state = {
      id: snapshot.id || this.fetchConfig.ball.id,
      x: typeof snapshot.x === 'number' ? snapshot.x : (this.fetchBall.state?.x ?? 0),
      y: typeof snapshot.y === 'number' ? snapshot.y : (this.fetchBall.state?.y ?? 0),
      vx: Number.isFinite(snapshot.vx) ? snapshot.vx : 0,
      vy: Number.isFinite(snapshot.vy) ? snapshot.vy : 0,
      radius: Number.isFinite(snapshot.radius) ? snapshot.radius : this.fetchConfig.ball.radius,
      holderId: nextHolderId,
      pickupEnabledAt: Number.isFinite(snapshot.pickupEnabledAt) ? snapshot.pickupEnabledAt : 0,
      lastThrowerId: snapshot.lastThrowerId || null,
      lastThrowerName: snapshot.lastThrowerName || null,
      lastThrownAt: Number.isFinite(snapshot.lastThrownAt) ? snapshot.lastThrownAt : 0
    };

    this.fetchBall.targetX = this.fetchBall.state.x;
    this.fetchBall.targetY = this.fetchBall.state.y;

    if (shouldSnapPosition || !this.fetchBall.sprite.visible) {
      this.fetchBall.renderX = this.fetchBall.state.x;
      this.fetchBall.renderY = this.fetchBall.state.y;
    }

    this.syncHeldBallOwnershipFlags(nextHolderId);
    this.updateFetchUi();
  }

  canLocalPlayerInteractWithBall(now = this.getFetchNow()) {
    const localPlayer = this.getLocalPlayer();
    const ballState = this.getLocalFetchBallState();
    if (!localPlayer || !ballState || this.throwHudOpen) {
      return false;
    }

    if (ballState.holderId || localPlayer.carId || localPlayer.heldBallId || this.isJumping) {
      return false;
    }

    if (Number.isFinite(ballState.pickupEnabledAt) && now < ballState.pickupEnabledAt) {
      return false;
    }

    const promptRadius = this.fetchConfig.interaction.promptRadius || 88;
    return Phaser.Math.Distance.Between(
      localPlayer.sprite.x,
      localPlayer.sprite.y,
      ballState.x,
      ballState.y
    ) <= promptRadius;
  }

  isLocalPlayerHoldingFetchBall() {
    const localPlayer = this.getLocalPlayer();
    const ballState = this.getLocalFetchBallState();
    return Boolean(localPlayer && ballState && ballState.holderId === localPlayer.id);
  }

  sendFetchAction(actionPayload) {
    if (!this.hasReceivedNetworkWorldState || !this.network || typeof this.network.sendFetchAction !== 'function') {
      return false;
    }

    this.network.sendFetchAction(actionPayload);
    return true;
  }

  requestFetchPickup() {
    const localPlayer = this.getLocalPlayer();
    const ballState = this.getLocalFetchBallState();
    if (!localPlayer || !ballState || !this.canLocalPlayerInteractWithBall(this.getFetchNow())) {
      return;
    }

    if (this.sendFetchAction({ type: 'pickup' })) {
      return;
    }

    const fetchedFromName = ballState.lastThrowerName;
    const holderDescriptor = this.buildBallCarrierDescriptor(localPlayer);

    ballState.holderId = localPlayer.id;
    ballState.pickupEnabledAt = 0;
    if (this.fetchShared?.placeBallAtHolder) {
      this.fetchShared.placeBallAtHolder(ballState, holderDescriptor, this.fetchConfig);
    }
    this.syncHeldBallOwnershipFlags(localPlayer.id);

    if (fetchedFromName) {
      this.queueTopMessage(`${localPlayer.name} fetched a ball from ${fetchedFromName}!`);
    }

    ballState.lastThrowerId = null;
    ballState.lastThrowerName = null;
    ballState.lastThrownAt = 0;
    this.updateFetchUi();
  }

  releaseLocalHeldFetchBall(mode, directionX = 0, directionY = 0) {
    const localPlayer = this.getLocalPlayer();
    const ballState = this.getLocalFetchBallState();
    if (!localPlayer || !ballState || ballState.holderId !== localPlayer.id) {
      return;
    }

    const holderDescriptor = this.buildBallCarrierDescriptor(localPlayer);

    if (this.fetchShared?.releaseBallFromHolder) {
      this.fetchShared.releaseBallFromHolder(
        ballState,
        holderDescriptor,
        this.getFetchNow(),
        {
          mode,
          directionX,
          directionY
        },
        this.fetchConfig
      );
    } else {
      ballState.holderId = null;
      ballState.x = holderDescriptor.x;
      ballState.y = holderDescriptor.y;
      ballState.vx = 0;
      ballState.vy = 0;
    }

    if (this.fetchShared?.findNearestBallPosition) {
      const nearestOpenPosition = this.fetchShared.findNearestBallPosition(
        ballState.x,
        ballState.y,
        (sampleX, sampleY) => this.isBlockedAtWorldPoint(sampleX, sampleY),
        this.fetchConfig,
        120,
        6
      );

      if (nearestOpenPosition) {
        ballState.x = nearestOpenPosition.x;
        ballState.y = nearestOpenPosition.y;
      }
    }

    this.fetchBall.renderX = ballState.x;
    this.fetchBall.renderY = ballState.y;
    this.fetchBall.targetX = ballState.x;
    this.fetchBall.targetY = ballState.y;
    this.syncHeldBallOwnershipFlags(null);
  }

  dropHeldFetchBall() {
    if (!this.isLocalPlayerHoldingFetchBall()) {
      return;
    }

    if (this.sendFetchAction({ type: 'drop' })) {
      return;
    }

    this.releaseLocalHeldFetchBall('drop');
    this.updateFetchUi();
  }

  openThrowHud() {
    if (!this.isLocalPlayerHoldingFetchBall()) {
      return;
    }

    this.throwHudOpen = true;
    this.updateFetchUi();
  }

  cancelThrowHud() {
    if (!this.throwHudOpen) {
      return;
    }

    this.throwHudOpen = false;
    this.updateFetchUi();
  }

  throwFetchBallInDirection(directionX, directionY) {
    if (!this.isLocalPlayerHoldingFetchBall()) {
      return;
    }

    this.throwHudOpen = false;

    if (this.sendFetchAction({
      type: 'throw',
      directionX,
      directionY
    })) {
      this.updateFetchUi();
      return;
    }

    this.releaseLocalHeldFetchBall('throw', directionX, directionY);
    this.updateFetchUi();
  }

  handleThrowHudKeyboardInput() {
    if (!this.throwHudOpen) {
      return false;
    }

    if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
      this.cancelThrowHud();
      return true;
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.keys.W)) {
      this.throwFetchBallInDirection(0, -1);
      return true;
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.right) || Phaser.Input.Keyboard.JustDown(this.keys.D)) {
      this.throwFetchBallInDirection(1, 0);
      return true;
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.down) || Phaser.Input.Keyboard.JustDown(this.keys.S)) {
      this.throwFetchBallInDirection(0, 1);
      return true;
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.left) || Phaser.Input.Keyboard.JustDown(this.keys.A)) {
      this.throwFetchBallInDirection(-1, 0);
      return true;
    }

    return false;
  }

  resolveFetchBallPlayerCollision(ballState, playerEntity) {
    if (!ballState || !playerEntity?.sprite || playerEntity.carId || ballState.holderId === playerEntity.id) {
      return;
    }

    const colliderPosition = this.fetchShared?.getPlayerBallColliderPosition
      ? this.fetchShared.getPlayerBallColliderPosition(
        {
          x: playerEntity.sprite.x,
          y: playerEntity.sprite.y
        },
        this.fetchConfig
      )
      : {
        x: playerEntity.sprite.x,
        y: playerEntity.sprite.y + this.fetchConfig.physics.playerCollisionOffsetY
      };

    const collision = this.fetchShared?.resolveBallCircleCollision
      ? this.fetchShared.resolveBallCircleCollision(
        ballState,
        {
          x: colliderPosition.x,
          y: colliderPosition.y,
          radius: this.fetchConfig.physics.playerCollisionRadius,
          vx: playerEntity.vx || 0,
          vy: playerEntity.vy || 0
        },
        {
          bounce: this.fetchConfig.physics.playerBounce,
          velocityTransfer: this.fetchConfig.physics.playerVelocityTransfer
        },
        this.fetchConfig
      )
      : null;

    if (!collision) {
      return;
    }

    const speed = Math.hypot(playerEntity.vx || 0, playerEntity.vy || 0);
    if (speed < (this.fetchConfig.physics.nudgeSpeedThreshold || 32) || !this.fetchShared?.applyBallImpulse) {
      return;
    }

    const direction = this.fetchShared.normalizeVector(
      playerEntity.vx || 0,
      playerEntity.vy || 0,
      collision.normalX,
      collision.normalY
    );
    const impulse = (this.fetchConfig.physics.nudgeImpulse || 210)
      + Math.min(speed * (this.fetchConfig.physics.nudgeSpeedFactor || 0.12), 120);

    this.fetchShared.applyBallImpulse(
      ballState,
      direction.x * impulse,
      direction.y * impulse,
      this.fetchConfig
    );
  }

  resolveFetchBallCarCollision(ballState, carEntity) {
    if (!ballState || !carEntity?.sprite || !this.fetchShared?.resolveBallCircleCollision) {
      return;
    }

    const definition = this.getCarDefinition(carEntity.id);
    if (!definition) {
      return;
    }

    this.fetchShared.resolveBallCircleCollision(
      ballState,
      {
        x: carEntity.sprite.x,
        y: carEntity.sprite.y,
        radius: (definition.physics?.collisionRadius || 70) + (this.fetchConfig.physics.carCollisionPadding || 10),
        vx: carEntity.vx || 0,
        vy: carEntity.vy || 0
      },
      {
        bounce: this.fetchConfig.physics.carBounce,
        velocityTransfer: this.fetchConfig.physics.carVelocityTransfer
      },
      this.fetchConfig
    );
  }

  updateFetchBallLocalPhysics(delta) {
    if (!this.shouldUseLocalFetchAuthority()) {
      return;
    }

    this.initializeOfflineFetchBallIfNeeded();
    const ballState = this.getLocalFetchBallState();
    if (!ballState) {
      return;
    }

    if (ballState.holderId) {
      const holder = this.players[ballState.holderId];
      if (!holder) {
        ballState.holderId = null;
        this.syncHeldBallOwnershipFlags(null);
        return;
      }

      if (this.fetchShared?.placeBallAtHolder) {
        this.fetchShared.placeBallAtHolder(
          ballState,
          this.buildBallCarrierDescriptor(holder),
          this.fetchConfig
        );
      }

      this.fetchBall.renderX = ballState.x;
      this.fetchBall.renderY = ballState.y;
      return;
    }

    if (!this.fetchShared?.advanceBall) {
      return;
    }

    this.fetchShared.advanceBall(ballState, delta / 1000, {
      config: this.fetchConfig,
      worldBounds: this.worldBounds,
      canOccupy: (candidateX, candidateY) => this.canBallOccupy(candidateX, candidateY),
      onStep: () => {
        Object.values(this.cars).forEach((carEntity) => {
          this.resolveFetchBallCarCollision(ballState, carEntity);
        });

        Object.values(this.players).forEach((playerEntity) => {
          this.resolveFetchBallPlayerCollision(ballState, playerEntity);
        });
      }
    });

    this.fetchBall.renderX = ballState.x;
    this.fetchBall.renderY = ballState.y;
    this.fetchBall.targetX = ballState.x;
    this.fetchBall.targetY = ballState.y;
  }

  interpolateFetchBall(delta) {
    if (!this.fetchBall?.state || this.shouldUseLocalFetchAuthority() || this.fetchBall.state.holderId) {
      return;
    }

    const smoothing = Phaser.Math.Clamp((delta / 1000) * 14, 0, 1);
    this.fetchBall.renderX = Phaser.Math.Linear(
      this.fetchBall.renderX ?? this.fetchBall.targetX,
      this.fetchBall.targetX,
      smoothing
    );
    this.fetchBall.renderY = Phaser.Math.Linear(
      this.fetchBall.renderY ?? this.fetchBall.targetY,
      this.fetchBall.targetY,
      smoothing
    );
  }

  updateFetchBallVisuals() {
    if (!this.fetchBall?.sprite || !this.fetchBall?.shadow) {
      return;
    }

    const ballState = this.getLocalFetchBallState();
    if (!ballState) {
      this.fetchBall.sprite.setVisible(false);
      this.fetchBall.shadow.setVisible(false);
      return;
    }

    let renderX = this.fetchBall.renderX ?? ballState.x;
    let renderY = this.fetchBall.renderY ?? ballState.y;

    if (ballState.holderId) {
      const holder = this.players[ballState.holderId];
      if (holder) {
        const heldPosition = this.fetchShared?.getHeldBallPosition
          ? this.fetchShared.getHeldBallPosition(
            {
              x: holder.sprite.x,
              y: holder.sprite.y,
              flipX: holder.sprite.flipX
            },
            this.fetchConfig
          )
          : {
            x: holder.sprite.x + ((holder.sprite.flipX ? -1 : 1) * this.fetchConfig.ball.holdOffsetX),
            y: holder.sprite.y + this.fetchConfig.ball.holdOffsetY
          };

        renderX = heldPosition.x;
        renderY = heldPosition.y;
        this.fetchBall.renderX = renderX;
        this.fetchBall.renderY = renderY;
      }
    }

    this.fetchBall.sprite.setVisible(true);
    this.fetchBall.sprite.setPosition(renderX, renderY);
    this.fetchBall.sprite.setScale(this.fetchConfig.ball.displayScale);

    if (ballState.holderId) {
      const frame = this.fetchBall.sprite.frame;
      const cropWidth = frame?.cutWidth || this.fetchBall.sprite.width;
      const cropHeight = frame?.cutHeight || this.fetchBall.sprite.height;
      const cropTop = Math.floor(cropHeight / 3);
      this.fetchBall.sprite.setCrop(0, cropTop, cropWidth, cropHeight - cropTop);
      const holder = this.players[ballState.holderId];
      this.fetchBall.shadow.setVisible(false);
      this.fetchBall.sprite.setDepth((holder?.sprite?.depth || renderY) + 6);
      return;
    }

    this.fetchBall.sprite.setCrop();
    this.fetchBall.shadow.setVisible(true);
    this.fetchBall.shadow.setPosition(renderX, renderY + 18);
    this.fetchBall.shadow.setDepth(renderY + 8);
    this.fetchBall.sprite.setDepth(renderY + 14);
  }

  updateFetchUi() {
    if (!this.fetchPromptUi || !this.fetchHudUi || !this.throwHudUi) {
      return;
    }

    const canFetch = this.canLocalPlayerInteractWithBall(this.getFetchNow());
    const isHoldingBall = this.isLocalPlayerHoldingFetchBall();
    if (this.throwHudOpen && !isHoldingBall) {
      this.throwHudOpen = false;
    }
    const showOverlay = this.throwHudOpen && isHoldingBall;
    const showRegularHud = !showOverlay;

    this.fetchPromptUi.container.setVisible(showRegularHud && canFetch);
    this.fetchHudUi.container.setVisible(showRegularHud && isHoldingBall);
    this.throwHudUi.container.setVisible(showOverlay);
    this.syncScreenButtonVisibility(this.fetchPromptUi, showRegularHud && canFetch);
    this.syncScreenButtonVisibility(this.fetchHudUi.dropButton, showRegularHud && isHoldingBall);
    this.syncScreenButtonVisibility(this.fetchHudUi.throwButton, showRegularHud && isHoldingBall);

    this.emoteButtonElements.forEach((element) => {
      element.setVisible(showRegularHud);
    });

    this.mobileControlElements.forEach((element) => {
      element.setVisible(showRegularHud);
    });

    if (this.carExitHintText) {
      this.carExitHintText.setVisible(showRegularHud);
    }

    this.layoutTopMessageUi();
  }

  update(time, delta) {
    const localPlayer = this.getLocalPlayer();
    if (!localPlayer) {
      this.interpolateCars(delta);
      this.syncPlayersToCars();
      this.updateTireTracks(time);
      this.interpolateRemotePlayers(delta);
      this.interpolateFetchBall(delta);
      this.updateFetchBallVisuals();
      this.updateAllPlayerDecorations();
      this.updateControlModeUi();
      this.updateFetchUi();
      return;
    }

    this.updateMoveVectorFromInput();
    this.interpolateCars(delta);
    this.syncPlayersToCars();

    if (this.throwHudOpen) {
      this.handleThrowHudKeyboardInput();
      this.moveVector.set(0, 0);
      localPlayer.vx = 0;
      localPlayer.vy = 0;
      localPlayer.sprite.setVelocity(0, 0);
      this.playEntityAnimation(localPlayer, 'stand');
      this.interpolateRemotePlayers(delta);
      this.syncPlayersToCars();
      this.updateTireTracks(time);
      if (this.shouldUseLocalFetchAuthority()) {
        this.updateFetchBallLocalPhysics(delta);
      } else {
        this.interpolateFetchBall(delta);
      }
      this.updateFetchBallVisuals();
      this.updateAllPlayerDecorations();
      this.updateControlModeUi();
      this.updateFetchUi();
      this.sendNetworkInput(time, 'stand');
      return;
    }

    const jumpPressed = Phaser.Input.Keyboard.JustDown(this.spaceKey) || this.mobileJumpRequested;

    if (localPlayer.carId) {
      if (jumpPressed) {
        this.pendingCarExitRequest = true;
      }

      this.mobileJumpRequested = false;
      localPlayer.sprite.setVelocity(0, 0);
      localPlayer.vx = 0;
      localPlayer.vy = 0;

      this.interpolateRemotePlayers(delta);
      this.syncPlayersToCars();
      this.updateTireTracks(time);
      this.interpolateFetchBall(delta);
      this.updateFetchBallVisuals();
      this.updateAllPlayerDecorations();
      this.updateControlModeUi();
      this.updateFetchUi();
      this.sendNetworkInput(time, 'sit', this.pendingCarExitRequest);
      return;
    }

    if (jumpPressed && !this.isJumping) {
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
      this.interpolateRemotePlayers(delta);
      if (this.shouldUseLocalFetchAuthority()) {
        this.updateFetchBallLocalPhysics(delta);
      } else {
        this.interpolateFetchBall(delta);
      }
      this.updateFetchBallVisuals();
      this.updateAllPlayerDecorations();
      this.updateControlModeUi();
      this.updateFetchUi();
      this.sendNetworkInput(time, 'jump', true);
      return;
    }
    this.mobileJumpRequested = false;

    if (this.isJumping) {
      localPlayer.vx = 0;
      localPlayer.vy = 0;
      this.updateAllPlayerDecorations();
      this.interpolateRemotePlayers(delta);
      this.updateTireTracks(time);
      if (this.shouldUseLocalFetchAuthority()) {
        this.updateFetchBallLocalPhysics(delta);
      } else {
        this.interpolateFetchBall(delta);
      }
      this.updateFetchBallVisuals();
      this.updateControlModeUi();
      this.updateFetchUi();
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      if (this.isLocalPlayerHoldingFetchBall()) {
        this.openThrowHud();
      } else {
        this.requestFetchPickup();
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.dropKey)) {
      this.dropHeldFetchBall();
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

    localPlayer.sprite.setVelocity(0, 0);

    const previousX = localPlayer.sprite.x;
    const previousY = localPlayer.sprite.y;
    const isSprinting = this.getIsSprinting() && this.moveVector.lengthSq() > 0;
    const moveSpeed = this.SPEED * (isSprinting ? this.SPRINT_MULTIPLIER : 1);
    const moveStep = moveSpeed * (delta / 1000);
    const targetX = localPlayer.sprite.x + (this.moveVector.x * moveStep);
    const targetY = localPlayer.sprite.y + (this.moveVector.y * moveStep);
    const resolvedX = this.sweepToWalkablePosition(
      localPlayer.sprite.x,
      localPlayer.sprite.y,
      targetX,
      localPlayer.sprite.y
    );
    localPlayer.sprite.x = resolvedX.x;

    const resolvedY = this.sweepToWalkablePosition(
      localPlayer.sprite.x,
      localPlayer.sprite.y,
      localPlayer.sprite.x,
      targetY
    );
    localPlayer.sprite.y = resolvedY.y;

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
    const elapsedSeconds = Math.max(delta / 1000, 0.0001);
    localPlayer.vx = (localPlayer.sprite.x - previousX) / elapsedSeconds;
    localPlayer.vy = (localPlayer.sprite.y - previousY) / elapsedSeconds;
    this.interpolateRemotePlayers(delta);
    this.syncPlayersToCars();
    this.updateTireTracks(time);
    if (this.shouldUseLocalFetchAuthority()) {
      this.updateFetchBallLocalPhysics(delta);
    } else {
      this.interpolateFetchBall(delta);
    }
    this.updateFetchBallVisuals();
    this.updateAllPlayerDecorations();
    this.updateControlModeUi();
    this.updateFetchUi();

    this.sendNetworkInput(time, isMoving ? (isSprinting ? 'run' : 'walk') : 'stand');
  }

  interpolateRemotePlayers(delta) {
    const smoothing = Phaser.Math.Clamp((delta / 1000) * 12, 0, 1);

    Object.values(this.players).forEach((playerEntity) => {
      if (playerEntity.isLocal || playerEntity.carId) {
        return;
      }

      if (typeof playerEntity.targetX === 'number' && typeof playerEntity.targetY === 'number') {
        const previousX = playerEntity.sprite.x;
        const previousY = playerEntity.sprite.y;
        playerEntity.sprite.x = Phaser.Math.Linear(playerEntity.sprite.x, playerEntity.targetX, smoothing);
        playerEntity.sprite.y = Phaser.Math.Linear(playerEntity.sprite.y, playerEntity.targetY, smoothing);
        const deltaSeconds = Math.max(delta / 1000, 0.0001);
        playerEntity.vx = (playerEntity.sprite.x - previousX) / deltaSeconds;
        playerEntity.vy = (playerEntity.sprite.y - previousY) / deltaSeconds;
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

    const isDriving = Boolean(localPlayer.carId);
    const exitCar = this.pendingCarExitRequest;

    this.network.sendInput({
      moveX: this.moveVector.x,
      moveY: this.moveVector.y,
      jump: this.isJumping,
      animation: isDriving ? 'sit' : animationState,
      x: localPlayer.sprite.x,
      y: localPlayer.sprite.y,
      flipX: isDriving ? false : localPlayer.sprite.flipX,
      carDirectionX: isDriving ? Phaser.Math.Clamp(this.moveVector.x, -1, 1) : 0,
      carDirectionY: isDriving ? Phaser.Math.Clamp(this.moveVector.y, -1, 1) : 0,
      carThrottle: isDriving ? Phaser.Math.Clamp(this.moveVector.y, -1, 1) : 0,
      carSteer: isDriving ? Phaser.Math.Clamp(this.moveVector.x, -1, 1) : 0,
      carBoost: isDriving ? this.getIsSprinting() : false,
      exitCar
    });

    this.pendingCarExitRequest = false;
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
    const isSeated = Boolean(playerEntity.carId);
    const nameOffset = isSeated ? 118 : 100;
    const typeOffset = isSeated ? 94 : 75;

    if (!isSeated) {
      playerEntity.sprite.setDepth(playerEntity.sprite.y + 20);
    }

    playerEntity.playerNameText.setPosition(playerEntity.sprite.x, playerEntity.sprite.y - nameOffset);
    playerEntity.dogTypeText.setPosition(playerEntity.sprite.x, playerEntity.sprite.y - typeOffset);
    playerEntity.playerNameText.setDepth(playerEntity.sprite.depth + 20);
    playerEntity.dogTypeText.setDepth(playerEntity.sprite.depth + 21);

    if (playerEntity.currentEmote && playerEntity.currentEmote.active && playerEntity.currentEmote.alpha === 1) {
      playerEntity.currentEmote.setPosition(playerEntity.sprite.x, playerEntity.sprite.y - (isSeated ? 154 : 140));
      playerEntity.currentEmote.setDepth(playerEntity.sprite.depth + 30);
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

    if (this.fetchUiPointerHandler) {
      this.input.off('pointerdown', this.fetchUiPointerHandler);
      this.fetchUiPointerHandler = null;
    }

    Object.keys(this.players).forEach((playerId) => {
      this.removePlayer(playerId);
    });

    Object.keys(this.cars).forEach((carId) => {
      this.removeCar(carId);
    });

    this.players = {};
    this.cars = {};
    this.clearEmoteButtons();
    this.clearMobileControls();
    this.extraPointersAdded = false;
    this.pendingCarExitRequest = false;
    this.tireTrackSegments = [];

    if (this.tireTrackGraphics) {
      this.tireTrackGraphics.destroy();
      this.tireTrackGraphics = null;
    }

    if (this.carExitHintText) {
      this.carExitHintText.destroy();
      this.carExitHintText = null;
    }

    if (this.jumpTween) {
      this.jumpTween.stop();
      this.jumpTween = null;
    }

    if (this.throwHudBallTween) {
      this.throwHudBallTween.stop();
      this.throwHudBallTween = null;
    }

    if (this.topMessageUi?.container) {
      this.topMessageUi.container.destroy();
      this.topMessageUi = null;
    }

    this.destroyScreenButtonZone(this.fetchPromptUi);
    this.destroyScreenButtonZone(this.fetchHudUi?.dropButton);
    this.destroyScreenButtonZone(this.fetchHudUi?.throwButton);

    if (this.fetchPromptUi?.container) {
      this.fetchPromptUi.container.destroy();
      this.fetchPromptUi = null;
    }

    if (this.fetchHudUi?.container) {
      this.fetchHudUi.container.destroy();
      this.fetchHudUi = null;
    }

    if (this.throwHudUi?.container) {
      this.throwHudUi.container.destroy();
      this.throwHudUi = null;
    }

    if (this.fetchBall?.sprite) {
      this.fetchBall.sprite.destroy();
    }

    if (this.fetchBall?.shadow) {
      this.fetchBall.shadow.destroy();
    }

    this.fetchBall = null;
    this.throwHudOpen = false;
    this.topMessageQueue = [];
    this.activeTopMessageTween = null;
    this.hasReceivedNetworkWorldState = false;
    this.isJumping = false;
  }
}
