# Procedural World Generation

The intended world is a Sky Archipelago-style procedural dimension rather than a single Skyblock island.

## Region model

The world is divided into 512x512 logical regions. Region coordinates are derived from world X/Z coordinates. A region's island layout is deterministic from the project seed and region coordinates.

## Island distribution

Each region uses layered noise to decide whether it contains an island cluster. Clusters contain multiple islands with weighted archetypes:

- Classic
- Bowl / crater
- Crescent
- Terrace
- Mountain

Island centers, radii, and heights are deterministic.

## Terrain model

The prototype uses a 3D density model composed from:

- radial island shape
- low-frequency terrain noise
- high-frequency detail noise
- depth below the surface
- 3D cave noise

The current sampler returns block material metadata but intentionally does not place blocks yet.

## Performance model

Generation is queued by region and processed over multiple ticks. The player region receives the highest priority, followed by neighboring regions. The intended production implementation will use loaded-chunk checks and bulk operations where possible.
