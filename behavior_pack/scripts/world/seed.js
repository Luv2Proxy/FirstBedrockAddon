import { world } from "@minecraft/server";

let cachedSeed;

export function getWorldSeed() {
  if (cachedSeed !== undefined) return cachedSeed;
  // Bedrock does not expose a universal numeric seed through every server API
  // version. Keep a stable project seed until a supported world-seed API is
  // available, while allowing an explicit override through the dynamic property.
  const stored = world.getDynamicProperty("sky_archipelago:seed");
  cachedSeed = typeof stored === "number" ? stored : 133742;
  if (typeof stored !== "number") {
    try { world.setDynamicProperty("sky_archipelago:seed", cachedSeed); } catch {}
  }
  return cachedSeed;
}
