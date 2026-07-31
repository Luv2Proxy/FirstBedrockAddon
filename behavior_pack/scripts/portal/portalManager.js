import { world, system } from "@minecraft/server";

const LOBBY = { x: 0, y: 80, z: 0 };
const ARCHIPELAGO = { x: 0, y: 160, z: 0 };

export function setupPortalSystem() {
  system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
      if (player.dimension.id === "minecraft:overworld" && near(player.location, LOBBY, 3)) {
        try {
          player.teleport(ARCHIPELAGO, { dimension: world.getDimension("sky_archipelago:archipelago") });
        } catch (error) {
          console.warn(`[SkyArchipelago] Portal destination unavailable: ${error}`);
        }
      }
    }
  }, 10);
}

function near(a, b, radius) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz <= radius * radius;
}
