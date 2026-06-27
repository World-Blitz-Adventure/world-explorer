// Chase-camera rigs per mode: how far back, how high, how far ahead it looks,
// how high the look point sits (so the horizon and sky stay in frame), and how
// fast it catches up (lambda = smoothing rate; lower = more glide/lag).
const RIG = {
  WALKING: { back: 11, height: 6, ahead: 10, lookUp: 4, lambda: 6 },
  RUNNING: { back: 13, height: 6.5, ahead: 12, lookUp: 4, lambda: 6 },
  DRIVING: { back: 26, height: 11, ahead: 22, lookUp: 5, lambda: 3.5 },
};

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Smooth third-person chase camera. Glides toward a position behind/above the
 * target and looks ahead toward the horizon, so motion reads and the sky shows.
 */
export function createFollowCamera(camera) {
  let pos = null;
  let look = null;

  return {
    update({ target, headingRad, mode, groundY, orbit = 0, dt = 0.016 }) {
      const a = headingRad + orbit;
      const fx = Math.sin(a);
      const fz = -Math.cos(a);
      const rig = RIG[mode] || RIG.WALKING;
      const baseY = Math.max(groundY, target.y);

      const dPos = {
        x: target.x - fx * rig.back,
        y: baseY + rig.height,
        z: target.z - fz * rig.back,
      };
      const dLook = {
        x: target.x + fx * rig.ahead,
        y: target.y + rig.lookUp,
        z: target.z + fz * rig.ahead,
      };

      // Frame-rate independent smoothing toward the desired pose.
      const k = 1 - Math.exp(-rig.lambda * dt);
      if (!pos) {
        pos = { ...dPos };
        look = { ...dLook };
      }
      pos.x = lerp(pos.x, dPos.x, k);
      pos.y = lerp(pos.y, dPos.y, k);
      pos.z = lerp(pos.z, dPos.z, k);
      look.x = lerp(look.x, dLook.x, k);
      look.y = lerp(look.y, dLook.y, k);
      look.z = lerp(look.z, dLook.z, k);

      camera.position.set(pos.x, pos.y, pos.z);
      camera.lookAt(look.x, look.y, look.z);
    },

    // Keep the smoothed pose consistent when the world origin rebases.
    shift(s) {
      if (pos) {
        pos.x += s.x;
        pos.z += s.z;
        look.x += s.x;
        look.z += s.z;
      }
    },
  };
}
