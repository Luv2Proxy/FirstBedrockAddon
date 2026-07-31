import { world, system } from "@minecraft/server";

const overworld = world.getDimension("overworld");

// /function make_island
// Extracts a configurable square region around the player's chunk.
// The first recognized natural surface block is the top of the extracted mass.
// Everything at and below it is preserved exactly, while everything above it
// (trees, structures, leaves, etc.) remains attached and moves with it.
const CONFIG = {
  // Change this value in-game with /scriptevent firstbedrockaddon:set_size N
  // or edit it here. This is the radius in chunks around the player's chunk.
  // 0 = 1x1 chunk, 1 = 3x3 chunks, 2 = 5x5 chunks, etc.
  islandRadiusChunks: 1,
  liftY: 80,
  minY: -64,
  maxY: 320,
  columnsPerTick: 16,
  blocksPerTick: 5000,
  centerDepth: 64,
  surfaceBlocks: new Set([
    "minecraft:grass_block",
    "minecraft:dirt",
    "minecraft:coarse_dirt",
    "minecraft:rooted_dirt",
    "minecraft:podzol",
    "minecraft:mycelium",
    "minecraft:grass_path",
    "minecraft:sand",
    "minecraft:red_sand",
    "minecraft:sandstone",
    "minecraft:red_sandstone",
    "minecraft:terracotta",
    "minecraft:white_terracotta",
    "minecraft:orange_terracotta",
    "minecraft:magenta_terracotta",
    "minecraft:light_blue_terracotta",
    "minecraft:yellow_terracotta",
    "minecraft:lime_terracotta",
    "minecraft:pink_terracotta",
    "minecraft:gray_terracotta",
    "minecraft:light_gray_terracotta",
    "minecraft:cyan_terracotta",
    "minecraft:purple_terracotta",
    "minecraft:blue_terracotta",
    "minecraft:brown_terracotta",
    "minecraft:green_terracotta",
    "minecraft:red_terracotta",
    "minecraft:black_terracotta"
  ])
};

let activeJob = null;

world.afterEvents.worldLoad.subscribe(() => {
  world.sendMessage("§7Floating Island prototype loaded. Use §f/function make_island§7.");
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
  const player = event.sourceEntity;
  if (!player || player.typeId !== "minecraft:player") return;

  if (event.id === "firstbedrockaddon:make_island") {
    makeIsland(player);
    return;
  }

  if (event.id === "firstbedrockaddon:set_size") {
    const value = Number.parseInt(event.message.trim(), 10);
    if (!Number.isFinite(value) || value < 0 || value > 8) {
      player.sendMessage("§cIsland size must be a chunk radius from 0 to 8.");
      return;
    }
    CONFIG.islandRadiusChunks = value;
    player.sendMessage(`§aIsland size set to ${2 * value + 1}×${2 * value + 1} chunks.`);
  }
});

function makeIsland(player) {
  if (activeJob) {
    player.sendMessage("§cAn island transformation is already running.");
    return;
  }

  const playerChunkX = Math.floor(player.location.x / 16);
  const playerChunkZ = Math.floor(player.location.z / 16);
  const radius = CONFIG.islandRadiusChunks;
  const minX = (playerChunkX - radius) * 16;
  const minZ = (playerChunkZ - radius) * 16;
  const maxX = (playerChunkX + radius + 1) * 16 - 1;
  const maxZ = (playerChunkZ + radius + 1) * 16 - 1;

  activeJob = {
    minX, minZ, maxX, maxZ,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
    radiusX: (maxX - minX + 1) / 2,
    radiusZ: (maxZ - minZ + 1) / 2,
    phase: "scan",
    scanX: minX,
    scanZ: minZ,
    columns: [],
    columnCursor: 0,
    captureY: null,
    writeCursor: 0,
    clearCursor: 0,
    blocks: [],
    clearBlocks: []
  };

  player.sendMessage(`§bExtracting ${2 * radius + 1}×${2 * radius + 1} chunks. Surface detection and 3D terrain capture starting...`);
  tickJob();
}

function tickJob() {
  if (!activeJob) return;

  try {
    switch (activeJob.phase) {
      case "scan": scanSurface(); break;
      case "capture": captureTerrain(); break;
      case "write": writeTerrain(); break;
      case "clear": clearOriginalTerrain(); break;
      case "done": finishJob(); return;
    }
  } catch (error) {
    console.warn(`[FloatingIsland] ${error}`);
    activeJob = null;
    return;
  }

  if (activeJob) system.run(tickJob);
}

