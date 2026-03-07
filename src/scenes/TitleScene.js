// ============================================
// TITLE SCENE
// ============================================
// This is the first scene players see
// Shows logo + Play Now button

class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
    this.logo = null;
    this.playButton = null;
    this.muteButton = null;
    this.volumeLabel = null;
    this.volumeTrack = null;
    this.volumeFill = null;
    this.volumeHandle = null;
    this.playButtonScales = {
      base: 0.3,
      hover: 0.35,
      pressed: 0.25
    };
    this.resizeHandler = null;
  }

  preload() {
    this.load.image('logo', 'misc_assets/logo.png');
    this.load.image('playnow', 'misc_assets/playnow.png');
    this.load.audio('background_music', 'misc_assets/music.mp3');
  }

  create() {
    this.cameras.main.setBackgroundColor('#87CEEB');

    this.initializeAudioState();
    this.ensureBackgroundMusic();

    this.logo = this.add.image(0, 0, 'logo');
    this.playButton = this.add.image(0, 0, 'playnow');
    this.playButton.setInteractive({ useHandCursor: true });

    this.playButton.on('pointerover', () => {
      this.tweens.add({
        targets: this.playButton,
        scaleX: this.playButtonScales.hover,
        scaleY: this.playButtonScales.hover,
        duration: 100,
        ease: 'Power2'
      });
    });

    this.playButton.on('pointerout', () => {
      this.tweens.add({
        targets: this.playButton,
        scaleX: this.playButtonScales.base,
        scaleY: this.playButtonScales.base,
        duration: 100,
        ease: 'Power2'
      });
    });

    this.playButton.on('pointerdown', () => {
      this.ensureBackgroundMusic();

      this.tweens.add({
        targets: this.playButton,
        scaleX: this.playButtonScales.pressed,
        scaleY: this.playButtonScales.pressed,
        duration: 50,
        yoyo: true,
        onComplete: () => {
          this.scene.start('NameInputScene');
        }
      });
    });

    this.createMuteButton();
    this.createVolumeControls();
    this.layoutScene();

    this.resizeHandler = () => this.layoutScene();
    this.scale.on('resize', this.resizeHandler);

    this.events.once('shutdown', this.handleSceneShutdown, this);
    this.events.once('destroy', this.handleSceneShutdown, this);
  }

  getViewportFlags() {
    if (window.FlynnViewportScaler && typeof window.FlynnViewportScaler.resolveViewportFlags === 'function') {
      return window.FlynnViewportScaler.resolveViewportFlags(this.scale.width, this.scale.height);
    }

    return {
      hasTouch: window.matchMedia('(pointer: coarse)').matches,
      isPortrait: this.scale.height > this.scale.width,
      isTablet: false
    };
  }

  getMusicVolume() {
    const storedVolume = Number(window.flynnMusicVolume);
    if (!Number.isFinite(storedVolume)) {
      return 0.5;
    }

    return Phaser.Math.Clamp(storedVolume, 0, 1);
  }

  setMusicMuted(isMuted) {
    window.flynnMusicMuted = Boolean(isMuted);
    this.applyAudioState();
    this.refreshMuteButtonLabel();
  }

  setMusicVolume(nextVolume) {
    window.flynnMusicVolume = Phaser.Math.Clamp(nextVolume, 0, 1);
    this.applyAudioState();
    this.refreshVolumeControls();
  }

  applyAudioState() {
    this.sound.mute = Boolean(window.flynnMusicMuted);

    const music = this.sound.get('background_music');
    if (music) {
      music.setVolume(this.getMusicVolume());
    }
  }

  layoutScene() {
    if (!this.logo || !this.playButton || !this.volumeLabel || !this.volumeTrack || !this.volumeHandle) {
      return;
    }

    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    const flags = this.getViewportFlags();
    const isPhone = flags.hasTouch && !flags.isTablet;
    const uiScale = window.FlynnViewportScaler
      ? window.FlynnViewportScaler.getUiScale(this.scale.width, this.scale.height)
      : 1;

    const margin = isPhone ? 36 : 26;

    let logoScale = flags.isPortrait
      ? (flags.isTablet ? 0.45 : isPhone ? 0.34 : 0.4)
      : isPhone
        ? 0.3
        : Phaser.Math.Clamp(0.45 + ((uiScale - 1) * 0.2), 0.42, 0.55);
    let buttonBaseScale = flags.isPortrait
      ? (flags.isTablet ? 0.29 : isPhone ? 0.22 : 0.26)
      : isPhone
        ? 0.2
        : Phaser.Math.Clamp(0.29 + ((uiScale - 1) * 0.12), 0.27, 0.34);

    const maxWidth = this.scale.width - (margin * 2);
    logoScale = Math.min(logoScale, maxWidth / this.logo.width);
    buttonBaseScale = Math.min(buttonBaseScale, maxWidth / this.playButton.width);

    this.logo.setScale(logoScale);
    this.playButton.setScale(buttonBaseScale);

    this.playButtonScales.base = buttonBaseScale;
    this.playButtonScales.hover = buttonBaseScale + 0.04;
    this.playButtonScales.pressed = Math.max(buttonBaseScale - 0.04, 0.2);

    let buttonY = centerY + (
      flags.isPortrait
        ? (flags.isTablet ? 132 : isPhone ? 118 : 120)
        : (isPhone ? 88 : 120)
    );
    const logoGap = flags.isPortrait
      ? (flags.isTablet ? 38 : isPhone ? 18 : 24)
      : (isPhone ? 16 : 22);
    let logoY = buttonY - ((this.logo.displayHeight + this.playButton.displayHeight) / 2) - logoGap;

    const sliderWidth = Phaser.Math.Clamp(this.scale.width * (flags.isPortrait ? 0.52 : 0.3), 190, 320);
    const sliderHeight = isPhone ? 10 : 12;
    let volumeLabelY = buttonY + (this.playButton.displayHeight / 2) + (flags.isPortrait ? 40 : 34);
    let volumeTrackY = volumeLabelY + 28;
    this.logo.setPosition(centerX, logoY);
    this.playButton.setPosition(centerX, buttonY);

    this.volumeLabel.setPosition(centerX, volumeLabelY);
    this.volumeTrack.setPosition(centerX, volumeTrackY);
    this.volumeTrack.setDisplaySize(sliderWidth, sliderHeight);
    this.refreshVolumeControls();

    const topEdge = this.logo.y - (this.logo.displayHeight / 2);
    const bottomEdge = this.volumeHandle.y + (this.volumeHandle.displayHeight / 2);
    const usableTop = margin;
    const usableBottom = this.scale.height - margin;
    let shiftY = 0;

    if (topEdge < usableTop) {
      shiftY += usableTop - topEdge;
    }
    if ((bottomEdge + shiftY) > usableBottom) {
      shiftY -= (bottomEdge + shiftY) - usableBottom;
    }

    if (shiftY !== 0) {
      logoY += shiftY;
      buttonY += shiftY;
      volumeLabelY += shiftY;
      volumeTrackY += shiftY;

      this.logo.setPosition(centerX, logoY);
      this.playButton.setPosition(centerX, buttonY);
      this.volumeLabel.setPosition(centerX, volumeLabelY);
      this.volumeTrack.setPosition(centerX, volumeTrackY);
    }

    if (this.muteButton) {
      const muteMargin = isPhone ? 16 : 18;
      this.muteButton.setPosition(this.scale.width - muteMargin, muteMargin);
    }

    this.refreshVolumeControls();
  }

  handleSceneShutdown() {
    if (this.resizeHandler) {
      this.scale.off('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
  }

  ensureBackgroundMusic() {
    const playMusic = () => {
      let music = this.sound.get('background_music');

      if (!music) {
        music = this.sound.add('background_music', {
          loop: true,
          volume: this.getMusicVolume()
        });
      }

      music.setVolume(this.getMusicVolume());

      if (!music.isPlaying) {
        music.play({
          loop: true,
          volume: this.getMusicVolume()
        });
      }

      this.applyAudioState();
    };

    const existingMusic = this.sound.get('background_music');
    if (existingMusic && existingMusic.isPlaying) {
      this.applyAudioState();
      return;
    }

    if (this.sound.locked) {
      this.sound.once(Phaser.Sound.Events.UNLOCKED, playMusic);
      this.input.once('pointerdown', () => {
        this.sound.unlock();
      });
      return;
    }

    playMusic();
  }

  initializeAudioState() {
    if (typeof window.flynnMusicMuted === 'undefined') {
      window.flynnMusicMuted = false;
    }

    if (!Number.isFinite(Number(window.flynnMusicVolume))) {
      window.flynnMusicVolume = 0.5;
    }

    this.applyAudioState();
  }

  createMuteButton() {
    this.muteButton = this.add.text(0, 0, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      color: '#ffffff',
      padding: { x: 14, y: 8 }
    });
    this.muteButton.setOrigin(1, 0);
    this.muteButton.setDepth(100);
    this.muteButton.setInteractive({ useHandCursor: true });

    this.muteButton.on('pointerdown', () => {
      this.ensureBackgroundMusic();
      this.setMusicMuted(!this.sound.mute);
    });

    this.muteButton.on('pointerover', () => {
      this.muteButton.setAlpha(1);
    });

    this.muteButton.on('pointerout', () => {
      this.muteButton.setAlpha(0.92);
    });

    this.refreshMuteButtonLabel();
    this.muteButton.setAlpha(0.92);
  }

  createVolumeControls() {
    this.volumeLabel = this.add.text(0, 0, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center'
    });
    this.volumeLabel.setOrigin(0.5, 0.5);
    this.volumeLabel.setDepth(90);

    this.volumeTrack = this.add.rectangle(0, 0, 240, 12, 0x164e63, 0.72);
    this.volumeTrack.setStrokeStyle(2, 0xffffff, 0.55);
    this.volumeTrack.setDepth(90);
    this.volumeTrack.setInteractive({ useHandCursor: true });

    this.volumeFill = this.add.rectangle(0, 0, 120, 12, 0xfbbf24, 0.96);
    this.volumeFill.setOrigin(0, 0.5);
    this.volumeFill.setDepth(91);

    this.volumeHandle = this.add.circle(0, 0, 12, 0xfffbeb, 1);
    this.volumeHandle.setStrokeStyle(2, 0x164e63, 0.9);
    this.volumeHandle.setDepth(92);
    this.volumeHandle.setInteractive({ useHandCursor: true });
    this.input.setDraggable(this.volumeHandle);

    const updateVolumeFromPointer = (pointer) => {
      const trackLeft = this.volumeTrack.x - (this.volumeTrack.displayWidth / 2);
      const nextVolume = Phaser.Math.Clamp(
        (pointer.x - trackLeft) / Math.max(this.volumeTrack.displayWidth, 1),
        0,
        1
      );

      this.ensureBackgroundMusic();
      this.setMusicMuted(false);
      this.setMusicVolume(nextVolume);
    };

    this.volumeTrack.on('pointerdown', (pointer) => {
      updateVolumeFromPointer(pointer);
    });

    this.volumeHandle.on('dragstart', () => {
      this.volumeHandle.setScale(1.08);
    });

    this.volumeHandle.on('drag', (pointer) => {
      updateVolumeFromPointer(pointer);
    });

    this.volumeHandle.on('dragend', () => {
      this.volumeHandle.setScale(1);
    });

    this.refreshVolumeControls();
  }

  refreshMuteButtonLabel() {
    if (!this.muteButton) {
      return;
    }

    const isMuted = this.sound.mute;
    this.muteButton.setText(isMuted ? 'Muted' : 'Music On');
    this.muteButton.setBackgroundColor(isMuted ? 'rgba(90, 90, 90, 0.72)' : 'rgba(90, 90, 90, 0.55)');
  }

  refreshVolumeControls() {
    if (!this.volumeLabel || !this.volumeTrack || !this.volumeFill || !this.volumeHandle) {
      return;
    }

    const musicVolume = this.getMusicVolume();
    const trackLeft = this.volumeTrack.x - (this.volumeTrack.displayWidth / 2);
    const handleX = trackLeft + (this.volumeTrack.displayWidth * musicVolume);

    this.volumeLabel.setText(`Volume ${Math.round(musicVolume * 100)}%`);
    this.volumeFill.setPosition(trackLeft, this.volumeTrack.y);
    this.volumeFill.setDisplaySize(this.volumeTrack.displayWidth * musicVolume, this.volumeTrack.displayHeight);
    this.volumeHandle.setPosition(handleX, this.volumeTrack.y);
  }
}
