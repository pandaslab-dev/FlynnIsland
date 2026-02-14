// ============================================
// DOG SELECT SCENE
// ============================================
// Player chooses their dog (Alice, Remix, Sapphire, or Wendy)
// Displays all dogs in slots from selectdogdialog.png background

class DogSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: 'DogSelectScene' });
    this.playerName = '';
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

    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    const isPortraitViewport = this.scale.height > this.scale.width;
    
    // Add dialog background
    const dialog = this.add.image(centerX, centerY, 'selectdogdialog');
    dialog.setScale(isPortraitViewport ? 0.65 : 0.8);
    
    // Define dog data and their positions in the grid
    // Positions match the 4 slots in selectdogdialog.png
    const xOffset = isPortraitViewport ? 112 : 120;
    const topRowY = centerY + (isPortraitViewport ? -72 : -78);
    const bottomRowY = centerY + (isPortraitViewport ? 118 : 122);
    const dogs = [
      { 
        name: 'Alice',      // Display name (capitalized)
        key: 'alice',       // Asset key (lowercase)
        x: centerX - xOffset,
        y: topRowY
      },
      { 
        name: 'Remix', 
        key: 'remix',
        x: centerX + xOffset,
        y: topRowY
      },
      { 
        name: 'Sapphire', 
        key: 'sapphire',
        x: centerX - xOffset,
        y: bottomRowY
      },
      { 
        name: 'Wendy', 
        key: 'wendy',
        x: centerX + xOffset,
        y: bottomRowY
      }
    ];
    
    // Create clickable slot for each dog
    dogs.forEach(dog => {
      this.createDogSlot(dog);
    });
  }
  
  createDogSlot(dogData) {
    // Add dog sprite at specified position
    const dogSprite = this.add.sprite(dogData.x, dogData.y, `${dogData.key}_stand`);
    dogSprite.setScale(0.25);  // Scale to fit nicely in slot
    
    // Create invisible clickable area over the slot
    // This makes the entire slot clickable, not just the sprite pixels
    const clickZone = this.add.rectangle(
      dogData.x, 
      dogData.y, 
      200,         // Width of clickable area (larger than sprite)
      200,         // Height of clickable area
      0x000000,    // Color (black, but won't show because alpha = 0)
      0            // Alpha 0 = completely invisible
    );
    
    // Make the invisible rectangle interactive
    clickZone.setInteractive({ useHandCursor: true });
    
    // HOVER IN - scale up dog sprite for feedback
    clickZone.on('pointerover', () => {
      this.tweens.add({
        targets: dogSprite,
        scaleX: 0.28,
        scaleY: 0.28,
        duration: 100,
        ease: 'Power2'
      });
    });
    
    // HOVER OUT - scale back to normal
    clickZone.on('pointerout', () => {
      this.tweens.add({
        targets: dogSprite,
        scaleX: 0.25,
        scaleY: 0.25,
        duration: 100,
        ease: 'Power2'
      });
    });
    
    // CLICK - select this dog and start game
    clickZone.on('pointerdown', () => {
      // Visual feedback - quick scale down
      this.tweens.add({
        targets: dogSprite,
        scaleX: 0.23,
        scaleY: 0.23,
        duration: 50,
        yoyo: true,
        onComplete: () => {
          // Start GameScene and pass BOTH player name AND selected dog
          this.scene.start('GameScene', { 
            playerName: this.playerName,  // From NameInputScene
            dogType: dogData.name         // Selected dog (Alice, Remix, etc.)
          });
        }
      });
    });
  }
}
