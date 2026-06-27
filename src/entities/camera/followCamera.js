const RIG = {
  WALKING: { back: 8, height: 4, look: 2 },
  RUNNING: { back: 9, height: 4.5, look: 2 },
  DRIVING: { back: 16, height: 7, look: 2.5 },
};

/** Third-person follow camera, parameters per locomotion mode. */
export function createFollowCamera(camera) {
  return {
    update({ target, headingRad, mode, groundY, orbit = 0 }) {
      const a = headingRad + orbit;
      const fx = Math.sin(a);
      const fz = -Math.cos(a);
      const rig = RIG[mode] || RIG.WALKING;
      const y = Math.max(groundY, target.y) + rig.height;
      camera.position.set(target.x - fx * rig.back, y, target.z - fz * rig.back);
      camera.lookAt(target.x + fx * rig.look, target.y + rig.look, target.z + fz * rig.look);
    },
  };
}
