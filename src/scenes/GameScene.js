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
        this.DOG_KEYS
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
    carEntity.targetSpeed = Number.isFinite(snapshot.speed) ? snapshot.speed : carEntity.targetSpeed;
    carEntity.targetTurnRate = Number.isFinite(snapshot.turnRate) ? snapshot.turnRate : carEntity.targetTurnRate;
    carEntity.occupantId = snapshot.occupantId || null;
    carEntity.isBoosting = Boolean(snapshot.isBoosting);
    carEntity.isSpinningOut = Boolean(snapshot.isSpinningOut);

    if (snapToPosition) {
      carEntity.sprite.setPosition(carEntity.targetX, carEntity.targetY);
      carEntity.sprite.setRotation(carEntity.targetAngle);
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
    this.carExitHintText.setDepth(3200);
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
        carId: null,
        currentPose: 'foot'
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
    const playersSnapshot = Array.isArray(worldState)
      ? worldState
      : Array.isArray(worldState?.players)
        ? worldState.players
        : [];
    const carsSnapshot = Array.isArray(worldState?.cars)
      ? worldState.cars
      : [];

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

    if (this.shouldRebuildMobileControls()) {
      this.createMobileControls();
    }

    this.updateControlModeUi();
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
    this.jumpButtonLabel = jumpLabel;
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

  update(time, delta) {
    const localPlayer = this.getLocalPlayer();
    if (!localPlayer) {
      this.interpolateCars(delta);
      this.syncPlayersToCars();
      this.updateTireTracks(time);
      this.interpolateRemotePlayers(delta);
      this.updateAllPlayerDecorations();
      this.updateControlModeUi();
      return;
    }

    this.updateMoveVectorFromInput();
    this.interpolateCars(delta);
    this.syncPlayersToCars();

    const jumpPressed = Phaser.Input.Keyboard.JustDown(this.spaceKey) || this.mobileJumpRequested;

    if (localPlayer.carId) {
      if (jumpPressed) {
        this.pendingCarExitRequest = true;
      }

      this.mobileJumpRequested = false;
      localPlayer.sprite.setVelocity(0, 0);

      this.interpolateRemotePlayers(delta);
      this.syncPlayersToCars();
      this.updateTireTracks(time);
      this.updateAllPlayerDecorations();
      this.updateControlModeUi();
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
      this.updateAllPlayerDecorations();
      this.sendNetworkInput(time, 'jump', true);
      return;
    }
    this.mobileJumpRequested = false;

    if (this.isJumping) {
      this.updateAllPlayerDecorations();
      this.interpolateRemotePlayers(delta);
      this.updateTireTracks(time);
      this.updateControlModeUi();
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

    localPlayer.sprite.setVelocity(0, 0);

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
    this.interpolateRemotePlayers(delta);
    this.syncPlayersToCars();
    this.updateTireTracks(time);
    this.updateAllPlayerDecorations();
    this.updateControlModeUi();

    this.sendNetworkInput(time, isMoving ? (isSprinting ? 'run' : 'walk') : 'stand');
  }

  interpolateRemotePlayers(delta) {
    const smoothing = Phaser.Math.Clamp((delta / 1000) * 12, 0, 1);

    Object.values(this.players).forEach((playerEntity) => {
      if (playerEntity.isLocal || playerEntity.carId) {
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
    this.isJumping = false;
  }
}
