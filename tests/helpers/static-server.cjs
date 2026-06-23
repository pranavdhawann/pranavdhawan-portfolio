// Minimal static file server used by the Playwright specs. Serves files from the
// repo root with the same security headers configured in netlify.toml, so tests
// exercise the page under realistic headers.
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { readTomlString } = require('./toml.cjs');

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.pdf': 'application/pdf'
};

function readConfiguredHeaders(rootDir) {
  const content = fs.readFileSync(path.join(rootDir, 'netlify.toml'), 'utf8');
  return {
    'Content-Security-Policy': readTomlString(content, 'Content-Security-Policy'),
    'Strict-Transport-Security': readTomlString(content, 'Strict-Transport-Security'),
    'X-Frame-Options': readTomlString(content, 'X-Frame-Options'),
    'X-Content-Type-Options': readTomlString(content, 'X-Content-Type-Options'),
    'Referrer-Policy': readTomlString(content, 'Referrer-Policy'),
    'Permissions-Policy': readTomlString(content, 'Permissions-Policy')
  };
}

async function startStaticServer(rootDir, headers) {
  const server = http.createServer((request, response) => {
    const requestPath = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const relativePath = requestPath === '/' ? 'index.html' : requestPath.slice(1);
    const filePath = path.resolve(rootDir, relativePath);
    const isInRoot = filePath === rootDir || filePath.startsWith(rootDir + path.sep);

    if (!isInRoot || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      response.writeHead(404, headers);
      response.end('Not found');
      return;
    }

    response.writeHead(200, {
      ...headers,
      'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream'
    });
    fs.createReadStream(filePath).pipe(response);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}/` };
}

module.exports = { contentTypes, readConfiguredHeaders, startStaticServer };
