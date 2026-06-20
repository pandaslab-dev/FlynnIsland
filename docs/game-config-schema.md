# Flynn Island Configuration Schema

## Purpose

Flynn Island uses plain JavaScript configuration modules instead of a separate JSON or DSL format. These modules define the world layout, activity rules, and asset references in a declarative way so the client and server can share the same gameplay assumptions.

The main config files are:

- `src/config/IslandWorldConfig.js`
- `src/config/RacingConfig.js`
- `src/config/FetchConfig.js`
- `src/config/LazyRiverConfig.js`

Each module exports a frozen object so values are treated as read-only runtime configuration.

## Shared design pattern

Most config objects follow the same structure:

- Asset metadata:
  - `textureKey`: the Phaser texture ID
  - `imagePath`: the repo-relative asset path
  - `requestPath`: the asset path with a cache-busting version query string
- Placement data:
  - world coordinates like `x`, `y`, and `angle`
- Interaction data:
  - radii, offsets, and prompt distances
- Physics data:
  - movement limits, bounce values, drag, and collision tuning

This keeps gameplay tuning in one place instead of scattering constants across scene logic.

## `IslandWorldConfig`

This module defines the overall island canvas.

- `worldBounds`: the playable coordinate system
- `spawn`: the default player spawn point
- `islandArt`: the main world image and its center point
- `collisionMask`: the image-based collision map used by the server and client

Key idea: black or near-black pixels in the collision mask are treated as blocked space.

## `RacingConfig`

This module defines the racing activity.

- `trackMask`: image mask for drivable track areas
- `cars`: an array of car definitions
- `physics`: shared tuning values for acceleration, steering, drag, collision response, and skid trail behavior

Each entry in `cars` includes:

- Identity:
  - `id`
  - `textureKey`
- Asset paths:
  - `imagePath`
  - `requestPath`
- Spawn data:
  - `spawn.x`
  - `spawn.y`
  - `spawn.angle`
- Render data:
  - `display.scale`
  - `display.originX`
  - `display.originY`
- Seat data for the rider sprite:
  - `seat.offsetX`
  - `seat.offsetY`
  - `seat.scale`
- Physics footprint:
  - `physics.halfLength`
  - `physics.halfWidth`
  - `physics.collisionRadius`
  - `physics.entryRadius`

## `FetchConfig`

This module defines the fetch minigame.

- `ball`: the tennis ball asset, radius, display scale, and carry offsets
- `interaction`: pickup and prompt distance thresholds
- `spawn`: where and how the ball can respawn
- `physics`: throw speed, drag, bounce response, and collision tuning
- `throwDirections`: the four allowed throw directions used by the UI

The fetch system is backed by shared helpers in `src/shared/FetchShared.js`, which use this config to keep local visuals and server authority aligned.

## `LazyRiverConfig`

This module defines the lazy river activity.

- `mask`: the image that marks valid water space
- `tubes`: the rideable tubes and their spawn progress on the loop
- `display`: render scale, shadows, wobble, and collision sampling
- `rider`: how the dog sprite is positioned on a tube
- `occlusionZones`: areas where visual layering changes to sell depth
- `interaction`: boarding and exit search distances
- `physics`: tube speed and path constraint search tuning
- `path`: the loop of waypoints that defines river flow

The `path.waypoints` array is especially important. It is the authored route for the river, and shared logic smooths it into a continuous loop for tube movement.

## Why this schema matters

This configuration approach makes the project easier to reason about because:

- gameplay tuning is centralized
- client and server can share the same constants
- new content can be added with minimal scene rewrites
- asset references stay close to the behavior they support

For internship review, the important architectural idea is that Flynn Island treats gameplay systems as data-driven modules first and scene logic second.
