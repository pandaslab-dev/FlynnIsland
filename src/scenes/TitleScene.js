// ============================================
// TITLE SCENE
// ============================================
// This is the first scene players see
// Shows logo + Play Now button

class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });  // Scene identifier
    this.logo = null;
    this.playButton = null;
    this.muteButton = null;
    this.playButtonScales = {
      base: 0.3,
      hover: 0.35,
      pressed: 0.25
    };
    this.resizeHandler = null;
  }
  
  preload() {
    // Load title screen assets
    this.load.image('logo', 'misc_assets/logo.png');
    this.load.image('playnow', 'misc_assets/playnow.png');
    this.load.audio('background_music', 'misc_assets/music.mp3');
  }
  
  create() {
    // Add sky blue background
    this.cameras.main.setBackgroundColor('#87CEEB');

    this.initializeAudioState();
    this.ensureBackgroundMusic();
    
    // Add logo at top center
    this.logo = this.add.image(0, 0, 'logo');
    
    // Add "Play Now" button
    this.playButton = this.add.image(0, 0, 'playnow');
    
    // Make button interactive
    this.playButton.setInteractive({ useHandCursor: true });
    
    // Hover effect - scale up slightly
    this.playButton.on('pointerover', () => {
      this.tweens.add({
        targets: this.playButton,
        scaleX: this.playButtonScales.hover,
        scaleY: this.playButtonScales.hover,
        duration: 100,
        ease: 'Power2'
      });
    });
    
    // Hover out - scale back to normal
    this.playButton.on('pointerout', () => {
      this.tweens.add({
        targets: this.playButton,
        scaleX: this.playButtonScales.base,
        scaleY: this.playButtonScales.base,
        duration: 100,
        ease: 'Power2'
      });
    });
    
    // Click handler - transition to game
    this.playButton.on('pointerdown', () => {
      this.ensureBackgroundMusic();

      // Visual feedback - quick scale down
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

  layoutScene() {
    if (!this.logo || !this.playButton) {
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

    this.playButtonScales.base = buttonBaseScale;
    this.playButtonScales.hover = buttonBaseScale + 0.04;
    this.playButtonScales.pressed = Math.max(buttonBaseScale - 0.04, 0.2);

    let logoY = centerY - (
      flags.isPortrait
        ? (flags.isTablet ? 220 : isPhone ? 170 : 200)
        : (isPhone ? 86 : 130)
    );
    let buttonY = centerY + (
      flags.isPortrait
        ? (flags.isTablet ? 132 : isPhone ? 126 : 120)
        : (isPhone ? 88 : 120)
    );

    this.logo.setScale(logoScale);
    this.logo.setPosition(centerX, logoY);

    this.playButton.setScale(this.playButtonScales.base);
    this.playButton.setPosition(centerX, buttonY);

    const topEdge = this.logo.y - (this.logo.displayHeight / 2);
    const bottomEdge = this.playButton.y + (this.playButton.displayHeight / 2);
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
      this.logo.setPosition(centerX, logoY);
      this.playButton.setPosition(centerX, buttonY);
    }

    if (this.muteButton) {
      const muteMargin = isPhone ? 16 : 18;
      this.muteButton.setPosition(this.scale.width - muteMargin, muteMargin);
    }
  }

  handleSceneShutdown() {
    if (this.resizeHandler) {
      this.scale.off('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
  }

  ensureBackgroundMusic() {
    const existingMusic = this.sound.get('background_music');

    if (existingMusic && existingMusic.isPlaying) {
      return;
    }

    const playMusic = () => {
      const currentMusic = this.sound.get('background_music');
      if (currentMusic && currentMusic.isPlaying) {
        return;
      }

      if (currentMusic) {
        currentMusic.play({ loop: true, volume: 0.5 });
        return;
      }

      const music = this.sound.add('background_music', {
        loop: true,
        volume: 0.5
      });
      music.play();
    };

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
      window.flynnMusicMuted = true;
    }

    this.sound.mute = Boolean(window.flynnMusicMuted);
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
      this.sound.mute = !this.sound.mute;
      window.flynnMusicMuted = this.sound.mute;
      this.refreshMuteButtonLabel();
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

  refreshMuteButtonLabel() {
    const isMuted = this.sound.mute;
    this.muteButton.setText(isMuted ? 'Muted' : 'Music On');
    this.muteButton.setBackgroundColor(isMuted ? 'rgba(90, 90, 90, 0.72)' : 'rgba(90, 90, 90, 0.55)');
  }
}
