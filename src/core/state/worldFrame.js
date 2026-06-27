import { makeProjection } from '../geo/projection.js';
import { haversine } from '../geo/geodesy.js';

/** Distance from the current origin past which the world frame rebases. */
export const REBASE_THRESHOLD_M = 8000;

/**
 * A render frame anchored at a moving origin. Geographic truth (lat/lon) never
 * changes; only the local origin shifts, so float32 coordinates stay small.
 * @param {{lat:number, lon:number}} initialOrigin
 */
export function createWorldFrame(initialOrigin) {
  let projection = makeProjection(initialOrigin);

  function toWorld(p) {
    const { east, north } = projection.toWorld(p);
    return { x: east, y: 0, z: -north };
  }

  return {
    get origin() {
      return projection.origin;
    },
    toWorld,
    maybeRebase(player) {
      if (haversine(projection.origin, player) <= REBASE_THRESHOLD_M) {
        return null;
      }
      const playerWorld = toWorld(player); // player position in the OLD frame
      projection = makeProjection(player); // new origin = player
      // Adding this shift to any old-frame position yields its new-frame value.
      return { x: -playerWorld.x, y: 0, z: -playerWorld.z };
    },
  };
}
