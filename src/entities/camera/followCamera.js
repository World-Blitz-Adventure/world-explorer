// Chase-camera rigs per mode: how far back, how high, how far ahead it looks,
// how high the look point sits, and how fast it catches up (lambda; lower = more glide).
const RIG = {
  WALKING: { back: 11, height: 5, ahead: 10, lookUp: 3, lambda: 6 },
  RUNNING: { back: 13, height: 5.5, ahead: 12, lookUp: 3, lambda: 6 },
  DRIVING: { back: 26, height: 9, ahead: 22, lookUp: 4, lambda: 3.5 },
};

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Smooth third-person chase camera. Orbits behind the target by yaw (mouse X)
 * and pitch (mouse Y): drag up to look toward the horizon, down toward your feet.
 * Glides toward the desired pose so motion reads and the sky stays in frame.
 */
export function createFollowCamera(camera) {
  let pos = null;
  let look = null;

  return {
    update({ target, headingRad, mode, groundY, orbit = 0, pitch = 0.3, dt = 0.016 }) {
      const a = headingRad + orbit;
      const fx = Math.sin(a);
      const fz = -Math.cos(a);
      const rig = RIG[mode] || RIG.WALKING;
      const baseY = Math.max(groundY, target.y);
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);

      // Camera orbits the target; higher pitch lifts it (look down), lower pitch
      // drops it behind (look up past the target toward the horizon).
      const dPos = {
        x: target.x - fx * rig.back * cosP,
        y: Math.max(baseY + 2, baseY + rig.height + rig.back * sinP),
        z: target.z - fz * rig.back * cosP,
      };
      const dLook = {
        x: target.x + fx * rig.ahead * cosP,
        y: target.y + rig.lookUp,
        z: target.z + fz * rig.ahead * cosP,
      };

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
