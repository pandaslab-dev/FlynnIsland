// ============================================
// NAME INPUT SCENE
// ============================================
// Player enters their name before selecting a dog

class NameInputScene extends Phaser.Scene {
  constructor() {
    super({ key: 'NameInputScene' });
    this.playerName = '';
  }
  
  preload() {
    // Load the enter name dialog background
    this.load.image('enternamedialog', 'misc_assets/enternamedialog.png');
  }
  
  create() {
    // Set background
    this.cameras.main.setBackgroundColor('#87CEEB');
    
    // Add dialog background
    const dialog = this.add.image(512, 384, 'enternamedialog');
    dialog.setScale(0.6);
    
    // Create HTML input field
    // We'll position it in the center of the canvas
    this.createHTMLInput();
    
    // Add "Continue" button (starts disabled)
    this.continueButton = this.add.text(
      512, 500,
      'Continue',
      {
        fontSize: '32px',
        fontFamily: 'Arial, sans-serif',
        color: '#cccccc',  // Gray when disabled
        stroke: '#000000',
        strokeThickness: 4,
        backgroundColor: '#666666',
        padding: { x: 20, y: 10 }
      }
    );
    this.continueButton.setOrigin(0.5);
    this.continueButton.setInteractive({ useHandCursor: false });
    this.continueButton.disableInteractive();  // Start disabled
    
    // Button click handler
    this.continueButton.on('pointerdown', () => {
      if (this.playerName.trim().length > 0) {
        // Remove HTML input before transitioning
        this.removeHTMLInput();
        
        // Visual feedback
        this.tweens.add({
          targets: this.continueButton,
          scaleX: 0.95,
          scaleY: 0.95,
          duration: 50,
          yoyo: true,
          onComplete: () => {
            // Pass player name to DogSelectScene
            // (For now, we'll go straight to GameScene)
            this.scene.start('GameScene', { playerName: this.playerName });
          }
        });
      }
    });
  }
  
    createHTMLInput() {
    // Create an HTML input element
    const inputElement = document.createElement('input');
    inputElement.type = 'text';
    inputElement.id = 'nameInput';
    inputElement.placeholder = 'Your name...';
    inputElement.maxLength = 15;  // Limit name length
    
    // Style the input with transparency
    inputElement.style.position = 'absolute';
    inputElement.style.fontSize = '28px';
    inputElement.style.padding = '32px';
    inputElement.style.width = '300px';
    inputElement.style.border = 'none'; 
    inputElement.style.textAlign = 'center';
    inputElement.style.fontFamily = 'Arial, sans-serif';
    inputElement.style.backgroundColor = 'transparent';      // Transparent background
    inputElement.style.color = '#000000';                    // White text
    inputElement.style.outline = 'none';                     // Remove focus outline
    
    // Calculate position (center of canvas, aligned with dialog)
    const canvas = this.game.canvas;
    const canvasRect = canvas.getBoundingClientRect();
    
    // Position at center of dialog (y: 384 in Phaser coords)
    inputElement.style.left = `${canvasRect.left + (canvasRect.width / 2) - 175}px`;
    inputElement.style.top = `${canvasRect.top + 370}px`;  // Centered on dialog
    
    // Add to page
    document.body.appendChild(inputElement);
    
    // Focus the input automatically
    inputElement.focus();
    
    // Listen for input changes
    inputElement.addEventListener('input', (event) => {
        this.playerName = event.target.value;
        this.updateContinueButton();
    });
    
    // Allow Enter key to submit
    inputElement.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && this.playerName.trim().length > 0) {
        this.continueButton.emit('pointerdown');
        }
    });
    
    // Store reference for cleanup
    this.htmlInput = inputElement;
    }
  
  removeHTMLInput() {
    if (this.htmlInput && this.htmlInput.parentNode) {
      this.htmlInput.parentNode.removeChild(this.htmlInput);
      this.htmlInput = null;
    }
  }
  
  updateContinueButton() {
    // Enable button if name is valid
    if (this.playerName.trim().length > 0) {
      this.continueButton.setStyle({ color: '#ffffff', backgroundColor: '#4CAF50' });
      this.continueButton.setInteractive({ useHandCursor: true });
      
      // Hover effects when enabled
      this.continueButton.removeAllListeners('pointerover');
      this.continueButton.removeAllListeners('pointerout');
      
      this.continueButton.on('pointerover', () => {
        this.continueButton.setStyle({ backgroundColor: '#45a049' });
      });
      
      this.continueButton.on('pointerout', () => {
        this.continueButton.setStyle({ backgroundColor: '#4CAF50' });
      });
    } else {
      // Disable button if name is empty
      this.continueButton.setStyle({ color: '#cccccc', backgroundColor: '#666666' });
      this.continueButton.disableInteractive();
      this.continueButton.removeAllListeners('pointerover');
      this.continueButton.removeAllListeners('pointerout');
    }
  }
  
  // Clean up HTML input if scene is shutdown
  shutdown() {
    this.removeHTMLInput();
  }
}