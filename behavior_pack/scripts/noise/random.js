export function hash32(value) {
  let x = value | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return (x ^ (x >>> 16)) | 0;
}

export function hash2D(x, z, seed = 0) {
  return hash32(hash32(x + seed) ^ hash32(z - seed));
}

export function hash3D(x, y, z, seed = 0) {
  return hash32(hash32(x + seed) ^ hash32(y * 374761393) ^ hash32(z - seed));
}

export function random01(value) {
  return (value >>> 0) / 4294967296;
}

export function random2D(x, z, seed = 0) {
  return random01(hash2D(x, z, seed));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function valueNoise2D(x, z, seed = 0) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = smoothstep(x - x0);
  const tz = smoothstep(z - z0);
  const a = random2D(x0, z0, seed);
  const b = random2D(x0 + 1, z0, seed);
  const c = random2D(x0, z0 + 1, seed);
  const d = random2D(x0 + 1, z0 + 1, seed);
  return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
}

export function fractalNoise2D(x, z, seed = 0, octaves = 4) {
  let amplitude = 0.5;
  let frequency = 1;
  let total = 0;
  let weight = 0;
  for (let i = 0; i < octaves; i++) {
    total += valueNoise2D(x * frequency, z * frequency, seed + i * 1013) * amplitude;
    weight += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return total / weight;
}

export function fractalNoise3D(x, y, z, seed = 0, octaves = 3) {
  let total = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let weight = 0;
  for (let i = 0; i < octaves; i++) {
    const n = random01(hash3D(
      Math.floor(x * frequency),
      Math.floor(y * frequency),
      Math.floor(z * frequency),
      seed + i * 977
    ));
    total += n * amplitude;
    weight += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return total / weight;
}
