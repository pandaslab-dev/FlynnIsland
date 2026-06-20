# Flynn Island Multiplayer Architecture (Phase 1)

## What Is Prepared In Client Code

- `GameScene` now stores entities in `this.players` keyed by player ID.
- Local player is tracked by `this.localPlayerId`.
- Player rendering is centralized in `addOrUpdatePlayer()` and `removePlayer()`.
- World updates can be consumed through `applyWorldState(worldState)`.
- Input is emitted through a network seam (`FlynnNetworkBridge.sendInput`) every 50ms.
- Emotes can be emitted through `FlynnNetworkBridge.sendEmote`.
- Dog assets and animations are prepared for all dog types so remote players can render correctly.

## Phase 1 Authoritative Server Contract

Use Socket.io events with this shape:

- `player:join`
  - client -> server payload: `{ name, dogType }`
- `player:input`
  - client -> server payload: `{ moveX, moveY, jump, animation }`
- `player:emote`
  - client -> server payload: `"❤️"` (or other emoji)
- `world:state`
  - server -> client payload:
    - `{ players: [{ id, name, dogType, x, y, flipX, animation, emote? }] }`

## Server Rules (Do Not Trust Client)

- Server owns truth for all positions, animation state, and bounds checks.
- Client sends only intent/input, not authority.
- Clamp positions to island bounds on server.
- Sanitize `name` and `dogType` on join.
- Broadcast full world snapshots at fixed tick (`50ms` for phase 1).

## Next Implementation Steps

1. Build a Node.js + Socket.io server with in-memory `players` map and per-player input cache.
2. Run a fixed server simulation tick (`20Hz`) to advance player positions from input.
3. Emit `world:state` snapshots every tick.
4. Include Socket.io client in `index.html` (or bundle) when server is active.
5. In `GameScene`, treat server snapshots as source of truth for remote players first, then for local player once prediction/reconciliation is added.

## Hosting Notes

- Static-only hosting is not enough for real-time multiplayer.
- Deploy a long-running Node process for WebSocket connections.
- Serve the Phaser client and Socket.io from the same origin first to avoid CORS complexity.
- The live deployment is available at `https://flynnisland.pandaslab.dev`.
- It is hosted on a free Render instance, so cold starts can take around 15 seconds before the island finishes loading.
