import { fromUrl } from 'geotiff';

// ESA WorldCover 10 m landcover classes.
export const LANDCOVER = {
  10: 'tree',
  20: 'shrub',
  30: 'grass',
  40: 'crop',
  50: 'built',
  60: 'bare',
  70: 'snow',
  80: 'water',
  90: 'wetland',
  95: 'mangrove',
  100: 'moss',
};

// WorldCover COGs are 3°×3°, named by their SW corner (multiple of 3).
function tileName(lat, lon) {
  const tl = Math.floor(lat / 3) * 3;
  const to = Math.floor(lon / 3) * 3;
  const ns = tl >= 0 ? 'N' : 'S';
  const ew = to >= 0 ? 'E' : 'W';
  return `${ns}${String(Math.abs(tl)).padStart(2, '0')}${ew}${String(Math.abs(to)).padStart(3, '0')}`;
}

const imageCache = new Map(); // tileName -> Promise<GeoTIFFImage>
function getImage(lat, lon) {
  const t = tileName(lat, lon);
  if (!imageCache.has(t)) {
    const url = `https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_${t}_Map.tif`;
    imageCache.set(
      t,
      fromUrl(url).then((tiff) => tiff.getImage())
    );
  }
  return imageCache.get(t);
}

// Web-Mercator tile → lat/lon bounding box.
function tileBBox(z, x, y) {
  const n = 2 ** z;
  const lon = (xx) => (xx / n) * 360 - 180;
  const lat = (yy) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * yy) / n))) * 180) / Math.PI;
  return { north: lat(y), south: lat(y + 1), west: lon(x), east: lon(x + 1) };
}

const tileCache = new Map(); // "z/x/y" -> { size, classes }

/** Real landcover grid (N×N WorldCover classes) for a web-mercator tile. */
export async function biomeTile(z, x, y, N = 24) {
  const key = `${z}/${x}/${y}`;
  if (tileCache.has(key)) return tileCache.get(key);

  const bb = tileBBox(z, x, y);
  const img = await getImage((bb.north + bb.south) / 2, (bb.west + bb.east) / 2);
  const [minX, minY, maxX, maxY] = img.getBoundingBox();
  const W = img.getWidth();
  const H = img.getHeight();
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const x0 = clamp(Math.floor(((bb.west - minX) / (maxX - minX)) * W), 0, W - 1);
  const x1 = clamp(Math.ceil(((bb.east - minX) / (maxX - minX)) * W), x0 + 1, W);
  const y0 = clamp(Math.floor(((maxY - bb.north) / (maxY - minY)) * H), 0, H - 1);
  const y1 = clamp(Math.ceil(((maxY - bb.south) / (maxY - minY)) * H), y0 + 1, H);

  const data = await img.readRasters({ window: [x0, y0, x1, y1], width: N, height: N });
  const result = { size: N, classes: Array.from(data[0]) };
  tileCache.set(key, result);
  return result;
}
