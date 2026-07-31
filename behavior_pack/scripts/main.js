import { world, system } from "@minecraft/server";

const overworld = world.getDimension("overworld");

const CONFIG = {
  islandRadiusChunks: 1,
  liftY: 80,
  minY: -64,
  maxY: 320,
  columnsPerTick: 32,
  blocksPerTick: 5000,
  centerDepth: 64,
  oceanBiomes: new Set(["ocean", "deep_ocean", "cold_ocean", "deep_cold_ocean", "frozen_ocean", "deep_frozen_ocean", "lukewarm_ocean", "deep_lukewarm_ocean", "warm_ocean"]),
  surfaceBlocks: new Set([
    "grass_block", "dirt", "coarse_dirt", "rooted_dirt", "podzol", "mycelium", "grass_path",
    "sand", "red_sand", "sandstone", "red_sandstone", "terracotta",
    "white_terracotta", "orange_terracotta", "magenta_terracotta", "light_blue_terracotta",
    "yellow_terracotta", "lime_terracotta", "pink_terracotta", "gray_terracotta",
    "light_gray_terracotta", "cyan_terracotta", "purple_terracotta", "blue_terracotta",
    "brown_terracotta", "green_terracotta", "red_terracotta", "black_terracotta",
    "snow_block", "ice", "packed_ice", "blue_ice", "mud", "mud_bricks"
  ])
};

let activeJob = null;

world.afterEvents.worldLoad.subscribe(() => {
  world.sendMessage("§7Floating Island prototype loaded. Use §f/function make_island§7.");
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
  // Do not require event.sourceEntity. A /scriptevent issued from a function
  // can arrive without a source entity, which previously caused the handler
  // to return before makeIsland() was ever called.
  if (event.id === "firstbedrockaddon:make_island") {
    const player = getCommandPlayer(event);
    if (!player) {
      world.sendMessage("§cNo player is available to create the island.");
      return;
    }
    makeIsland(player);
    return;
  }

  if (event.id === "firstbedrockaddon:set_size") {
    const player = getCommandPlayer(event);
    const value = Number.parseInt(event.message.trim(), 10);
    if (!Number.isInteger(value) || value < 0 || value > 8) {
      (player ?? world).sendMessage("§cIsland size must be a chunk radius from 0 to 8.");
      return;
    }
    CONFIG.islandRadiusChunks = value;
    (player ?? world).sendMessage(`§aIsland size set to ${2 * value + 1}×${2 * value + 1} chunks.`);
  }
});

function getCommandPlayer(event) {
  // Prefer the event source when Minecraft supplies one.
  if (event.sourceEntity?.typeId === "minecraft:player") return event.sourceEntity;

  // A function/script event may have no source entity. For the current
  // single-player testing workflow, use the first online player. This also
  // makes /function make_island work reliably from chat.
  const players = world.getAllPlayers();
  return players.length > 0 ? players[0] : undefined;
}

function makeIsland(player) {
  if (activeJob) {
    player.sendMessage("§cAn island transformation is already running.");
    return;
  }

  const chunkX = Math.floor(player.location.x / 16);
  const chunkZ = Math.floor(player.location.z / 16);
  const r = CONFIG.islandRadiusChunks;
  const minX = (chunkX - r) * 16;
  const minZ = (chunkZ - r) * 16;
  const maxX = (chunkX + r + 1) * 16 - 1;
  const maxZ = (chunkZ + r + 1) * 16 - 1;

  activeJob = {
    minX, minZ, maxX, maxZ,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
    radiusX: (maxX - minX + 1) / 2,
    radiusZ: (maxZ - minZ + 1) / 2,
    phase: "scan", scanX: minX, scanZ: minZ,
    columns: [], columnCursor: 0, captureY: null,
    blocks: [], writeCursor: 0, clearBlocks: [], clearCursor: 0
  };

  player.sendMessage(`§bPreparing ${2 * r + 1}×${2 * r + 1} chunk island...`);
  tickJob();
}

function tickJob() {
  if (!activeJob) return;
  try {
    if (activeJob.phase === "scan") scanSurface();
    else if (activeJob.phase === "capture") captureTerrain();
    else if (activeJob.phase === "write") writeTerrain();
    else if (activeJob.phase === "clear") clearOriginalTerrain();
    else if (activeJob.phase === "done") finishJob();
  } catch (error) {
    console.warn(`[FloatingIsland] ${error}`);
    world.sendMessage(`§cFloating island failed: ${error?.message ?? error}`);
    activeJob = null;
    return;
  }
  if (activeJob) system.run(tickJob);
}

