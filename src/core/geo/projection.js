import { EARTH_RADIUS } from './geodesy.js';

const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

/**
 * Build a local ENU tangent-plane projection anchored at `origin`.
 * `toWorld` returns metres east/north of the origin; `toLatLon` inverts it.
 * @param {{lat:number, lon:number}} origin
 */
export function makeProjection(origin) {
  const cosLat0 = Math.cos(toRad(origin.lat));
  return {
    origin,
    toWorld(p) {
      return {
        east: toRad(p.lon - origin.lon) * cosLat0 * EARTH_RADIUS,
        north: toRad(p.lat - origin.lat) * EARTH_RADIUS,
      };
    },
    toLatLon(east, north) {
      return {
        lat: origin.lat + toDeg(north / EARTH_RADIUS),
        lon: origin.lon + toDeg(east / (EARTH_RADIUS * cosLat0)),
      };
    },
  };
}
