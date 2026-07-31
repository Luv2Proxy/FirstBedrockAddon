import { WORLD_CONFIG } from "../config/worldConfig.js";
import { getWorldSeed } from "../world/seed.js";
import { regionBounds } from "./regionManager.js";
import { generateIslandCandidates } from "../islands/islandDistributor.js";
import { sampleIsland } from "../islands/islandGenerator.js";

export class RegionGenerator {
  constructor(dimension, regionManager) {
    this.dimension = dimension;
    this.regionManager = regionManager;
    this.seed = getWorldSeed();
  }

  planRegion(rx, rz) {
    return generateIslandCandidates(rx, rz, this.seed);
  }

  generateRegion(rx, rz) {
    const bounds = regionBounds(rx, rz);
    const islands = this.planRegion(rx, rz);
    let operations = 0;

    // This is intentionally a bounded prototype pass. The final generator will
    // replace this with chunk-aware bulk fill operations and a persistent cache.
    for (const island of islands) {
      const minX = Math.max(bounds.minX, island.x - island.radius);
      const maxX = Math.min(bounds.maxX, island.x + island.radius);
      const minZ = Math.max(bounds.minZ, island.z - island.radius);
      const maxZ = Math.min(bounds.maxZ, island.z + island.radius);

      for (let x = minX; x <= maxX; x += 4) {
        for (let z = minZ; z <= maxZ; z += 4) {
          const sample = sampleIsland(island, x, island.y, z, this.seed);
          if (!sample) continue;
          // Generation is queued as metadata for now. Direct block placement
          // belongs in the scheduler after loaded-chunk checks are implemented.
          operations++;
          if (operations >= WORLD_CONFIG.generationBudgetOperationsPerTick) return { islands, operations, partial: true };
        }
      }
    }

    this.regionManager.markGenerated(rx, rz);
    return { islands, operations, partial: false };
  }
}
