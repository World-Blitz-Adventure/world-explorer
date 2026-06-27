const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [
  lerp(c1[0], c2[0], t),
  lerp(c1[1], c2[1], t),
  lerp(c1[2], c2[2], t),
];

const WATER = [0.17, 0.36, 0.52];
const SAND = [0.76, 0.7, 0.5];
const GRASS = [0.4, 0.56, 0.3];
const FOREST = [0.26, 0.42, 0.24];
const ROCK = [0.45, 0.42, 0.4];
const SNOW = [0.92, 0.93, 0.95];

/**
 * Stylized low-poly terrain color.
 * @param {number} elevation metres
 * @param {number} slope 0 (flat) .. 1 (steep)
 * @param {number} latitude degrees (snow line drops toward the poles)
 * @returns {[number, number, number]} rgb 0..1
 */
export function biomeColor(elevation, slope, latitude) {
  if (elevation <= 0) return WATER.slice();
  const snowLine = lerp(3200, 200, clamp01(Math.abs(latitude) / 90));
  let base;
  if (elevation < 4) base = SAND.slice();
  else if (elevation < 600) base = mix(GRASS, FOREST, clamp01(elevation / 600));
  else if (elevation < snowLine)
    base = mix(FOREST, ROCK, clamp01((elevation - 600) / Math.max(1, snowLine - 600)));
  else base = SNOW.slice();
  return mix(base, ROCK, clamp01((slope - 0.4) / 0.4));
}
