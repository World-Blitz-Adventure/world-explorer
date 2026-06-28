import * as THREE from 'three';

function makeCanvas(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

// Grayscale structure textures (hue comes from the biome vertex color). The
// shader blends "flat" (grassy) and "steep" (rocky) by slope.
export function createGroundTextures() {
  const size = 256;

  // Grassy: soft base + many short vertical blade-like streaks.
  const flat = makeCanvas(size, (ctx, s) => {
    const img = ctx.createImageData(s, s);
    for (let i = 0; i < s * s; i++) {
      const v = Math.floor((0.78 + Math.random() * 0.22) * 255);
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    for (let k = 0; k < 1400; k++) {
      ctx.strokeStyle = `rgba(${Math.random() > 0.5 ? '255,255,255' : '0,0,0'},0.06)`;
      ctx.lineWidth = 1;
      const x = Math.random() * s, y = Math.random() * s, h = 3 + Math.random() * 6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 2, y - h);
      ctx.stroke();
    }
  });

  // Rocky: blotchy base + a few darker cracks.
  const steep = makeCanvas(size, (ctx, s) => {
    const img = ctx.createImageData(s, s);
    for (let i = 0; i < s * s; i++) {
      const v = Math.floor((0.62 + Math.random() * 0.24) * 255);
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    for (let k = 0; k < 90; k++) {
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = Math.random() > 0.5 ? '#000' : '#fff';
      ctx.beginPath();
      ctx.arc(Math.random() * s, Math.random() * s, 6 + Math.random() * 22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = '#000';
    for (let k = 0; k < 14; k++) {
      ctx.lineWidth = 0.6 + Math.random();
      ctx.beginPath();
      let x = Math.random() * s, y = Math.random() * s;
      ctx.moveTo(x, y);
      for (let seg = 0; seg < 5; seg++) {
        x += (Math.random() - 0.5) * 40;
        y += (Math.random() - 0.5) * 40;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });

  return { flat, steep };
}