function scanSurface() {
  const job = activeJob;
  let count = 0;
  while (job.scanZ <= job.maxZ && count < CONFIG.columnsPerTick) {
    const x = job.scanX, z = job.scanZ;
    if (!isOceanColumn(x, z)) {
      const surfaceY = findSurface(x, z);
      if (surfaceY !== undefined) job.columns.push({ x, z, surfaceY });
    }
    job.scanX++;
    if (job.scanX > job.maxX) { job.scanX = job.minX; job.scanZ++; }
    count++;
  }
  if (job.scanZ > job.maxZ) {
    if (job.columns.length === 0) {
      world.sendMessage("§cNo land columns found. Try a non-ocean location or ensure the area is loaded.");
      activeJob = null;
      return;
    }
    job.phase = "capture";
    job.columnCursor = 0;
    job.captureY = null;
    world.sendMessage(`§bFound ${job.columns.length} land columns. Capturing terrain...`);
  }
}

function isOceanColumn(x, z) {
  try {
    const biome = overworld.getBiome({ x, y: 64, z });
    if (!biome) return false;
    const id = String(biome.id || "").replace("minecraft:", "");
    return CONFIG.oceanBiomes.has(id);
  } catch (error) {
    return false;
  }
}

function findSurface(x, z) {
  for (let y = CONFIG.maxY; y >= CONFIG.minY; y--) {
    const block = overworld.getBlock({ x, y, z });
    if (!block) return undefined;
    if (isAir(block.typeId)) continue;
    const id = block.typeId.replace("minecraft:", "");
    if (CONFIG.surfaceBlocks.has(id)) return y;
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
      const depth = Math.max(1, Math.floor(CONFIG.centerDepth * Math.cos(distance * Math.PI / 2)));
      column.bottomY = Math.max(CONFIG.minY, column.surfaceY - depth);
      column.captureY = column.bottomY;
    }

    while (column.captureY <= column.surfaceY && processed < CONFIG.columnsPerTick) {
      const source = overworld.getBlock({ x: column.x, y: column.captureY, z: column.z });
      if (source) job.blocks.push({ x: column.x, y: column.captureY + CONFIG.liftY, z: column.z, permutation: source.permutation });
      column.captureY++;
      processed++;
    }
    if (column.captureY > column.surfaceY) { job.columnCursor++; job.captureY = null; }
  }

  if (job.columnCursor >= job.columns.length) {
    for (const column of job.columns) {
      for (let y = column.surfaceY + 1; y <= CONFIG.maxY; y++) {
        const source = overworld.getBlock({ x: column.x, y, z: column.z });
        if (source && !isAir(source.typeId)) {
          job.blocks.push({ x: column.x, y: y + CONFIG.liftY, z: column.z, permutation: source.permutation });
        }
      }
      for (let y = column.bottomY; y <= CONFIG.maxY; y++) job.clearBlocks.push({ x: column.x, y, z: column.z });
    }
    job.phase = "write";
    job.writeCursor = 0;
    world.sendMessage(`§bCaptured ${job.blocks.length.toLocaleString()} blocks. Moving the complete island...`);
  }
}

function writeTerrain() {
  const job = activeJob;
  let count = 0;
  while (job.writeCursor < job.blocks.length && count < CONFIG.blocksPerTick) {
    const item = job.blocks[job.writeCursor++];
    const target = overworld.getBlock({ x: item.x, y: item.y, z: item.z });
    if (target) target.setPermutation(item.permutation);
    count++;
  }
  if (job.writeCursor >= job.blocks.length) {
    job.phase = "clear";
    job.clearCursor = 0;
    world.sendMessage("§bIsland copied. Clearing original terrain...");
  }
}

function clearOriginalTerrain() {
  const job = activeJob;
  let count = 0;
  while (job.clearCursor < job.clearBlocks.length && count < CONFIG.blocksPerTick) {
    const pos = job.clearBlocks[job.clearCursor++];
    const block = overworld.getBlock(pos);
    if (block && !isAir(block.typeId)) block.setType("minecraft:air");
    count++;
  }
  if (job.clearCursor >= job.clearBlocks.length) job.phase = "done";
}

function finishJob() {
  const job = activeJob;
  const sx = (job.maxX - job.minX + 1) / 16;
  const sz = (job.maxZ - job.minZ + 1) / 16;
  world.sendMessage(`§aFloating island complete! ${sx}×${sz} chunks lifted ${CONFIG.liftY} blocks.`);
  activeJob = null;
}

function isAir(typeId) {
  return typeId === "minecraft:air" || typeId === "minecraft:cave_air" || typeId === "minecraft:void_air";
}
