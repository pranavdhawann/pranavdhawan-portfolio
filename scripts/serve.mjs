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

const BAD_REQUEST = Symbol('bad-request');

async function resolve(urlPath) {
  let rel;
  try {
    // decodeURIComponent throws on malformed input (e.g. GET /%); that used to
    // escape as an unhandled rejection and kill the whole dev server.
    rel = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return BAD_REQUEST;
  }
  if (rel.endsWith('/')) rel += 'index.html';
  let filePath = path.join(root, rel);
  // Compare against root + separator: a bare startsWith(root) also accepts a
  // sibling directory whose name merely begins with "public" (publicsecret/),
  // which is outside the publish directory.
  if (filePath !== root && !filePath.startsWith(root + path.sep)) return BAD_REQUEST;
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
  // A static host answers only reads. Without this the dev server returned 200
  // to a form POST, so local form testing "succeeded" against nothing.
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'content-type': 'text/plain', allow: 'GET, HEAD' });
    res.end('405 Method Not Allowed');
    return;
  }

  const filePath = await resolve(req.url);
  if (filePath === BAD_REQUEST) {
    res.writeHead(400, { 'content-type': 'text/plain' });
    res.end('Bad Request');
    return;
  }
  if (!filePath) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('404 Not Found');
    return;
  }

  const type = TYPES[path.extname(filePath)] || 'application/octet-stream';
  if (req.method === 'HEAD') {
    res.writeHead(200, { 'content-type': type });
    res.end();
    return;
  }
  res.writeHead(200, { 'content-type': type });
  createReadStream(filePath).pipe(res);
});

// Bind loopback by default; HOST=0.0.0.0 opts into LAN access explicitly.
const host = process.env.HOST || '127.0.0.1';
server.listen(port, host, () => console.log(`Serving public/ at http://${host}:${port}/`));
