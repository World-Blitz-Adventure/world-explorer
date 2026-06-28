import { createServer } from 'http';
import { biomeTile } from './worldcover.mjs';
import { roadsTile } from './osm.mjs';

const PORT = process.env.PORT || 8787;

createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.url === '/health') {
    res.end('ok');
    return;
  }

  const mBiome = req.url.match(/^\/biome\/(\d+)\/(\d+)\/(\d+)/);
  const mRoads = req.url.match(/^\/roads\/(\d+)\/(\d+)\/(\d+)/);
  if (!mBiome && !mRoads) {
    res.statusCode = 404;
    res.end('not found');
    return;
  }

  try {
    const m = mBiome || mRoads;
    const data = mBiome
      ? await biomeTile(Number(m[1]), Number(m[2]), Number(m[3]))
      : await roadsTile(Number(m[1]), Number(m[2]), Number(m[3]));
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  } catch (err) {
    res.statusCode = 500;
    res.end('error: ' + err.message);
  }
}).listen(PORT, () => console.log(`world-explorer biome server on :${PORT}`));
