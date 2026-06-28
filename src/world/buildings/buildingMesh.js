import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeProjection } from '../../core/geo/projection.js';

const PALETTE = [0xb7ad9f, 0xa8a29a, 0x9fa6ad, 0xc2b8a8, 0x8f9aa0, 0xb0a496];
const buildingMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

const hash = (n) => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * Extrude real OSM building footprints to their height, based on the terrain
 * elevation. Tile-local metres from `anchor`; positioned in world space by the
 * caller, like terrain. Returns a single merged mesh (or null if none).
 */
export function buildBuildingGroup(buildings, anchor, elevation) {
  const proj = makeProjection(anchor);
  const geos = [];

  buildings.forEach((b, idx) => {
    if (b.pts.length < 4) return;
    let clat = 0;
    let clon = 0;
    for (const [la, lo] of b.pts) {
      clat += la;
      clon += lo;
    }
    clat /= b.pts.length;
    clon /= b.pts.length;
    const base = elevation.heightAtCached(clat, clon);
    if (base == null) return;

    const shape = new THREE.Shape();
    b.pts.forEach(([la, lo], i) => {
      const w = proj.toWorld({ lat: la, lon: lo });
      if (i === 0) shape.moveTo(w.east, w.north);
      else shape.lineTo(w.east, w.north);
    });

    let g;
    try {
      g = new THREE.ExtrudeGeometry(shape, { depth: b.height, bevelEnabled: false, steps: 1 });
    } catch {
      return; // degenerate footprint
    }
    g.rotateX(-Math.PI / 2); // extrude up (Y), keep x=east, z=-north
    g.translate(0, base, 0);
    g.deleteAttribute('uv');

    const src = g.index ? g.toNonIndexed() : g;
    const col = new THREE.Color(PALETTE[Math.floor(hash(idx + 0.5) * PALETTE.length)]);
    const n = src.attributes.position.count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    src.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geos.push(src);
  });

  if (!geos.length) return null;
  const mesh = new THREE.Mesh(mergeGeometries(geos), buildingMat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function disposeBuildingMesh(mesh) {
  mesh.geometry.dispose();
}
