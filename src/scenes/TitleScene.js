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

    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    const isPortraitViewport = this.scale.height > this.scale.width;
    
    // Add logo at top center
    const logo = this.add.image(centerX, centerY - (isPortraitViewport ? 200 : 130), 'logo');
    // Scale logo if needed (adjust to fit your logo size)
    logo.setScale(isPortraitViewport ? 0.4 : 0.5);
    
    // Add "Play Now" button
    const playButton = this.add.image(centerX, centerY + (isPortraitViewport ? 120 : 120), 'playnow');
    playButton.setScale(isPortraitViewport ? 0.26 : 0.3);
    
    // Make button interactive
    playButton.setInteractive({ useHandCursor: true });
    
    // Hover effect - scale up slightly
    playButton.on('pointerover', () => {
      this.tweens.add({
        targets: playButton,
        scaleX: isPortraitViewport ? 0.3 : 0.35,
        scaleY: isPortraitViewport ? 0.3 : 0.35,
        duration: 100,
        ease: 'Power2'
      });
    });
    
    // Hover out - scale back to normal
    playButton.on('pointerout', () => {
      this.tweens.add({
        targets: playButton,
        scaleX: isPortraitViewport ? 0.26 : 0.3,
        scaleY: isPortraitViewport ? 0.26 : 0.3,
        duration: 100,
        ease: 'Power2'
      });
    });
    
    // Click handler - transition to game
    playButton.on('pointerdown', () => {
      // Visual feedback - quick scale down
      this.tweens.add({
        targets: playButton,
        scaleX: isPortraitViewport ? 0.22 : 0.25,
        scaleY: isPortraitViewport ? 0.22 : 0.25,
        duration: 50,
        yoyo: true,
        onComplete: () => {
          this.scene.start('NameInputScene');
        }
      });
    });
    
  }
}
