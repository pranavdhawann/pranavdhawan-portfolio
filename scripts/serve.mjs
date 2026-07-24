// Minimal dependency-free static server for the built site in public/.
// Used for local preview: `npm run dev` builds then serves this.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'public');
const port = Number(process.env.PORT) || 4321;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

async function resolve(urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel.endsWith('/')) rel += 'index.html';
  let filePath = path.join(root, rel);
  if (!filePath.startsWith(root)) return null; // path traversal guard
  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = path.join(filePath, 'index.html');
    await stat(filePath);
    return filePath;
  } catch {
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  const filePath = await resolve(req.url);
  if (!filePath) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('404 Not Found');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(filePath)] || 'application/octet-stream' });
  createReadStream(filePath).pipe(res);
});

server.listen(port, () => console.log(`Serving public/ at http://localhost:${port}`));
