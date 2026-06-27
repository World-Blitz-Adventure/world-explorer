import * as THREE from 'three';

// Shared low-poly geometries/materials (base at y=0, so instances sit on the ground).
const treeGeo = new THREE.ConeGeometry(2.4, 8, 6);
treeGeo.translate(0, 4, 0);
const treeMat = new THREE.MeshLambertMaterial({ color: 0x2f5d34, flatShading: true });

const rockGeo = new THREE.IcosahedronGeometry(1.8, 0);
rockGeo.translate(0, 1.2, 0);
const rockMat = new THREE.MeshLambertMaterial({ color: 0x6b6660, flatShading: true });

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _yAxis = new THREE.Vector3(0, 1, 0);
const _pos = new THREE.Vector3();
const _scl = new THREE.Vector3();

function makeInstanced(geo, mat, items) {
  const inst = new THREE.InstancedMesh(geo, mat, items.length);
  for (let i = 0; i < items.length; i++) {
    const s = items[i];
    _pos.set(s.x, s.y, s.z);
    _q.setFromAxisAngle(_yAxis, s.rotY);
    _scl.set(s.scale, s.scale, s.scale);
    _m.compose(_pos, _q, _scl);
    inst.setMatrixAt(i, _m);
  }
  inst.instanceMatrix.needsUpdate = true;
  inst.frustumCulled = false;
  return inst;
}

/**
 * Build a group of instanced trees/rocks from a tile-local scatter list.
 * Positioned in world space by the caller (like the terrain mesh).
 */
export function createScatterGroup(scatter) {
  const group = new THREE.Group();
  const trees = scatter.filter((s) => s.type === 'tree');
  const rocks = scatter.filter((s) => s.type === 'rock');
  if (trees.length) group.add(makeInstanced(treeGeo, treeMat, trees));
  if (rocks.length) group.add(makeInstanced(rockGeo, rockMat, rocks));
  return group;
}

export function disposeScatterGroup(group) {
  group.children.forEach((inst) => inst.dispose());
}
