import { ISLAND_CONFIG } from "../config/islandConfig.js";
import { fractalNoise2D, fractalNoise3D } from "../noise/random.js";

function archetypeShape(type, nx, nz) {
  const r = Math.sqrt(nx * nx + nz * nz);
  if (type === "bowl") return 1 - r * 0.72 + Math.max(0, 0.35 - r) * 0.35;
  if (type === "crescent") {
    const crescent = Math.abs(Math.sqrt((nx + 0.25) ** 2 + nz ** 2) - 0.55);
    return 1 - Math.min(1, crescent * 2.2);
  }
  if (type === "terrace") return 1 - Math.floor(r * 5) / 7;
  if (type === "mountain") return 1 - r * 0.55;
  return 1 - r;
}

export function sampleIsland(island, x, y, z, seed) {
  const dx = (x - island.x) / island.radius;
  const dz = (z - island.z) / island.radius;
  const radial = Math.sqrt(dx * dx + dz * dz);
  if (radial > 1.15) return null;

  const shape = archetypeShape(island.archetype, dx, dz);
  const terrain = fractalNoise2D(x * ISLAND_CONFIG.terrainScale, z * ISLAND_CONFIG.terrainScale, seed, 4);
  const detail = fractalNoise2D(x * ISLAND_CONFIG.detailScale, z * ISLAND_CONFIG.detailScale, seed + 400, 2);
  const topY = island.y + Math.floor((shape * 0.65 + terrain * 0.35) * 22 + detail * 4);
  const depth = Math.max(3, Math.floor((1 - radial) * ISLAND_CONFIG.maxIslandDepth));
  const bottomY = topY - depth;
  if (y > topY || y < bottomY) return null;

  const cave = fractalNoise3D(x * ISLAND_CONFIG.caveScale, y * ISLAND_CONFIG.caveScale, z * ISLAND_CONFIG.caveScale, seed + 900, 3);
  if (y < topY - 10 && cave > ISLAND_CONFIG.caveThreshold) return null;

  return {
    block: y >= topY - ISLAND_CONFIG.surfaceThickness ? "minecraft:stone" : "minecraft:deepslate",
    topY,
    bottomY
  };
}
