import { ISLAND_ARCHETYPES, ISLAND_CONFIG } from "../config/islandConfig.js";
import { WORLD_CONFIG } from "../config/worldConfig.js";
import { fractalNoise2D, random01, random2D } from "../noise/random.js";

function weightedArchetype(seed) {
  const total = ISLAND_ARCHETYPES.reduce((sum, a) => sum + a.weight, 0);
  let pick = random01(seed) * total;
  for (const archetype of ISLAND_ARCHETYPES) {
    pick -= archetype.weight;
    if (pick <= 0) return archetype;
  }
  return ISLAND_ARCHETYPES[0];
}

export function generateIslandCandidates(rx, rz, seed) {
  const size = WORLD_CONFIG.regionSize;
  const centerX = rx * size + size / 2;
  const centerZ = rz * size + size / 2;
  const density = fractalNoise2D(rx * 0.17, rz * 0.17, seed, 3);
  const cluster = density > (1 - ISLAND_CONFIG.clusterChance);
  if (!cluster) return [];

  const count = 1 + Math.floor(random2D(rx * 13 + 7, rz * 17 - 3, seed) * ISLAND_CONFIG.maxIslandsPerCluster);
  const islands = [];
  for (let i = 0; i < count; i++) {
    const angle = random2D(rx * 31 + i, rz * 47 - i, seed) * Math.PI * 2;
    const distance = Math.sqrt(random2D(rx * 53 + i, rz * 71 + i, seed)) * ISLAND_CONFIG.maxClusterRadius;
    const x = Math.floor(centerX + Math.cos(angle) * distance);
    const z = Math.floor(centerZ + Math.sin(angle) * distance);
    const archetype = weightedArchetype((rx * 928371 + rz * 1237 + i * 7919 + seed) | 0);
    const radius = Math.floor(archetype.minRadius + random2D(x, z, seed + i) * (archetype.maxRadius - archetype.minRadius));
    const y = Math.floor(WORLD_CONFIG.minIslandY + random2D(z, x, seed + 91) * (WORLD_CONFIG.maxIslandY - WORLD_CONFIG.minIslandY));
    islands.push({ id: `${x}:${y}:${z}`, x, y, z, radius, archetype: archetype.id });
  }
  return islands;
}
