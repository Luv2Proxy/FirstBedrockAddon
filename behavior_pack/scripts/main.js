import { world, system } from "@minecraft/server";

const overworld = world.getDimension("overworld");

// Test command: /function make_island
// Extracts the 16x16 chunk containing the executing player, lifts the complete
// generated terrain volume, then carves its underside into a convex shape.
const CONFIG = {
  liftY: 80,
  minY: -64,
  maxY: 320,
  columnsPerTick: 8,
  blocksPerTick: 4000,
  centerDepth: 48
};

let activeJob = null;

world.afterEvents.worldLoad.subscribe(() => {
  world.sendMessage("§7Floating Island prototype loaded. Use §f/function make_island§7.");
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "firstbedrockaddon:make_island") return;

  const player = event.sourceEntity;
  if (!player || player.typeId !== "minecraft:player") return;

  makeIsland(player);
});

function makeIsland(player) {
  if (activeJob) {
    player.sendMessage("§cAn island transformation is already running.");
    return;
  }

  const minX = Math.floor(player.location.x / 16) * 16;
  const minZ = Math.floor(player.location.z / 16) * 16;

  activeJob = {
    minX,
    minZ,
    maxX: minX + 15,
    maxZ: minZ + 15,
    centerX: minX + 7.5,
    centerZ: minZ + 7.5,
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

  player.sendMessage(`§bExtracting chunk ${minX}, ${minZ} and lifting it ${CONFIG.liftY} blocks...`);
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
    const topY = findSurface(x, z);

    if (topY !== undefined) job.columns.push({ x, z, topY });

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
    world.sendMessage(`§bFound ${job.columns.length} terrain columns. Capturing the exact 3D terrain, including caves and ores...`);
  }
}

function findSurface(x, z) {
  for (let y = CONFIG.maxY; y >= CONFIG.minY; y--) {
    const block = overworld.getBlock({ x, y, z });
    if (!block) return undefined;
    if (!isAir(block.typeId)) return y;
  }
  return undefined;
}

function captureTerrain() {
  const job = activeJob;
  let processed = 0;

  while (job.columnCursor < job.columns.length && processed < CONFIG.columnsPerTick) {
    const column = job.columns[job.columnCursor];

    if (job.captureY === null) {
      const dx = column.x - job.centerX;
      const dz = column.z - job.centerZ;
      const distance = Math.min(1, Math.sqrt(dx * dx + dz * dz) / 11.314);
      const falloff = Math.cos(distance * Math.PI / 2);
      column.bottomY = Math.max(CONFIG.minY, Math.floor(column.topY - CONFIG.centerDepth * falloff));
      column.captureY = column.bottomY;
    }

    while (column.captureY <= column.topY && processed < CONFIG.columnsPerTick) {
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

    if (column.captureY > column.topY) {
      job.columnCursor++;
      job.captureY = null;
    }
  }

  if (job.columnCursor >= job.columns.length) {
    for (const column of job.columns) {
      for (let y = column.bottomY; y <= column.topY; y++) {
        job.clearBlocks.push({ x: column.x, y, z: column.z });
      }
    }

    job.phase = "write";
    job.writeCursor = 0;
    world.sendMessage(`§bCaptured ${job.blocks.length.toLocaleString()} blocks. Lifting the terrain...`);
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
    world.sendMessage("§bThe extracted terrain is now floating. Clearing the original chunk section...");
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
  world.sendMessage(`§aFloating Island complete! Chunk ${job.minX}, ${job.minZ} was extracted and lifted ${CONFIG.liftY} blocks.`);
  activeJob = null;
}

function isAir(typeId) {
  return typeId === "minecraft:air" ||
    typeId === "minecraft:cave_air" ||
    typeId === "minecraft:void_air";
}
