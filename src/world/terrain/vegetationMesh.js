import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BROWN = 0x6b4a2f;
const TRUNK_PALM = 0x7a5a3a;
const GREEN = 0x2f5d34;
const GREEN2 = 0x356b3a;
const DARKGREEN = 0x244a28;
const OLIVE = 0x6b7a3a;
const PALMG = 0x3f7d3a;
const CACT = 0x4a7a4a;

// Build a clean non-indexed part with exactly position + normal + color, so all
// parts have identical attributes and mergeGeometries always succeeds.
function colored(geo, color) {
  const src = geo.index ? geo.toNonIndexed() : geo;
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', src.attributes.position.clone());
  out.setAttribute('normal', src.attributes.normal.clone());
  const c = new THREE.Color(color);
  const n = src.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  out.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return out;
}
function trunk(rTop, rBot, h, color) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, 6);
  g.translate(0, h / 2, 0);
  return colored(g, color);
}
function cone(r, h, y, color, seg = 7) {
  const g = new THREE.ConeGeometry(r, h, seg);
  g.translate(0, y, 0);
  return colored(g, color);
}
function blob(r, y, color) {
  const g = new THREE.IcosahedronGeometry(r, 0);
  g.translate(0, y, 0);
  return colored(g, color);
}

function buildConifer() {
  return mergeGeometries([
    trunk(0.18, 0.3, 2, BROWN),
    cone(1.5, 2.4, 2.4, DARKGREEN),
    cone(1.1, 1.9, 3.7, DARKGREEN),
    cone(0.7, 1.5, 4.9, DARKGREEN),
  ]);
}
function buildBroadleaf() {
  return mergeGeometries([
    trunk(0.22, 0.34, 2.4, BROWN),
    blob(1.7, 3.3, GREEN),
    blob(1.2, 4.2, GREEN2),
    blob(1.3, 3.5, GREEN2),
  ]);
}
function buildPalm() {
  const parts = [trunk(0.2, 0.3, 5.5, TRUNK_PALM)];
  for (let i = 0; i < 6; i++) {
    const f = new THREE.ConeGeometry(0.35, 3.2, 4);
    f.translate(0, 1.6, 0);
    f.rotateZ(0.95);
    f.rotateY((i * Math.PI) / 3);
    f.translate(0, 5.3, 0);
    parts.push(colored(f, PALMG));
  }
  return mergeGeometries(parts);
}
function buildAcacia() {
  const canopy = new THREE.ConeGeometry(3.2, 1.1, 9);
  canopy.translate(0, 3.4, 0);
  return mergeGeometries([trunk(0.22, 0.4, 2.8, BROWN), colored(canopy, OLIVE)]);
}
function buildCactus() {
  const arm = new THREE.CylinderGeometry(0.18, 0.2, 1.0, 6);
  arm.translate(0, 0.5, 0);
  arm.rotateZ(0.6);
  arm.translate(0.5, 1.6, 0);
  return mergeGeometries([trunk(0.45, 0.55, 2.4, CACT), colored(arm, CACT)]);
}

const GEO = {
  conifer: buildConifer(),
  broadleaf: buildBroadleaf(),
  palm: buildPalm(),
  acacia: buildAcacia(),
  cactus: buildCactus(),
};
const MAT = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _y = new THREE.Vector3(0, 1, 0);
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

function instanced(geo, items) {
  const inst = new THREE.InstancedMesh(geo, MAT, items.length);
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    _p.set(it.x, it.y, it.z);
    _q.setFromAxisAngle(_y, it.rotY);
    _s.set(it.scale, it.scale, it.scale);
    _m.compose(_p, _q, _s);
    inst.setMatrixAt(i, _m);
  }
  inst.instanceMatrix.needsUpdate = true;
  inst.frustumCulled = false;
  inst.castShadow = true;
  return inst;
}

/** Build a group of instanced trees from a biome-driven vegetation list. */
export function createVegetationGroup(list) {
  const group = new THREE.Group();
  for (const sp of Object.keys(GEO)) {
    const items = list.filter((v) => v.species === sp);
    if (items.length) group.add(instanced(GEO[sp], items));
  }
  return group;
}

export function disposeVegetationGroup(group) {
  group.children.forEach((inst) => inst.dispose());
}
