import { WORLD_CONFIG } from "../config/worldConfig.js";

export function regionKey(rx, rz) {
  return `${rx},${rz}`;
}

export function worldToRegion(x, z) {
  return {
    x: Math.floor(x / WORLD_CONFIG.regionSize),
    z: Math.floor(z / WORLD_CONFIG.regionSize)
  };
}

export function regionBounds(rx, rz) {
  const size = WORLD_CONFIG.regionSize;
  return {
    minX: rx * size,
    minZ: rz * size,
    maxX: (rx + 1) * size - 1,
    maxZ: (rz + 1) * size - 1
  };
}

export class RegionManager {
  constructor() {
    this.generated = new Set();
    this.pending = new Set();
  }

  isGenerated(rx, rz) {
    return this.generated.has(regionKey(rx, rz));
  }

  markGenerated(rx, rz) {
    const key = regionKey(rx, rz);
    this.pending.delete(key);
    this.generated.add(key);
  }

  request(rx, rz) {
    const key = regionKey(rx, rz);
    if (!this.generated.has(key)) this.pending.add(key);
  }

  getPending() {
    return [...this.pending].map(key => key.split(",").map(Number));
  }
}
