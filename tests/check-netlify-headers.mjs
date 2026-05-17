import { readFileSync } from 'node:fs';

const content = readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8');

const required = [
  'Content-Security-Policy',
  "default-src 'self'",
  "style-src 'self' https://cdnjs.cloudflare.com https://fonts.googleapis.com 'unsafe-inline'",
  "font-src 'self' https://cdnjs.cloudflare.com https://fonts.gstatic.com",
  "img-src 'self' data:",
  "script-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  'X-Content-Type-Options = "nosniff"',
  'Referrer-Policy = "strict-origin-when-cross-origin"'
];

const missing = required.filter((snippet) => !content.includes(snippet));

if (missing.length) {
  console.error(`Missing expected Netlify header config:\n${missing.join('\n')}`);
  process.exit(1);
}
