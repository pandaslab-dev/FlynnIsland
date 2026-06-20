# Running Flynn Island Locally

## Overview

Flynn Island is a browser game served by a small Node/Express server. That same server also runs the Socket.IO multiplayer backend, so local development only needs one process.

The public deployment is available at `https://flynnisland.pandaslab.dev`. Because it is hosted on a free Render instance, the site can take around 15 seconds to wake up after being idle.

## Prerequisites

- Node.js 18+ is recommended
- npm

## Start the project

From the repo root:

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in a browser.

## How the local setup works

- `server/server.js` serves `index.html`, the asset folders, and the `src/` browser scripts.
- The same process opens a Socket.IO server on port `3000`.
- When the game is loaded on `localhost`, the client connects to `http://localhost:3000`.
- When the game is deployed behind a normal host, the client defaults to the current origin for multiplayer instead of relying on a hardcoded production URL.

## How to use the game

1. Enter a player name.
2. Choose one of the dog avatars.
3. Join the island and move around the world.
4. Interact with activities like racing cars, the fetch ball, and the lazy river.

## Default controls

- `WASD` or arrow keys: move
- `Space`: jump
- `Shift`: sprint on foot or boost while driving
- `E`: interact, including entering cars, using prompts, and joining the lazy river
- `Q`: drop the fetch ball
- `1` through `6`: emotes
- `Esc`: close the throw overlay when it is open

Touch UI is also present for the main in-game actions on mobile-sized screens.

## Project structure

- `index.html`: bootstraps Phaser and loads the browser scripts in order
- `src/scenes/`: menu, loading, and gameplay scenes
- `src/config/`: declarative configuration for the island, racing, fetch, and lazy river systems
- `src/shared/`: shared logic used by both the browser client and the Node server
- `src/net/`: the Socket.IO bridge used by the client
- `server/`: the Express and Socket.IO server
- `misc_assets/` and `sprites/`: world art, UI art, and dog sprites

## Notes for reviewers

- This repo does not include any API keys in the tracked source.
- There are no repo-local `AGENT.md`, `CLAUDE.md`, or similar assistant instruction files in the tracked project files.
