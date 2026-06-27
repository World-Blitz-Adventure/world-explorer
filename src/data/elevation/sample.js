/**
 * Bilinearly sample a row-major height field at continuous grid coords.
 * @param {Float32Array} heightmap length size·size
 * @param {number} size grid width/height
 * @param {number} gx column in [0, size-1] (clamped)
 * @param {number} gy row in [0, size-1] (clamped)
 * @returns {number}
 */
export function bilinearSample(heightmap, size, gx, gy) {
  const cx = Math.max(0, Math.min(size - 1, gx));
  const cy = Math.max(0, Math.min(size - 1, gy));
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(size - 1, x0 + 1);
  const y1 = Math.min(size - 1, y0 + 1);
  const tx = cx - x0;
  const ty = cy - y0;
  const h00 = heightmap[y0 * size + x0];
  const h10 = heightmap[y0 * size + x1];
  const h01 = heightmap[y1 * size + x0];
  const h11 = heightmap[y1 * size + x1];
  const top = h00 + (h10 - h00) * tx;
  const bot = h01 + (h11 - h01) * tx;
  return top + (bot - top) * ty;
}
