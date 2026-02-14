// ============================================
// NETWORK BRIDGE (Multiplayer seam)
// ============================================
// This is intentionally tiny: GameScene talks to this class,
// and later we can swap internals to full Socket.io networking.

class FlynnNetworkBridge {
  constructor() {
    this.socket = null;
    this.localPlayerId = null;

    this.connectedHandler = null;
    this.worldStateHandler = null;
  }

  connect(joinPayload) {
    this.localPlayerId = joinPayload?.id || `local-${Date.now()}`;

    if (typeof window.io !== 'function') {
      return this.localPlayerId;
    }

    const isLocalHost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';

    const socketServerUrl = isLocalHost
      ? 'http://localhost:3000'
      : 'https://api.flynnisland.pandaslab.dev';

    this.socket = window.io(socketServerUrl);

    this.socket.on('connect', () => {
      this.localPlayerId = this.socket.id;

      if (typeof this.connectedHandler === 'function') {
        this.connectedHandler(this.localPlayerId);
      }

      this.socket.emit('player:join', {
        name: joinPayload?.name || 'Player',
        dogType: joinPayload?.dogType || 'Remix'
      });
    });

    this.socket.on('world:state', (worldState) => {
      if (typeof this.worldStateHandler === 'function') {
        this.worldStateHandler(worldState);
      }
    });

    return this.localPlayerId;
  }

  onConnected(handler) {
    this.connectedHandler = handler;
  }

  onWorldState(handler) {
    this.worldStateHandler = handler;
  }

  sendInput(inputPayload) {
    if (!this.socket) {
      return;
    }

    this.socket.emit('player:input', inputPayload);
  }

  sendEmote(emoji) {
    if (!this.socket) {
      return;
    }

    this.socket.emit('player:emote', emoji);
  }

  disconnect() {
    if (!this.socket) {
      return;
    }

    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.socket = null;
  }
}
