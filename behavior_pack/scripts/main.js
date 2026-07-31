import { world, system } from "@minecraft/server";

const overworld = world.getDimension("overworld");

// Prototype: converts a small, deterministic area around spawn into a floating island.
// This is intentionally conservative while the generation approach is validated.
const CONFIG = {
  centerX: 0,
  centerZ: 0,
  radius: 32,
  bottomY: 35,
  scanMinY: -64,
  scanMaxY: 320,
  processPerTick: 256,
  surfaceSkip: new Set([
    "minecraft:air",
    "minecraft:cave_air",
    "minecraft:void_air",
    "minecraft:oak_log",
    "minecraft:spruce_log",
    "minecraft:birch_log",
    "minecraft:jungle_log",
    "minecraft:acacia_log",
    "minecraft:dark_oak_log",
    "minecraft:mangrove_log",
    "minecraft:oak_leaves",
    "minecraft:spruce_leaves",
    "minecraft:birch_leaves",
    "minecraft:jungle_leaves",
    "minecraft:acacia_leaves",
    "minecraft:dark_oak_leaves",
    "minecraft:mangrove_leaves",
    "minecraft:azalea_leaves",
    "minecraft:flowering_azalea_leaves",
    "minecraft:grass",
    "minecraft:tallgrass",
    "minecraft:fern",
    "minecraft:large_fern",
    "minecraft:vine",
    "minecraft:glow_lichen",
    "minecraft:snow",
    "minecraft:snow_layer"
  ])
};

let initialized = false;
let queue = [];
let cursor = 0;
let sourceColumns = new Map();

world.afterEvents.worldLoad.subscribe(() => {
  system.runTimeout(() => {
    if (overworld.isChunkLoaded({ x: CONFIG.centerX, y: 0, z: CONFIG.centerZ })) {
      initializePrototype();
    }
  }, 40);
});

function initializePrototype() {
  if (initialized) return;
  initialized = true;

  for (let x = CONFIG.centerX - CONFIG.radius; x <= CONFIG.centerX + CONFIG.radius; x++) {
    for (let z = CONFIG.centerZ - CONFIG.radius; z <= CONFIG.centerZ + CONFIG.radius; z++) {
      const dx = x - CONFIG.centerX;
      const dz = z - CONFIG.centerZ;
      if (dx * dx + dz * dz <= CONFIG.radius * CONFIG.radius) {
        queue.push({ x, z });
      }
    }
  }

  world.sendMessage("§bFloating Island Prototype: scanning terrain...");
}

system.runInterval(() => {
  if (!initialized || cursor >= queue.length) return;

  let processed = 0;
  while (cursor < queue.length && processed < CONFIG.processPerTick) {
    const column = queue[cursor++];
    processColumn(column.x, column.z);
    processed++;
  }

  if (cursor >= queue.length) {
    buildUnderside();
    world.sendMessage("§aFloating Island Prototype: transformation complete!");
  }
}, 1);

function processColumn(x, z) {
  if (!overworld.isChunkLoaded({ x, y: 0, z })) return;

  let surfaceY = undefined;
  let topY = undefined;

  for (let y = CONFIG.scanMaxY; y >= CONFIG.scanMinY; y--) {
    const block = overworld.getBlock({ x, y, z });
    if (!block) continue;
    if (block.typeId !== "minecraft:air" && block.typeId !== "minecraft:cave_air" && block.typeId !== "minecraft:void_air") {
      if (topY === undefined) topY = y;
      if (!CONFIG.surfaceSkip.has(block.typeId)) {
        surfaceY = y;
        break;
      }
    }
  }

  if (surfaceY === undefined) return;

  const surface = overworld.getBlock({ x, y: surfaceY, z });
  if (!surface) return;

  sourceColumns.set(`${x},${z}`, {
    x,
    z,
    surfaceY,
    topY,
    permutation: surface.permutation,
    typeId: surface.typeId
  });
}

function buildUnderside() {
  for (const data of sourceColumns.values()) {
    const dx = data.x - CONFIG.centerX;
    const dz = data.z - CONFIG.centerZ;
    const distance = Math.sqrt(dx * dx + dz * dz) / CONFIG.radius;
    const falloff = Math.cos(Math.min(1, distance) * Math.PI / 2);
    const bottom = Math.floor(CONFIG.bottomY + falloff * Math.max(0, data.surfaceY - CONFIG.bottomY));

    if (bottom >= data.surfaceY) continue;

    const material = data.permutation;
    for (let y = bottom; y < data.surfaceY; y++) {
      const block = overworld.getBlock({ x: data.x, y, z: data.z });
      if (block) block.setPermutation(material);
    }
  }

  // Remove terrain outside the island footprint below the detected surface.
  // We deliberately leave the original surface and everything above it untouched.
  for (let x = CONFIG.centerX - CONFIG.radius; x <= CONFIG.centerX + CONFIG.radius; x++) {
    for (let z = CONFIG.centerZ - CONFIG.radius; z <= CONFIG.centerZ + CONFIG.radius; z++) {
      const dx = x - CONFIG.centerX;
      const dz = z - CONFIG.centerZ;
      if (dx * dx + dz * dz > CONFIG.radius * CONFIG.radius) continue;

      const data = sourceColumns.get(`${x},${z}`);
      if (!data) continue;

      const distance = Math.sqrt(dx * dx + dz * dz) / CONFIG.radius;
      const falloff = Math.cos(Math.min(1, distance) * Math.PI / 2);
      const bottom = Math.floor(CONFIG.bottomY + falloff * Math.max(0, data.surfaceY - CONFIG.bottomY));

      for (let y = CONFIG.scanMinY; y < bottom; y++) {
        const block = overworld.getBlock({ x, y, z });
        if (block && block.typeId !== "minecraft:air" && block.typeId !== "minecraft:cave_air" && block.typeId !== "minecraft:void_air") {
          block.setType("minecraft:air");
        }
      }
    }
  }
}
