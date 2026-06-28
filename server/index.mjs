import { createServer } from 'http';
import { biomeTile } from './worldcover.mjs';

const PORT = process.env.PORT || 8787;

createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.url === '/health') {
    res.end('ok');
    return;
  }

  const m = req.url.match(/^\/biome\/(\d+)\/(\d+)\/(\d+)/);
  if (!m) {
    res.statusCode = 404;
    res.end('not found');
    return;
  }

  try {
    const tile = await biomeTile(Number(m[1]), Number(m[2]), Number(m[3]));
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(tile));
  } catch (err) {
    res.statusCode = 500;
    res.end('error: ' + err.message);
  }
}).listen(PORT, () => console.log(`world-explorer biome server on :${PORT}`));
