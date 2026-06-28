import { createServer } from 'http';
import { biomeTile } from './worldcover.mjs';
import { roadsTile, buildingsTile } from './osm.mjs';
import { place } from './geocode.mjs';

const PORT = process.env.PORT || 8787;

createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.url === '/health') {
    res.end('ok');
    return;
  }

  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/place') {
    try {
      const data = await place(Number(url.searchParams.get('lat')), Number(url.searchParams.get('lon')));
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
    } catch (err) {
      res.statusCode = 500;
      res.end('error: ' + err.message);
    }
    return;
  }

  const mBiome = req.url.match(/^\/biome\/(\d+)\/(\d+)\/(\d+)/);
  const mRoads = req.url.match(/^\/roads\/(\d+)\/(\d+)\/(\d+)/);
  const mBld = req.url.match(/^\/buildings\/(\d+)\/(\d+)\/(\d+)/);
  const m = mBiome || mRoads || mBld;
  if (!m) {
    res.statusCode = 404;
    res.end('not found');
    return;
  }

  try {
    const z = Number(m[1]);
    const x = Number(m[2]);
    const y = Number(m[3]);
    const data = mBiome ? await biomeTile(z, x, y) : mRoads ? await roadsTile(z, x, y) : await buildingsTile(z, x, y);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  } catch (err) {
    res.statusCode = 500;
    res.end('error: ' + err.message);
  }
}).listen(PORT, () => console.log(`world-explorer biome server on :${PORT}`));
