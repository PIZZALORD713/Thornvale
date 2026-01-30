# Project Structure

This project aims to avoid “everything in main.js.”

## Suggested Layout

```
/src
  /app
    main.ts
    loop.ts
  /core
    renderer.ts
    scene.ts
    input.ts
    time.ts
  /game
    /player
      player.ts
      controller.ts
      grounding.ts
      interactions.ts
    /world
      world.ts
      dayNight.ts
      interactables.ts
  /ui
    hud.ts
    debug.ts
/public
  /models
  /textures
  /hdr
```

## Conventions

* `core/` = engine-ish utilities
* `game/` = gameplay code
* `ui/` = overlays and prompts
