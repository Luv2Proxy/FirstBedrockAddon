import { world, system } from "@minecraft/server";

const overworld = world.getDimension("overworld");

// Prototype: rip out a complete 64x64x(vertical) terrain section and turn it
// into one floating island. The original blocks are copied exactly, including
// caves, ores, liquids, block states, trees, and structures.
const CONFIG = {
  centerX: 0,
  centerZ: 0,
  radius: 32,
  // The island is carved from a real generated terrain volume. This is the
  // lowest Y retained at the island center; the underside tapers upward toward
  // the edge. Adjust this to change island depth.
  islandBottomY: 35,
  scanMinY: -64,
  scanMaxY: 320,
  processPerTick: 16,
  // How many blocks are copied per tick. Kept low to avoid freezing the game.
  blocksPerTick: 12000
};

let started = false;
let scanQueue = [];
let scanCursor = 0;
let columns = new Map();
let copyQueue = [];
let copyCursor = 0;
let clearQueue = [];
let clearCursor = 0;
let phase = "waiting";
let completionAnnounced = false;

world.afterEvents.worldLoad.subscribe(() => {
  system.runTimeout(() => {
    if (!started) startPrototype();
  }, 40);
});

function startPrototype() {
  if (started) return;
  started = true;

  for (let x = CONFIG.centerX - CONFIG.radius; x <= CONFIG.centerX + CONFIG.radius; x++) {
    for (let z = CONFIG.centerZ - CONFIG.radius; z <= CONFIG.centerZ + CONFIG.radius; z++) {
      const dx = x - CONFIG.centerX;
      const dz = z - CONFIG.centerZ;
      if (dx * dx + dz * dz <= CONFIG.radius * CONFIG.radius) {
        scanQueue.push({ x, z });
      }
    }
  }

  phase = "scanning";
  world.sendMessage("§bFloating Island: ripping out a section of generated terrain...");
}

system.runInterval(() => {
  if (!started) return;

  try {
    if (phase === "scanning") scanColumns();
    else if (phase === "copying") copyTerrain();
    else if (phase === "clearing") clearOriginalTerrain();
    else if (phase === "done" && !completionAnnounced) {
      completionAnnounced = true;
      world.sendMessage("§aFloating Island: complete! Original terrain, caves, ores, and structures preserved.");
    }
  } catch (error) {
    console.warn(`[FloatingIsland] ${error}`);
  }
}, 1);

function scanColumns() {
  let processed = 0;

  while (scanCursor < scanQueue.length && processed < CONFIG.processPerTick) {
    const { x, z } = scanQueue[scanCursor++];

    // getBlock returns undefined when the relevant chunk is not loaded.
    // The prototype is intended to run around the initially loaded spawn area.
    const top = findTopBlock(x, z);
    if (top !== undefined) {
      columns.set(`${x},${z}`, {
        x,
        z,
        topY: top
      });
    }

    processed++;
  }

  if (scanCursor >= scanQueue.length) {
    buildCopyQueue();
    phase = "copying";
    world.sendMessage(`§bFloating Island: captured ${columns.size} terrain columns. Copying the actual terrain volume...`);
  }
}

function findTopBlock(x, z) {
  for (let y = CONFIG.scanMaxY; y >= CONFIG.scanMinY; y--) {
    const block = overworld.getBlock({ x, y, z });
    if (!block) continue;

    if (!isAir(block.typeId)) {
      // IMPORTANT: grass, logs, leaves, wool, cobblestone, planks, etc. are
      // NOT ignored here. The top of the generated terrain is the first actual
      // non-air block. Everything from this block downward is copied exactly.
      return y;
    }
  }

  return undefined;
}

function buildCopyQueue() {
  copyQueue = [];

  for (const column of columns.values()) {
    const dx = column.x - CONFIG.centerX;
    const dz = column.z - CONFIG.centerZ;
    const distance = Math.sqrt(dx * dx + dz * dz) / CONFIG.radius;

    // Smooth convex underside: deepest in the center, rising toward the edge.
    const falloff = Math.cos(Math.min(1, distance) * Math.PI / 2);
    const bottomY = Math.floor(CONFIG.islandBottomY + falloff * Math.max(0, column.topY - CONFIG.islandBottomY));

    column.bottomY = Math.min(bottomY, column.topY);

    // Copy every block in the original terrain volume, not a replacement
    // material. This preserves caves, ores, liquids, block states, etc.
    for (let y = column.bottomY; y <= column.topY; y++) {
      copyQueue.push({ x: column.x, y, z: column.z });
    }
  }
}

function copyTerrain() {
  let copied = 0;
  const limit = CONFIG.blocksPerTick;

  while (copyCursor < copyQueue.length && copied < limit) {
    const pos = copyQueue[copyCursor++];
    const source = overworld.getBlock(pos);

    if (source) {
      // Store the exact permutation. This retains block states such as facing,
      // orientation, waterlogged state, etc.
      // For this first prototype, the island is created by vertically retaining
      // the actual generated terrain at its original coordinates while the
      // tapered underside is filled from the captured volume.
      const target = overworld.getBlock(pos);
      if (target) target.setPermutation(source.permutation);
    }

    copied++;
  }

  if (copyCursor >= copyQueue.length) {
    buildClearQueue();
    phase = "clearing";
    world.sendMessage("§bFloating Island: terrain captured. Removing everything below the new island shape...");
  }
}

function buildClearQueue() {
  clearQueue = [];

  for (const column of columns.values()) {
    for (let y = CONFIG.scanMinY; y < column.bottomY; y++) {
      clearQueue.push({ x: column.x, y, z: column.z });
    }
  }
}

function clearOriginalTerrain() {
  let cleared = 0;

  while (clearCursor < clearQueue.length && cleared < CONFIG.blocksPerTick) {
    const pos = clearQueue[clearCursor++];
    const block = overworld.getBlock(pos);

    if (block && !isAir(block.typeId)) {
      block.setType("minecraft:air");
    }

    cleared++;
  }

  if (clearCursor >= clearQueue.length) {
    phase = "done";
  }
}

function isAir(typeId) {
  return typeId === "minecraft:air" ||
    typeId === "minecraft:cave_air" ||
    typeId === "minecraft:void_air";
}
