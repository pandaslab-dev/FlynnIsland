// ============================================
// NAME INPUT SCENE
// ============================================
// Player enters their name before selecting a dog
// Uses HTML input field overlaid on Phaser canvas

class NameInputScene extends Phaser.Scene {
  constructor() {
    super({ key: 'NameInputScene' });
    this.playerName = '';  // Stores the entered name
  }
  
  preload() {
    // Load dialog background image
    this.load.image('enternamedialog', 'misc_assets/enternamedialog.png');
  }
  
  create() {
    // Set sky blue background
    this.cameras.main.setBackgroundColor('#87CEEB');
    
    // Add dialog background at center of screen
    const dialog = this.add.image(512, 384, 'enternamedialog');
    dialog.setScale(0.6);
    
    // Create the HTML text input field
    this.createHTMLInput();
    
    // Create "Continue" button (starts disabled/gray)
    this.continueButton = this.add.text(
      512, 500,              // Position
      'Continue',            // Text content
      {
        fontSize: '32px',
        fontFamily: 'Arial, sans-serif',
        color: '#cccccc',    // Gray when disabled
        stroke: '#000000',   // Black outline
        strokeThickness: 4,
        backgroundColor: '#666666',  // Dark gray background
        padding: { x: 20, y: 10 }
      }
    );
    this.continueButton.setOrigin(0.5);  // Center the text on its position
    this.continueButton.setInteractive({ useHandCursor: false });
    this.continueButton.disableInteractive();  // Can't click until name is entered
    
    // CLICK handler for Continue button
    this.continueButton.on('pointerdown', () => {
      // Only proceed if name is valid
      if (this.playerName.trim().length > 0) {
        // Remove HTML input before transitioning
        this.removeHTMLInput();
        
        // Visual feedback - quick scale animation
        this.tweens.add({
          targets: this.continueButton,
          scaleX: 0.95,
          scaleY: 0.95,
          duration: 50,
          yoyo: true,
          onComplete: () => {
            // Pass player name to DogSelectScene
            // Second parameter is data object that next scene receives in init()
            this.scene.start('DogSelectScene', { playerName: this.playerName });
          }
        });
      }
    });
  }
  
  createHTMLInput() {
    // Phaser doesn't have native text input, so we create an HTML input element
    // and position it over the canvas
    
    const inputElement = document.createElement('input');
    inputElement.type = 'text';
    inputElement.id = 'nameInput';
    inputElement.placeholder = 'Your name...';
    inputElement.maxLength = 15;  // Limit name to 15 characters
    
    // Style the input to look integrated with the dialog
    inputElement.style.position = 'absolute';
    inputElement.style.fontSize = '28px';
    inputElement.style.padding = '32px';
    inputElement.style.width = '300px';
    inputElement.style.border = 'none';
    inputElement.style.textAlign = 'center';
    inputElement.style.fontFamily = 'Arial, sans-serif';
    inputElement.style.backgroundColor = 'transparent';  // See-through background
    inputElement.style.color = '#000000';                // Black text
    inputElement.style.outline = 'none';                 // Remove blue focus ring
    
    // Calculate position to center on canvas
    const canvas = this.game.canvas;
    const canvasRect = canvas.getBoundingClientRect();
    inputElement.style.left = `${canvasRect.left + (canvasRect.width / 2) - 175}px`;
    inputElement.style.top = `${canvasRect.top + 370}px`;
    
    // Add input to the page
    document.body.appendChild(inputElement);
    
    // Auto-focus so player can start typing immediately
    inputElement.focus();
    
    // Listen for text input
    inputElement.addEventListener('input', (event) => {
      this.playerName = event.target.value;
      this.updateContinueButton();  // Enable/disable button based on input
    });
    
    // Allow Enter key to submit
    inputElement.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && this.playerName.trim().length > 0) {
        this.continueButton.emit('pointerdown');  // Trigger click handler
      }
    });
    
    // Store reference for cleanup
    this.htmlInput = inputElement;
  }
  
  removeHTMLInput() {
    // Clean up HTML element when leaving scene
    if (this.htmlInput && this.htmlInput.parentNode) {
      this.htmlInput.parentNode.removeChild(this.htmlInput);
      this.htmlInput = null;
    }
  }
  
  updateContinueButton() {
    // Enable or disable Continue button based on input validation
    
    if (this.playerName.trim().length > 0) {
      // Valid name - enable button
      this.continueButton.setStyle({ 
        color: '#ffffff',           // White text
        backgroundColor: '#4CAF50'  // Green background
      });
      this.continueButton.setInteractive({ useHandCursor: true });
      
      // Add hover effects
      this.continueButton.removeAllListeners('pointerover');
      this.continueButton.removeAllListeners('pointerout');
      
      this.continueButton.on('pointerover', () => {
        this.continueButton.setStyle({ backgroundColor: '#45a049' });  // Darker green
      });
      
      this.continueButton.on('pointerout', () => {
        this.continueButton.setStyle({ backgroundColor: '#4CAF50' });  // Back to normal
      });
    } else {
      // Empty name - disable button
      this.continueButton.setStyle({ 
        color: '#cccccc',           // Gray text
        backgroundColor: '#666666'  // Dark gray background
      });
      this.continueButton.disableInteractive();
      this.continueButton.removeAllListeners('pointerover');
      this.continueButton.removeAllListeners('pointerout');
    }
  }
  
  // Lifecycle method - called when scene is shut down
  shutdown() {
    this.removeHTMLInput();  // Always clean up HTML elements
  }
}