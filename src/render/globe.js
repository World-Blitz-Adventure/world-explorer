import * as THREE from 'three';

// lat/lon -> point on a unit sphere (lat0/lon0 sits at +z, facing the camera).
function latLonToVec3(lat, lon) {
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  return new THREE.Vector3(Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo));
}

/** A small stylized globe in the corner with a glowing marker at your position. */
export function createGlobe() {
  const size = 150;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = `position:fixed;right:18px;bottom:18px;width:${size}px;height:${size}px;z-index:10;pointer-events:none;filter:drop-shadow(0 4px 14px rgba(0,0,0,.4))`;
  document.body.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(size, size, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 10);
  camera.position.set(0, 0, 3.2);

  const world = new THREE.Group();
  scene.add(world);

  // ocean sphere
  world.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 24),
      new THREE.MeshBasicMaterial({ color: 0x1c4a6e })
    )
  );
  // graticule (lat/lon lines)
  world.add(
    new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.SphereGeometry(1.002, 16, 12)),
      new THREE.LineBasicMaterial({ color: 0x5aa6cf, transparent: true, opacity: 0.35 })
    )
  );

  // glowing marker, repositioned each frame
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0x6ee7b7 })
  );
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0x6ee7b7, transparent: true, opacity: 0.3 })
  );
  scene.add(marker, halo);

  const _q = new THREE.Quaternion();
  const _z = new THREE.Vector3(0, 0, 1);

  return {
    update(lat, lon) {
      const p = latLonToVec3(lat, lon);
      // spin the world so your location faces the camera (front, +z)
      _q.setFromUnitVectors(p, _z);
      world.quaternion.copy(_q);
      // marker sits at the front of the globe
      marker.position.set(0, 0, 1.04);
      halo.position.copy(marker.position);
      renderer.render(scene, camera);
    },
  };
}
