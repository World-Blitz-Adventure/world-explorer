import * as THREE from 'three';

/**
 * A self-contained grayscale ground-detail texture (no asset files). Tiled over
 * the terrain and multiplied by the biome vertex color, it gives the ground
 * grain and variation instead of a flat fill.
 */
export function createGroundTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Fine grain: per-pixel brightness in a gentle range so it modulates softly.
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = Math.floor((0.74 + Math.random() * 0.26) * 255);
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  // Soft blotches for larger-scale variation (patches, not just noise).
  for (let k = 0; k < 70; k++) {
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = Math.random() > 0.5 ? '#000' : '#fff';
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, 8 + Math.random() * 26, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}
