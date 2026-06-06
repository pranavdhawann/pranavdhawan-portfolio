import { readFileSync } from 'node:fs';

const content = readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8');

const expectedHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

const expectedCsp = {
  'default-src': ["'self'"],
  'style-src': ["'self'", 'https://fonts.googleapis.com'],
  'font-src': ["'self'", 'https://fonts.gstatic.com'],
  'img-src': ["'self'", 'data:'],
  'script-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'frame-ancestors': ["'none'"]
};

function readTomlString(key) {
  const match = content.match(new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=\\s*"([^"]*)"`, 'm'));
  return match ? match[1] : undefined;
}

function parseCsp(policy) {
  return Object.fromEntries(policy.split(';').map((part) => {
    const [directive, ...values] = part.trim().split(/\s+/);
    return [directive, values];
  }));
}

const problems = [];

for (const [header, expected] of Object.entries(expectedHeaders)) {
  const actual = readTomlString(header);
  if (actual !== expected) {
    problems.push(`${header}: expected "${expected}", got "${actual ?? 'missing'}"`);
  }
}

const csp = parseCsp(readTomlString('Content-Security-Policy') || '');
for (const [directive, expected] of Object.entries(expectedCsp)) {
  const actual = csp[directive];
  if (!actual || actual.join(' ') !== expected.join(' ')) {
    problems.push(`CSP ${directive}: expected "${expected.join(' ')}", got "${actual ? actual.join(' ') : 'missing'}"`);
  }
}

const unexpectedCsp = Object.keys(csp).filter((directive) => !expectedCsp[directive]);
if (unexpectedCsp.length) {
  problems.push(`Unexpected CSP directives: ${unexpectedCsp.join(', ')}`);
}

if (problems.length) {
  console.error(`Netlify header config mismatch:\n${problems.join('\n')}`);
  process.exit(1);
}
