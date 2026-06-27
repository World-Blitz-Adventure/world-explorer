/** Elevation at or below this (metres) counts as water. */
export const SEA_LEVEL_M = 0;

/**
 * Decode one Terrarium-encoded RGB pixel to elevation in metres.
 * @returns {number}
 */
export function decodeElevation(r, g, b) {
  return r * 256 + g + b / 256 - 32768;
}

/**
 * Decode an RGBA pixel buffer (row-major, `size`×`size`) into a height field.
 * @param {Uint8ClampedArray|Uint8Array} rgba
 * @param {number} size
 * @returns {Float32Array} length size·size
 */
export function decodeHeightmap(rgba, size) {
  const out = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const p = i * 4;
    out[i] = decodeElevation(rgba[p], rgba[p + 1], rgba[p + 2]);
  }
  return out;
}
