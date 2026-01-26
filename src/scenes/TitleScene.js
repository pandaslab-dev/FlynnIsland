// ============================================
// TITLE SCENE
// ============================================
// This is the first scene players see
// Shows logo + Play Now button

class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });  // Scene identifier
  }
  
  preload() {
    // Load title screen assets
    this.load.image('logo', 'misc_assets/logo.png');
    this.load.image('playnow', 'misc_assets/playnow.png');
  }
  
  create() {
    // Add sky blue background
    this.cameras.main.setBackgroundColor('#87CEEB');
    
    // Add logo at top center
    const logo = this.add.image(512, 250, 'logo');
    // Scale logo if needed (adjust to fit your logo size)
    logo.setScale(0.5);
    
    // Add "Play Now" button
    const playButton = this.add.image(512, 500, 'playnow');
    playButton.setScale(0.3);
    
    // Make button interactive
    playButton.setInteractive({ useHandCursor: true });
    
    // Hover effect - scale up slightly
    playButton.on('pointerover', () => {
      this.tweens.add({
        targets: playButton,
        scaleX: 0.35,
        scaleY: 0.35,
        duration: 100,
        ease: 'Power2'
      });
    });
    
    // Hover out - scale back to normal
    playButton.on('pointerout', () => {
      this.tweens.add({
        targets: playButton,
        scaleX: 0.3,
        scaleY: 0.3,
        duration: 100,
        ease: 'Power2'
      });
    });
    
    // Click handler - transition to game
    playButton.on('pointerdown', () => {
      // Visual feedback - quick scale down
      this.tweens.add({
        targets: playButton,
        scaleX: 0.25,
        scaleY: 0.25,
        duration: 50,
        yoyo: true,
        onComplete: () => {
          // Start the GameScene
          this.scene.start('GameScene');
        }
      });
    });
    
  }
}