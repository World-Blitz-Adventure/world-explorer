/**
 * Square block of tiles of `radius` around a center tile at zoom `z`.
 * Longitude (x) wraps around the world; latitude (y) clamps at the poles.
 * @returns {Array<{x:number, y:number, z:number}>}
 */
export function tilesAround(center, radius, z) {
  const n = 2 ** z;
  const out = [];
  for (let dy = -radius; dy <= radius; dy++) {
    const y = center.y + dy;
    if (y < 0 || y >= n) continue;
    for (let dx = -radius; dx <= radius; dx++) {
      const x = (((center.x + dx) % n) + n) % n;
      out.push({ x, y, z });
    }
  }
  return out;
}