function scanSurface() {
  const job = activeJob;
  let processed = 0;

  while (job.scanZ <= job.maxZ && processed < CONFIG.columnsPerTick) {
    const x = job.scanX;
    const z = job.scanZ;
    const surfaceY = findSurface(x, z);

    if (surfaceY !== undefined) job.columns.push({ x, z, surfaceY });

    job.scanX++;
    if (job.scanX > job.maxX) {
      job.scanX = job.minX;
      job.scanZ++;
    }
    processed++;
  }

  if (job.scanZ > job.maxZ) {
    job.phase = "capture";
    job.columnCursor = 0;
    job.captureY = null;
    world.sendMessage(`§bFound ${job.columns.length} surface columns. Capturing terrain below the real surface, including caves and ores...`);
  }
}

function findSurface(x, z) {
  // Start at the highest non-air block. This lets trees/structures be found,
  // then continue downward until we hit the actual natural surface material.
  let foundAboveSurface = false;

  for (let y = CONFIG.maxY; y >= CONFIG.minY; y--) {
    const block = overworld.getBlock({ x, y, z });
    if (!block) return undefined;
    if (isAir(block.typeId)) continue;

    foundAboveSurface = true;
    if (foundAboveSurface && CONFIG.surfaceBlocks.has(block.typeId)) {
      return y;
    }
  }

  return undefined;
}

function captureTerrain() {
  const job = activeJob;
  let processed = 0;

  while (job.columnCursor < job.columns.length && processed < CONFIG.columnsPerTick) {
    const column = job.columns[job.columnCursor];

    if (job.captureY === null) {
      const nx = (column.x - job.centerX) / job.radiusX;
      const nz = (column.z - job.centerZ) / job.radiusZ;
      const distance = Math.min(1, Math.sqrt(nx * nx + nz * nz));

      // A water-droplet / inverted-dome profile. The center gets the deepest
      // extracted terrain; the edge comes to a point.
      const falloff = Math.cos(distance * Math.PI / 2);
      column.bottomY = Math.max(CONFIG.minY, Math.floor(column.surfaceY - CONFIG.centerDepth * falloff));
      column.captureY = column.bottomY;
    }

    while (column.captureY <= column.surfaceY && processed < CONFIG.columnsPerTick) {
      const source = overworld.getBlock({ x: column.x, y: column.captureY, z: column.z });
      if (source) {
        job.blocks.push({
          x: column.x,
          y: column.captureY + CONFIG.liftY,
          z: column.z,
          permutation: source.permutation
        });
      }
      column.captureY++;
      processed++;
    }

    if (column.captureY > column.surfaceY) {
      job.columnCursor++;
      job.captureY = null;
    }
  }

  if (job.columnCursor >= job.columns.length) {
    // Clear exactly the source volume that was captured. The top includes the
    // detected surface, while blocks above it are also moved separately below.
    // This second pass captures all blocks above the surface so trees and
    // structures stay attached to the extracted terrain.
    for (const column of job.columns) {
      for (let y = CONFIG.maxY; y > column.surfaceY; y--) {
        const source = overworld.getBlock({ x: column.x, y, z: column.z });
        if (source && !isAir(source.typeId)) {
          job.blocks.push({
            x: column.x,
            y: y + CONFIG.liftY,
            z: column.z,
            permutation: source.permutation
          });
        }
      }

      for (let y = column.bottomY; y <= CONFIG.maxY; y++) {
        job.clearBlocks.push({ x: column.x, y, z: column.z });
      }
    }

    job.phase = "write";
    job.writeCursor = 0;
    world.sendMessage(`§bCaptured ${job.blocks.length.toLocaleString()} blocks. Moving the complete surface, vegetation, structures, caves, and ores upward...`);
  }
}

function writeTerrain() {
  const job = activeJob;
  let written = 0;

  while (job.writeCursor < job.blocks.length && written < CONFIG.blocksPerTick) {
    const item = job.blocks[job.writeCursor++];
    const target = overworld.getBlock({ x: item.x, y: item.y, z: item.z });
    if (target) target.setPermutation(item.permutation);
    written++;
  }

  if (job.writeCursor >= job.blocks.length) {
    job.phase = "clear";
    job.clearCursor = 0;
    world.sendMessage("§bThe complete terrain mass has been lifted. Clearing the original extracted region...");
  }
}

function clearOriginalTerrain() {
  const job = activeJob;
  let cleared = 0;

  while (job.clearCursor < job.clearBlocks.length && cleared < CONFIG.blocksPerTick) {
    const pos = job.clearBlocks[job.clearCursor++];
    const block = overworld.getBlock(pos);
    if (block && !isAir(block.typeId)) block.setType("minecraft:air");
    cleared++;
  }

  if (job.clearCursor >= job.clearBlocks.length) job.phase = "done";
}

function finishJob() {
  const job = activeJob;
  world.sendMessage(`§aFloating island complete! Extracted ${((job.maxX - job.minX + 1) / 16)}×${((job.maxZ - job.minZ + 1) / 16)} chunks and lifted them ${CONFIG.liftY} blocks.`);
  activeJob = null;
}

function isAir(typeId) {
  return typeId === "minecraft:air" ||
    typeId === "minecraft:cave_air" ||
    typeId === "minecraft:void_air";
}
