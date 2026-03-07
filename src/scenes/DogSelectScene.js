// ============================================
// DOG SELECT SCENE
// ============================================
// Player chooses their dog (Alice, Remix, Sapphire, or Wendy)
// Uses direct image buttons for each dog choice

class DogSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: 'DogSelectScene' });
    this.playerName = '';
    this.titleImage = null;
    this.dogButtons = [];
    this.resizeHandler = null;
    this.selectionLocked = false;
  }
  
  // Receive data from previous scene (NameInputScene)
  init(data) {
    // init() runs before preload()
    // This is where we receive data passed from scene.start()
    if (data.playerName) {
      this.playerName = data.playerName;
    }
  }
  
  preload() {
    this.load.image('choosedog_top', 'misc_assets/choosedog-top.png');
    this.load.image('choosedog_alice', 'misc_assets/choosedog-alice.png');
    this.load.image('choosedog_remix', 'misc_assets/choosedog-remix.png');
    this.load.image('choosedog_sapphire', 'misc_assets/choosedog-sapphire.png');
    this.load.image('choosedog_wendy', 'misc_assets/choosedog-wendy.png');
  }
  
  create() {
    this.cameras.main.setBackgroundColor('#87CEEB');
    this.clearLingeringNameInput();

    this.titleImage = this.add.image(0, 0, 'choosedog_top');

    const dogs = [
      {
        name: 'Alice',
        buttonKey: 'choosedog_alice',
        column: -1,
        row: 0
      },
      {
        name: 'Remix',
        buttonKey: 'choosedog_remix',
        column: 1,
        row: 0
      },
      {
        name: 'Sapphire',
        buttonKey: 'choosedog_sapphire',
        column: -1,
        row: 1
      },
      {
        name: 'Wendy', 
        buttonKey: 'choosedog_wendy',
        column: 1,
        row: 1
      }
    ];
    
    this.dogButtons = dogs.map((dog) => this.createDogButton(dog));

    this.layoutScene();
    this.resizeHandler = () => this.layoutScene();
    this.scale.on('resize', this.resizeHandler);

    this.events.once('shutdown', this.handleSceneShutdown, this);
    this.events.once('destroy', this.handleSceneShutdown, this);
  }

  clearLingeringNameInput() {
    const activeElement = document.activeElement;
    if (activeElement && typeof activeElement.blur === 'function') {
      activeElement.blur();
    }

    document.querySelectorAll('#nameInput').forEach((element) => {
      element.style.pointerEvents = 'none';
      element.style.visibility = 'hidden';

      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
  }
  
  createDogButton(dogData) {
    const button = this.add.image(0, 0, dogData.buttonKey);

    const slot = {
      dogData,
      button,
      scales: {
        base: 1,
        hover: 1.05,
        pressed: 0.96
      }
    };

    button.setInteractive({ useHandCursor: true });

    button.on('pointerover', () => {
      if (this.selectionLocked) {
        return;
      }

      this.tweens.add({
        targets: button,
        scaleX: slot.scales.hover,
        scaleY: slot.scales.hover,
        duration: 100,
        ease: 'Power2'
      });
    });

    button.on('pointerout', () => {
      if (this.selectionLocked) {
        return;
      }

      this.tweens.add({
        targets: button,
        scaleX: slot.scales.base,
        scaleY: slot.scales.base,
        duration: 100,
        ease: 'Power2'
      });
    });

    button.on('pointerdown', () => {
      this.selectDog(slot);
    });

    return slot;
  }

  selectDog(slot) {
    if (!slot || this.selectionLocked) {
      return;
    }

    this.selectionLocked = true;
    this.dogButtons.forEach((dogButton) => {
      dogButton.button.disableInteractive();
    });

    this.tweens.add({
      targets: slot.button,
      scaleX: slot.scales.pressed,
      scaleY: slot.scales.pressed,
      duration: 50,
      yoyo: true,
      onComplete: () => {
        this.scene.start('LoadingScene', {
          playerName: this.playerName,
          dogType: slot.dogData.name
        });
      }
    });
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
    if (!this.titleImage || this.dogButtons.length === 0) {
      return;
    }

    const flags = this.getViewportFlags();
    const isPhone = flags.hasTouch && !flags.isTablet;
    const centerX = this.scale.width / 2;
    const marginX = isPhone ? 24 : 36;
    const marginY = isPhone ? 28 : 36;
    const availableWidth = this.scale.width - (marginX * 2);
    const availableHeight = this.scale.height - (marginY * 2);
    const columnGap = flags.isPortrait
      ? (isPhone ? 14 : 22)
      : (isPhone ? 18 : 26);
    const rowGap = flags.isPortrait
      ? (isPhone ? 16 : 24)
      : (isPhone ? 14 : 20);
    const titleGap = flags.isPortrait
      ? (isPhone ? 18 : 26)
      : (isPhone ? 12 : 18);

    let titleScale = flags.isPortrait
      ? (flags.isTablet ? 0.82 : isPhone ? 0.84 : 0.8)
      : (isPhone ? 0.56 : 0.72);
    titleScale = Math.min(titleScale, availableWidth / this.titleImage.width);

    const sampleButton = this.dogButtons[0].button;
    const buttonWidth = sampleButton.width;
    const buttonHeight = sampleButton.height;
    const buttonBaseScale = flags.isPortrait
      ? (flags.isTablet ? 0.94 : isPhone ? 0.96 : 0.9)
      : (isPhone ? 0.68 : 0.8);
    const maxScaleByWidth = (availableWidth - columnGap) / (buttonWidth * 2);
    const reservedHeight = (this.titleImage.height * titleScale) + titleGap + rowGap;
    const maxScaleByHeight = (availableHeight - reservedHeight) / (buttonHeight * 2);
    const buttonScale = Math.max(
      0.4,
      Math.min(buttonBaseScale, maxScaleByWidth, maxScaleByHeight)
    );
    const titleHeight = this.titleImage.height * titleScale;
    const buttonRowWidth = (buttonWidth * buttonScale * 2) + columnGap;
    const buttonRowHeight = buttonHeight * buttonScale;
    const contentHeight = titleHeight + titleGap + (buttonRowHeight * 2) + rowGap;
    const maxContentTop = Math.max(marginY, this.scale.height - marginY - contentHeight);
    const contentTop = Phaser.Math.Clamp(
      ((this.scale.height - contentHeight) / 2) + (flags.isPortrait && isPhone ? 28 : 0),
      marginY,
      maxContentTop
    );

    this.titleImage.setScale(titleScale);
    this.titleImage.setPosition(centerX, contentTop + (titleHeight / 2));

    const leftX = centerX - (buttonRowWidth / 2) + ((buttonWidth * buttonScale) / 2);
    const rightX = centerX + (buttonRowWidth / 2) - ((buttonWidth * buttonScale) / 2);
    const topRowY = contentTop + titleHeight + titleGap + (buttonRowHeight / 2);
    const bottomRowY = topRowY + buttonRowHeight + rowGap;

    this.dogButtons.forEach((slot) => {
      const x = slot.dogData.column < 0 ? leftX : rightX;
      const y = slot.dogData.row === 0 ? topRowY : bottomRowY;

      slot.scales.base = buttonScale;
      slot.scales.hover = buttonScale + 0.04;
      slot.scales.pressed = Math.max(buttonScale - 0.04, 0.4);

      slot.button.setPosition(x, y);
      slot.button.setScale(slot.scales.base);
    });
  }

  handleSceneShutdown() {
    if (this.resizeHandler) {
      this.scale.off('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
  }
}
