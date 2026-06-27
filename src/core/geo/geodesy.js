/** WGS84 semi-major axis, in metres. */
export const EARTH_RADIUS = 6378137;

const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * Great-circle distance between two lat/lon points, in metres.
 * @param {{lat:number, lon:number}} a
 * @param {{lat:number, lon:number}} b
 * @returns {number}
 */
export function haversine(a, b) {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(h)));
}
