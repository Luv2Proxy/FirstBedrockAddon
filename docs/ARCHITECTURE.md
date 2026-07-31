# Sky Archipelago Architecture

## Goal

This project is the foundation for an FTB-style Bedrock pack centered around a procedural floating-island world. Players begin in a simple lobby and enter the persistent Sky Archipelago dimension through a portal.

## Runtime flow

1. The behavior pack loads `scripts/main.js`.
2. The core obtains the Sky Archipelago dimension.
3. The portal system handles lobby entry.
4. Players entering the Archipelago cause nearby regions to be requested.
5. The generation scheduler processes regions in bounded ticks.
6. The region generator uses deterministic seeded island distribution and island archetypes.
7. Island terrain is sampled with layered procedural noise.
8. Structures, biomes, resources, and Physics Glue integration will be layered on later.

## Generation layers

- `noise/`: deterministic pseudo-random and fractal noise primitives.
- `islands/islandDistributor.js`: decides where island clusters and islands exist.
- `islands/islandGenerator.js`: samples the 3D island volume and archetype shape.
- `generation/regionManager.js`: maps coordinates to deterministic regions.
- `generation/generationQueue.js`: deduplicates and prioritizes work.
- `generation/generationScheduler.js`: spreads work across ticks.
- `generation/generator.js`: orchestrates region generation.

## Planned next steps

1. Verify the exact Bedrock 26.33 dimension-generation APIs available in the target runtime.
2. Replace metadata-only terrain sampling with loaded-chunk-safe bulk block placement.
3. Persist generated region state with dynamic properties or a compact storage scheme.
4. Add a guaranteed starter island and protected spawn area.
5. Add biome-aware surface layers and vegetation.
6. Add caves, ores, structures, villages, ruins, and dungeons.
7. Integrate Physics Glue and airship progression.
8. Add FTB-style quests and progression tiers.

## Important prototype status

The current code deliberately separates the worldgen architecture from actual block placement. It is a foundation, not yet a finished infinite procedural world generator. This avoids hard-coding assumptions about Bedrock 26.33's runtime world-generation hooks before they are verified in-game.
