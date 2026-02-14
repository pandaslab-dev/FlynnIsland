// ============================================
// DOG SELECT SCENE
// ============================================
// Player chooses their dog (Alice, Remix, Sapphire, or Wendy)
// Displays all dogs in slots from selectdogdialog.png background

class DogSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: 'DogSelectScene' });
    this.playerName = '';
    this.dialog = null;
    this.dogSlots = [];
    this.resizeHandler = null;
    this.scenePointerHandler = null;
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
    // Load dialog background with dog name slots
    this.load.image('selectdogdialog', 'misc_assets/selectdogdialog.png');
    
    // Load standing sprite for each dog (for preview in slots)
    this.load.image('alice_stand', 'sprites/dogs/alice/alice_stand.png');
    this.load.image('remix_stand', 'sprites/dogs/remix/remix_stand.png');
    this.load.image('sapphire_stand', 'sprites/dogs/sapphire/sapphire_stand.png');
    this.load.image('wendy_stand', 'sprites/dogs/wendy/wendy_stand.png');
  }
  
  create() {
    // Set background
    this.cameras.main.setBackgroundColor('#87CEEB');

    // Add dialog background
    this.dialog = this.add.image(0, 0, 'selectdogdialog');
    
    // Define dog data and their positions in the grid
    // Positions match the 4 slots in selectdogdialog.png
    const dogs = [
      { 
        name: 'Alice',      // Display name (capitalized)
        key: 'alice',       // Asset key (lowercase)
        column: -1,
        row: 0
      },
      { 
        name: 'Remix', 
        key: 'remix',
        column: 1,
        row: 0
      },
      { 
        name: 'Sapphire', 
        key: 'sapphire',
        column: -1,
        row: 1
      },
      { 
        name: 'Wendy', 
        key: 'wendy',
        column: 1,
        row: 1
      }
    ];
    
    // Create clickable slot for each dog
    this.dogSlots = dogs.map((dog) => this.createDogSlot(dog));

    this.layoutScene();
    this.resizeHandler = () => this.layoutScene();
    this.scale.on('resize', this.resizeHandler);
    this.scenePointerHandler = (pointer, currentlyOver) => {
      if (this.selectionLocked) {
        return;
      }

      if (Array.isArray(currentlyOver) && currentlyOver.length > 0) {
        return;
      }

      this.trySelectSlotAt(pointer.x, pointer.y);
    };
    this.input.on('pointerdown', this.scenePointerHandler);

    this.events.once('shutdown', this.handleSceneShutdown, this);
    this.events.once('destroy', this.handleSceneShutdown, this);
  }
  
  createDogSlot(dogData) {
    // Add dog sprite at specified position
    const dogSprite = this.add.sprite(0, 0, `${dogData.key}_stand`);
    dogSprite.setScale(0.25);  // Scale to fit nicely in slot
    
    // Create invisible clickable area over the slot
    // This makes the entire slot clickable, not just the sprite pixels
    const clickZone = this.add.rectangle(
      0,
      0,
      200,         // Width of clickable area (larger than sprite)
      200,         // Height of clickable area
      0x000000,    // Color (black, but won't show because alpha = 0)
      0            // Alpha 0 = completely invisible
    );

    const slot = {
      dogData,
      sprite: dogSprite,
      clickZone,
      hitRadius: 100,
      scales: {
        base: 0.25,
        hover: 0.28,
        pressed: 0.23
      }
    };
    
    // Make the invisible rectangle interactive
    clickZone.setInteractive({ useHandCursor: true });
    dogSprite.setInteractive({ useHandCursor: true });
    
    // HOVER IN - scale up dog sprite for feedback
    clickZone.on('pointerover', () => {
      this.tweens.add({
        targets: slot.sprite,
        scaleX: slot.scales.hover,
        scaleY: slot.scales.hover,
        duration: 100,
        ease: 'Power2'
      });
    });
    
    // HOVER OUT - scale back to normal
    clickZone.on('pointerout', () => {
      this.tweens.add({
        targets: slot.sprite,
        scaleX: slot.scales.base,
        scaleY: slot.scales.base,
        duration: 100,
        ease: 'Power2'
      });
    });
    
    // CLICK - select this dog and start game
    clickZone.on('pointerdown', () => {
      this.selectDog(slot);
    });

    dogSprite.on('pointerdown', () => {
      this.selectDog(slot);
    });

    return slot;
  }

  trySelectSlotAt(pointerX, pointerY) {
    let bestSlot = null;
    let bestDistanceSq = Number.POSITIVE_INFINITY;

    this.dogSlots.forEach((slot) => {
      const dx = pointerX - slot.sprite.x;
      const dy = pointerY - slot.sprite.y;
      const distanceSq = (dx * dx) + (dy * dy);
      const hitRadius = slot.hitRadius || 100;

      if (distanceSq > (hitRadius * hitRadius)) {
        return;
      }

      if (distanceSq < bestDistanceSq) {
        bestDistanceSq = distanceSq;
        bestSlot = slot;
      }
    });

    if (bestSlot) {
      this.selectDog(bestSlot);
    }
  }

  selectDog(slot) {
    if (!slot || this.selectionLocked) {
      return;
    }

    this.selectionLocked = true;

    // Visual feedback - quick scale down
    this.tweens.add({
      targets: slot.sprite,
      scaleX: slot.scales.pressed,
      scaleY: slot.scales.pressed,
      duration: 50,
      yoyo: true,
      onComplete: () => {
        // Start GameScene and pass BOTH player name AND selected dog
        this.scene.start('GameScene', {
          playerName: this.playerName,   // From NameInputScene
          dogType: slot.dogData.name     // Selected dog (Alice, Remix, etc.)
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
    if (!this.dialog) {
      return;
    }

    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    const flags = this.getViewportFlags();
    const isPhone = flags.hasTouch && !flags.isTablet;
    const uiScale = window.FlynnViewportScaler
      ? window.FlynnViewportScaler.getUiScale(this.scale.width, this.scale.height)
      : 1;
    const isPortraitViewport = flags.isPortrait;
    const margin = isPhone ? 34 : 26;

    const baseDialogScale = 0.8;

    let dialogScale = isPortraitViewport
      ? (flags.isTablet ? 0.72 : isPhone ? 0.58 : 0.65)
      : isPhone
        ? 0.62
        : Phaser.Math.Clamp(0.78 + ((uiScale - 1) * 0.15), 0.72, 0.86);
    const maxDialogScaleByWidth = (this.scale.width - (margin * 2)) / this.dialog.width;
    const maxDialogScaleByHeight = (this.scale.height - (margin * 2)) / this.dialog.height;
    dialogScale = Math.min(dialogScale, maxDialogScaleByWidth, maxDialogScaleByHeight);

    const dialogRatio = dialogScale / baseDialogScale;
    const xOffset = 120 * dialogRatio;
    const topRowY = centerY - (78 * dialogRatio);
    const bottomRowY = centerY + (122 * dialogRatio);
    const slotBaseScale = Phaser.Math.Clamp(0.25 * dialogRatio, 0.16, 0.3);
    const clickZoneSize = Math.round(
      Phaser.Math.Clamp(200 * dialogRatio, 130, 240)
    );

    this.dialog.setPosition(centerX, centerY);
    this.dialog.setScale(dialogScale);

    this.dogSlots.forEach((slot) => {
      const isTopRow = slot.dogData.row === 0;
      const x = centerX + (slot.dogData.column * xOffset);
      const y = isTopRow ? topRowY : bottomRowY;

      slot.scales.base = slotBaseScale;
      slot.scales.hover = slotBaseScale + 0.03;
      slot.scales.pressed = Math.max(slotBaseScale - 0.02, 0.2);

      slot.sprite.setPosition(x, y);
      slot.sprite.setScale(slot.scales.base);

      slot.clickZone.setPosition(x, y);
      slot.clickZone.setSize(clickZoneSize, clickZoneSize);
      slot.hitRadius = clickZoneSize * 0.5;
    });
  }

  handleSceneShutdown() {
    if (this.resizeHandler) {
      this.scale.off('resize', this.resizeHandler);
      this.resizeHandler = null;
    }

    if (this.scenePointerHandler) {
      this.input.off('pointerdown', this.scenePointerHandler);
      this.scenePointerHandler = null;
    }
  }
}
