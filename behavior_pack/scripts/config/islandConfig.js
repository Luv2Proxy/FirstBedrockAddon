export const ISLAND_ARCHETYPES = [
  { id: "classic", weight: 45, minRadius: 18, maxRadius: 110 },
  { id: "bowl", weight: 20, minRadius: 24, maxRadius: 100 },
  { id: "crescent", weight: 15, minRadius: 28, maxRadius: 95 },
  { id: "terrace", weight: 15, minRadius: 24, maxRadius: 105 },
  { id: "mountain", weight: 5, minRadius: 35, maxRadius: 130 }
];

export const ISLAND_CONFIG = {
  clusterChance: 0.68,
  maxIslandsPerCluster: 12,
  minClusterRadius: 80,
  maxClusterRadius: 420,
  maxIslandDepth: 80,
  surfaceThickness: 8,
  caveThreshold: 0.58,
  caveScale: 0.045,
  terrainScale: 0.025,
  detailScale: 0.09
};
