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
    rel = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return BAD_REQUEST;
  }
  if (rel.endsWith('/')) rel += 'index.html';
  let filePath = path.join(root, rel);
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

const host = process.env.HOST || '127.0.0.1';
server.listen(port, host, () => console.log(`Serving public/ at http://${host}:${port}/`));
