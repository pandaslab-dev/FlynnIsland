const LOADING_FALLBACK_WORLD_CONFIG = Object.freeze({
  islandArt: Object.freeze({
    textureKey: 'island',
    imagePath: 'misc_assets/island-4096.png',
    requestPath: 'misc_assets/island-4096.png'
  }),
  collisionMask: Object.freeze({
    textureKey: 'islandedge',
    imagePath: 'misc_assets/island-4096-edge.png',
    requestPath: 'misc_assets/island-4096-edge.png'
  })
});

const LOADING_FALLBACK_RACING_CONFIG = Object.freeze({
  cars: Object.freeze([])
});

function getLoadingWorldConfig() {
  if (window.FlynnIslandWorldConfig && window.FlynnIslandWorldConfig.islandArt) {
    return window.FlynnIslandWorldConfig;
  }

  return LOADING_FALLBACK_WORLD_CONFIG;
}

function getLoadingRacingConfig() {
  if (window.FlynnRacingConfig && Array.isArray(window.FlynnRacingConfig.cars)) {
    return window.FlynnRacingConfig;
  }

  return LOADING_FALLBACK_RACING_CONFIG;
}

function getLoadingFetchConfig() {
  if (window.FlynnFetchConfig && window.FlynnFetchConfig.ball) {
    return window.FlynnFetchConfig;
  }

  return null;
}

function getLoadingLazyRiverConfig() {
  if (window.FlynnLazyRiverConfig && Array.isArray(window.FlynnLazyRiverConfig.tubes)) {
    return window.FlynnLazyRiverConfig;
  }

  return null;
}

class LoadingScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LoadingScene' });
    this.backgroundImage = null;
    this.playerName = '';
    this.dogType = 'Remix';
    this.resizeHandler = null;
    this.logo = null;
    this.loadingText = null;
    this.progressBarBg = null;
    this.progressBarFill = null;
    this.progressValue = 0;
    this.hasStartedGame = false;
  }

  init(data) {
    this.playerName = data?.playerName || '';
    this.dogType = data?.dogType || 'Remix';
    this.progressValue = 0;
    this.hasStartedGame = false;
  }

  preload() {
    this.setupLoadingUi();
    this.layoutScene();
    this.updateProgressVisuals(this.progressValue);

    const worldConfig = getLoadingWorldConfig();
    const racingConfig = getLoadingRacingConfig();
    const fetchConfig = getLoadingFetchConfig();
    const lazyRiverConfig = getLoadingLazyRiverConfig();
    const dogKeys = ['alice', 'remix', 'sapphire', 'wendy'];

    if (window.FlynnGameAssetLoader && typeof window.FlynnGameAssetLoader.queueGameAssets === 'function') {
      window.FlynnGameAssetLoader.queueGameAssets(
        this,
        worldConfig,
        racingConfig,
        dogKeys,
        fetchConfig,
        lazyRiverConfig
      );
    }

    this.load.on('progress', this.handleLoadProgress, this);
    this.load.once('complete', this.handleLoadComplete, this);
  }

  create() {
    this.setupLoadingUi();
    this.layoutScene();
    this.updateProgressVisuals(this.progressValue);

    this.resizeHandler = () => this.layoutScene();
    this.scale.on('resize', this.resizeHandler);

    this.events.once('shutdown', this.handleSceneShutdown, this);
    this.events.once('destroy', this.handleSceneShutdown, this);
  }

  setupLoadingUi() {
    this.cameras.main.setBackgroundColor('#0f172a');

    if (!this.backgroundImage && window.FlynnMenuBackground && typeof window.FlynnMenuBackground.create === 'function') {
      this.backgroundImage = window.FlynnMenuBackground.create(this);
    }

    if (!this.logo) {
      if (this.textures.exists('logo')) {
        this.logo = this.add.image(0, 0, 'logo');
      } else {
        this.logo = this.add.text(0, 0, 'Flynn Island', {
          fontSize: '56px',
          fontFamily: 'Arial, sans-serif',
          color: '#ffffff',
          stroke: '#0f172a',
          strokeThickness: 8
        });
        this.logo.setOrigin(0.5, 0.5);
      }
    }

    if (!this.loadingText) {
      this.loadingText = this.add.text(0, 0, 'Loading island... 0%', {
        fontSize: '28px',
        fontFamily: 'Arial, sans-serif',
        color: '#ffffff',
        stroke: '#0f172a',
        strokeThickness: 6,
        align: 'center'
      });
      this.loadingText.setOrigin(0.5, 0.5);
    }

    if (!this.progressBarBg) {
      this.progressBarBg = this.add.rectangle(0, 0, 420, 22, 0x16324f, 0.38);
      this.progressBarBg.setStrokeStyle(3, 0xffffff, 0.55);
    }

    if (!this.progressBarFill) {
      this.progressBarFill = this.add.rectangle(0, 0, 0, 14, 0xffffff, 0.88);
      this.progressBarFill.setOrigin(0, 0.5);
    }
  }

  handleLoadProgress(value) {
    this.progressValue = Phaser.Math.Clamp(value, 0, 1);
    this.updateProgressVisuals(this.progressValue);
  }

  handleLoadComplete() {
    this.progressValue = 1;
    this.updateProgressVisuals(1);

    this.time.delayedCall(120, () => {
      if (this.hasStartedGame) {
        return;
      }

      this.hasStartedGame = true;
      this.scene.start('GameScene', {
        playerName: this.playerName,
        dogType: this.dogType
      });
    });
  }

  layoutScene() {
    if (!this.logo || !this.loadingText || !this.progressBarBg || !this.progressBarFill) {
      return;
    }

    if (this.backgroundImage && window.FlynnMenuBackground && typeof window.FlynnMenuBackground.layout === 'function') {
      window.FlynnMenuBackground.layout(this, this.backgroundImage);
    }

    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    const isPortrait = this.scale.height > this.scale.width;
    const logoScale = this.logo.type === 'Image'
      ? Math.min(
        isPortrait ? 0.34 : 0.42,
        (this.scale.width - 48) / this.logo.width
      )
      : 1;

    if (this.logo.type === 'Image') {
      this.logo.setScale(logoScale);
    }

    const logoY = centerY - (isPortrait ? 116 : 98);
    const textY = centerY + (isPortrait ? 72 : 58);
    const barWidth = Phaser.Math.Clamp(this.scale.width * (isPortrait ? 0.68 : 0.42), 240, 460);

    this.logo.setPosition(centerX, logoY);
    this.loadingText.setPosition(centerX, textY);
    this.progressBarBg.setPosition(centerX, textY + 50);
    this.progressBarBg.setSize(barWidth, this.progressBarBg.height);

    this.updateProgressVisuals(this.progressValue);
  }

  updateProgressVisuals(value) {
    if (!this.loadingText || !this.progressBarBg || !this.progressBarFill) {
      return;
    }

    const normalized = Phaser.Math.Clamp(value, 0, 1);
    const percent = Math.round(normalized * 100);
    const fillWidth = Math.max(0, (this.progressBarBg.width - 8) * normalized);

    this.loadingText.setText(`Loading island... ${percent}%`);
    this.progressBarFill.setPosition(
      this.progressBarBg.x - (this.progressBarBg.width / 2) + 4,
      this.progressBarBg.y
    );
    this.progressBarFill.setSize(fillWidth, Math.max(10, this.progressBarBg.height - 8));
  }

  handleSceneShutdown() {
    this.load.off('progress', this.handleLoadProgress, this);

    if (this.resizeHandler) {
      this.scale.off('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
  }
}
