// Latitude limit of the Web Mercator projection.
const MAX_LAT = 85.05112878;

/**
 * Tile index plus in-tile fraction for a lat/lon at zoom z.
 * @returns {{x:number, y:number, fx:number, fy:number}}
 */
export function tileFraction(lat, lon, z) {
  const clampedLat = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const latRad = (clampedLat * Math.PI) / 180;
  const n = 2 ** z;
  const xf = ((lon + 180) / 360) * n;
  const yf =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const x = Math.floor(xf);
  const y = Math.floor(yf);
  return { x, y, fx: xf - x, fy: yf - y };
}

/**
 * Floored tile index for a lat/lon at zoom z.
 * @returns {{x:number, y:number}}
 */
export function tileForLonLat(lat, lon, z) {
  const { x, y } = tileFraction(lat, lon, z);
  return { x, y };
}

/**
 * The NW (top-left) corner of tile x/y at zoom z.
 * @returns {{lat:number, lon:number}}
 */
export function lonLatForTile(x, y, z) {
  const n = 2 ** z;
  const lon = (x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const lat = (latRad * 180) / Math.PI;
  return { lat, lon };
}
