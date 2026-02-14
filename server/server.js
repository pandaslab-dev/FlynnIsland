const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { Server } = require('socket.io');

const PORT = Number(process.env.PORT) || 3000;
const TICK_RATE_MS = 50;

const SPAWN_X = 1024;
const SPAWN_Y = 1024;

const ALLOWED_DOG_TYPES = new Set(['Alice', 'Remix', 'Sapphire', 'Wendy']);

const players = {};

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.resolve(__dirname, '..')));

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    playerCount: Object.keys(players).length
  });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

function sanitizeName(name) {
  if (typeof name !== 'string') {
    return 'Player';
  }

  const trimmed = name.trim().slice(0, 15);
  return trimmed.length > 0 ? trimmed : 'Player';
}

function sanitizeDogType(dogType) {
  if (typeof dogType !== 'string') {
    return 'Remix';
  }

  const normalized = dogType.trim();
  if (ALLOWED_DOG_TYPES.has(normalized)) {
    return normalized;
  }

  return 'Remix';
}

io.on('connection', (socket) => {
  socket.on('player:join', (payload = {}) => {
    players[socket.id] = {
      id: socket.id,
      name: sanitizeName(payload.name),
      dogType: sanitizeDogType(payload.dogType),
      x: SPAWN_X,
      y: SPAWN_Y,
      animation: 'stand',
      flipX: false
    };
  });

  socket.on('player:input', (payload = {}) => {
    const player = players[socket.id];
    if (!player) {
      return;
    }

    if (Number.isFinite(payload.x)) {
      player.x = payload.x;
    }
    if (Number.isFinite(payload.y)) {
      player.y = payload.y;
    }
    if (typeof payload.animation === 'string') {
      player.animation = payload.animation;
    }
    if (typeof payload.flipX === 'boolean') {
      player.flipX = payload.flipX;
    }
  });

  socket.on('player:emote', (emote) => {
    const player = players[socket.id];
    if (!player) {
      return;
    }

    if (typeof emote === 'string' && emote.length > 0 && emote.length <= 8) {
      player.emote = emote;
    }
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
  });
});

setInterval(() => {
  const snapshot = Object.values(players).map((player) => ({ ...player }));
  io.emit('world:state', { players: snapshot });

  snapshot.forEach((player) => {
    if (players[player.id] && players[player.id].emote) {
      delete players[player.id].emote;
    }
  });
}, TICK_RATE_MS);

server.listen(PORT, () => {
  console.log(`Flynn Island multiplayer server running on port ${PORT}`);
});
