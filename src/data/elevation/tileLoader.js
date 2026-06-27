/**
 * Browser-only: fetch a Terrarium PNG and decode it to RGBA bytes.
 * @param {string} url
 * @returns {Promise<{size:number, rgba:Uint8ClampedArray}>}
 */
export async function loadTerrariumTile(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`elevation tile ${url} -> HTTP ${res.status}`);
  const bitmap = await createImageBitmap(await res.blob());
  const size = bitmap.width;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  const { data } = ctx.getImageData(0, 0, size, size);
  bitmap.close();
  return { size, rgba: data };
}
