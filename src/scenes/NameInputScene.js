// ============================================
// NAME INPUT SCENE
// ============================================
// Player enters their name before selecting a dog
// Uses HTML input field overlaid on Phaser canvas

class NameInputScene extends Phaser.Scene {
  constructor() {
    super({ key: 'NameInputScene' });
    this.backgroundImage = null;
    this.playerName = '';  // Stores the entered name
    this.isMobileInputFocused = false;
    this.dialog = null;
    this.continueButton = null;
    this.transitioningToDogSelect = false;
  }
  
  preload() {
    if (window.FlynnMenuBackground && typeof window.FlynnMenuBackground.preload === 'function') {
      window.FlynnMenuBackground.preload(this);
    }

    // Load dialog background image
    this.load.image('enternamedialog', 'misc_assets/enternamedialog.png');
  }
  
  create() {
    this.cameras.main.setBackgroundColor('#0f172a');
    if (window.FlynnMenuBackground && typeof window.FlynnMenuBackground.create === 'function') {
      this.backgroundImage = window.FlynnMenuBackground.create(this);
    }
    
    // Add dialog background at center of screen
    this.dialog = this.add.image(0, 0, 'enternamedialog');
    this.inputWorldX = 0;
    this.inputWorldY = 0;
    
    // Create "Continue" button (starts disabled/gray)
    this.continueButton = this.add.text(
      0, 0,                  // Position (updated in layoutScene)
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
    
    this.continueButton.on('pointerdown', () => {
      this.beginDogSelectTransition();
    });

    this.layoutScene();
    this.createHTMLInput();
    this.positionHTMLInput();
    
    this.events.once('shutdown', this.handleSceneShutdown, this);
    this.events.once('destroy', this.handleSceneShutdown, this);
  }
  
  createHTMLInput() {
    // Phaser doesn't have native text input, so we create an HTML input element
    // and position it over the canvas
    this.removeLingeringNameInputs();
    
    const inputElement = document.createElement('input');
    inputElement.type = 'text';
    inputElement.id = 'nameInput';
    inputElement.placeholder = 'Your name...';
    inputElement.maxLength = 15;  // Limit name to 15 characters
    
    // Style the input to look integrated with the dialog
    inputElement.style.position = 'fixed';
    inputElement.style.fontSize = '28px';
    inputElement.style.padding = '32px';
    inputElement.style.width = '300px';
    inputElement.style.boxSizing = 'border-box';
    inputElement.style.border = 'none';
    inputElement.style.textAlign = 'center';
    inputElement.style.fontFamily = 'Arial, sans-serif';
    inputElement.style.backgroundColor = 'transparent';  // See-through background
    inputElement.style.color = '#000000';                // Black text
    inputElement.style.outline = 'none';                 // Remove blue focus ring
    inputElement.style.zIndex = '20';
    
    // Add input to the page
    document.body.appendChild(inputElement);
    
    // Listen for text input
    inputElement.addEventListener('input', (event) => {
      this.playerName = event.target.value;
      this.updateContinueButton();  // Enable/disable button based on input
    });
    
    // Allow Enter key to submit
    inputElement.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && this.playerName.trim().length > 0) {
        this.beginDogSelectTransition();
      }
    });

    inputElement.addEventListener('focus', () => {
      this.isMobileInputFocused = this.isMobileViewport();
      this.positionHTMLInput();
    });

    inputElement.addEventListener('blur', () => {
      this.isMobileInputFocused = false;
      this.positionHTMLInput();
    });
    
    // Store reference for cleanup
    this.htmlInput = inputElement;
    
    this.repositionInputHandler = () => {
      this.layoutScene();
      this.positionHTMLInput();
    };
    
    window.addEventListener('resize', this.repositionInputHandler);
    window.addEventListener('orientationchange', this.repositionInputHandler);
    this.scale.on('resize', this.repositionInputHandler);
    
    this.positionHTMLInput();

    // Auto-focus after initial placement
    inputElement.focus();
  }
  
  positionHTMLInput() {
    if (!this.htmlInput) {
      return;
    }

    if (this.isMobileInputFocused && this.isMobileViewport()) {
      return;
    }
    
    const canvasRect = this.game.canvas.getBoundingClientRect();
    const gameWidth = this.scale.gameSize.width;
    const gameHeight = this.scale.gameSize.height;
    const scaleX = canvasRect.width / gameWidth;
    const scaleY = canvasRect.height / gameHeight;
    const flags = this.getViewportFlags();
    const isPhone = flags.hasTouch && !flags.isTablet;
    
    const responsiveWidth = Phaser.Math.Clamp(300 * scaleX, 180, 320);
    const responsiveFont = Phaser.Math.Clamp(28 * scaleY, 16, 28);
    const responsivePadding = Phaser.Math.Clamp(32 * scaleY, 12, 32);
    
    this.htmlInput.style.width = `${responsiveWidth}px`;
    this.htmlInput.style.fontSize = `${responsiveFont}px`;
    this.htmlInput.style.padding = `${responsivePadding}px`;
    this.htmlInput.style.left = `${canvasRect.left + ((this.inputWorldX * scaleX) - (responsiveWidth / 2))}px`;
    this.htmlInput.style.top = `${canvasRect.top + (this.inputWorldY * scaleY) - (isPhone ? 25 : 0)}px`;
  }

  isMobileViewport() {
    const flags = this.getViewportFlags();
    return flags.hasTouch && (flags.isPortrait || flags.isTablet);
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
    if (!this.dialog || !this.continueButton) {
      return;
    }

    if (this.backgroundImage && window.FlynnMenuBackground && typeof window.FlynnMenuBackground.layout === 'function') {
      window.FlynnMenuBackground.layout(this, this.backgroundImage);
    }

    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    const flags = this.getViewportFlags();
    const isPhone = flags.hasTouch && !flags.isTablet;
    const uiScale = window.FlynnViewportScaler
      ? window.FlynnViewportScaler.getUiScale(this.scale.width, this.scale.height)
      : 1;

    const margin = isPhone ? 34 : 26;

    let dialogScale = flags.isPortrait
      ? (flags.isTablet ? 0.56 : isPhone ? 0.47 : 0.52)
      : isPhone
        ? 0.5
        : Phaser.Math.Clamp(0.6 + ((uiScale - 1) * 0.1), 0.56, 0.68);
    const maxDialogScaleByWidth = (this.scale.width - (margin * 2)) / this.dialog.width;
    const maxDialogScaleByHeight = (this.scale.height - (margin * 2)) / this.dialog.height;
    dialogScale = Math.min(dialogScale, maxDialogScaleByWidth, maxDialogScaleByHeight);

    const buttonYOffset = flags.isPortrait
      ? (dialogScale * (isPhone ? 208 : 223))
      : (dialogScale * (isPhone ? 195 : 206));
    const buttonY = centerY + buttonYOffset;
    const fontSize = Math.round(Phaser.Math.Clamp(32 * uiScale, 24, 36));
    const paddingX = Math.round(Phaser.Math.Clamp(20 * uiScale, 14, 26));
    const paddingY = Math.round(Phaser.Math.Clamp(10 * uiScale, 8, 14));

    this.dialog.setPosition(centerX, centerY);
    this.dialog.setScale(dialogScale);

    this.continueButton.setPosition(centerX, buttonY);
    this.continueButton.setFontSize(fontSize);
    this.continueButton.setPadding(paddingX, paddingY, paddingX, paddingY);

    this.inputWorldX = centerX;
    this.inputWorldY = centerY - (dialogScale * (flags.isTablet ? 14 : (isPhone ? 22 : 27)));
  }
  
  removeHTMLInput() {
    if (this.repositionInputHandler) {
      window.removeEventListener('resize', this.repositionInputHandler);
      window.removeEventListener('orientationchange', this.repositionInputHandler);
      this.scale.off('resize', this.repositionInputHandler);
      this.repositionInputHandler = null;
    }
    
    // Clean up HTML element when leaving scene
    if (this.htmlInput && this.htmlInput.parentNode) {
      if (document.activeElement === this.htmlInput) {
        this.htmlInput.blur();
      }

      this.htmlInput.style.pointerEvents = 'none';
      this.htmlInput.style.visibility = 'hidden';
      this.htmlInput.disabled = true;
      this.htmlInput.parentNode.removeChild(this.htmlInput);
      this.htmlInput = null;
    }

    this.removeLingeringNameInputs();
  }

  removeLingeringNameInputs() {
    document.querySelectorAll('#nameInput').forEach((element) => {
      if (document.activeElement === element && typeof element.blur === 'function') {
        element.blur();
      }

      element.style.pointerEvents = 'none';
      element.style.visibility = 'hidden';

      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
  }

  beginDogSelectTransition() {
    if (this.transitioningToDogSelect || this.playerName.trim().length === 0) {
      return;
    }

    this.transitioningToDogSelect = true;
    this.continueButton.disableInteractive();
    this.removeHTMLInput();

    this.tweens.add({
      targets: this.continueButton,
      scaleX: 0.95,
      scaleY: 0.95,
      duration: 50,
      yoyo: true,
      onComplete: () => {
        this.scene.start('DogSelectScene', { playerName: this.playerName });
      }
    });
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
  
  handleSceneShutdown() {
    this.removeHTMLInput();
  }
}
