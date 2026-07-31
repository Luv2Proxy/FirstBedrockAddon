import { world, system } from "@minecraft/server";

const LOBBY = { x: 0, y: 80, z: 0 };
const ARCHIPELAGO = { x: 0, y: 160, z: 0 };
const PORTAL_RADIUS = 3;
const cooldowns = new Map();

export function setupPortalSystem() {
  system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
      const now = system.currentTick;
      if ((cooldowns.get(player.id) ?? 0) > now) continue;

      if (player.dimension.id === "minecraft:overworld" && near(player.location, LOBBY, PORTAL_RADIUS)) {
        teleportToArchipelago(player);
      } else if (player.dimension.id === "sky_archipelago:archipelago" && near(player.location, ARCHIPELAGO, PORTAL_RADIUS)) {
        teleportToLobby(player);
      }
    }
  }, 10);
}

function teleportToArchipelago(player) {
  try {
    player.teleport(ARCHIPELAGO, { dimension: world.getDimension("sky_archipelago:archipelago"), keepVelocity: false });
    player.sendMessage("§bEntering the Sky Archipelago...");
    cooldowns.set(player.id, system.currentTick + 40);
  } catch (error) {
    player.sendMessage("§cThe Sky Archipelago dimension is not available yet.");
    console.warn(`[SkyArchipelago] Portal destination unavailable: ${error}`);
  }
}

function teleportToLobby(player) {
  try {
    player.teleport(LOBBY, { dimension: world.getDimension("minecraft:overworld"), keepVelocity: false });
    player.sendMessage("§eReturning to the lobby...");
    cooldowns.set(player.id, system.currentTick + 40);
  } catch (error) {
    console.warn(`[SkyArchipelago] Lobby return failed: ${error}`);
  }
}

function near(a, b, radius) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz <= radius * radius;
}
