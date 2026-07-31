import { world, system } from "@minecraft/server";
import { RegionManager, worldToRegion } from "./generation/regionManager.js";
import { RegionGenerator } from "./generation/generator.js";
import { GenerationScheduler } from "./generation/generationScheduler.js";
import { setupPortalSystem } from "./portal/portalManager.js";

const DIMENSION_ID = "sky_archipelago:archipelago";
const regionManager = new RegionManager();
let scheduler;

system.runTimeout(() => {
  try {
    const dimension = world.getDimension(DIMENSION_ID);
    const generator = new RegionGenerator(dimension, regionManager);
    scheduler = new GenerationScheduler(generator);
    scheduler.start();
    setupPortalSystem();
    console.warn("[SkyArchipelago] Core initialized.");
  } catch (error) {
    console.warn(`[SkyArchipelago] Initialization failed: ${error}`);
  }
}, 1);

system.runInterval(() => {
  if (!scheduler) return;
  for (const player of world.getAllPlayers()) {
    if (player.dimension.id !== DIMENSION_ID) continue;
    const region = worldToRegion(player.location.x, player.location.z);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const rx = region.x + dx;
        const rz = region.z + dz;
        if (!regionManager.isGenerated(rx, rz)) {
          const distance = Math.abs(dx) + Math.abs(dz);
          scheduler.requestRegion(rx, rz, 100 - distance * 10);
        }
      }
    }
  }
}, 20);

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (!initialSpawn) return;
  player.sendMessage("§bSky Archipelago §7prototype loaded. Enter the portal to begin.");
});
