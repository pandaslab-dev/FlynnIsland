# Flynn Island

Flynn Island is a multiplayer browser game where players can explore a shared island, pick a dog avatar, and hang out through small interactive activities.

Live demo: [flynnisland.pandaslab.dev](https://flynnisland.pandaslab.dev). It runs on a free Render instance, so a cold start can occasionally make the first load take around 15 seconds.

## Why I built it

I built Flynn Island to explore what a playful real-time social game could look like with a lightweight JavaScript stack. It was originally just to create a game to play with my family where you can pick one of our dogs to play as. It gave me a way to practice multiplayer state sync, shared client/server game logic, collision systems driven by image masks, and mobile-friendly UI work in a project that still felt fun and personal.

## Tech stack

- JavaScript
- HTML / CSS
- Phaser 3
- Node.js
- Express
- Socket.IO
- Nano Banana

## Current features

- Real-time multiplayer movement with server-authoritative world state
- Dog name and avatar selection before joining the island
- Drivable race cars with shared track collision
- A fetch minigame with pickup, drop, throw, and bounce behavior
- Lazy river tubes that follow a configured looping path
- Keyboard and touch-friendly UI, including emotes and mobile overlays

## What I learned

- How to separate shared game rules into reusable modules so the browser client and Node server stay in sync
- How to build server-authoritative multiplayer flows without overcomplicating the client
- How to use configuration modules and image-based masks to drive world layout, collision, and interactions
- How much UI and input polish is needed to make the same game feel usable on both desktop and mobile

## What I would improve next

- Organic human art.
- Add automated tests around shared physics and interaction helpers
- Add persistence for player identity, cosmetics, and session history
- Add more island activities, clearer onboarding, and stronger in-game feedback
- Refine deployment ergonomics and room management for more reliable multiplayer scaling

## Running locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

Additional docs:

- [Running locally and using the project](/Users/panda/Projects/2026/FlynnIsland/docs/running-locally.md)
- [Game configuration schema](/Users/panda/Projects/2026/FlynnIsland/docs/game-config-schema.md)
