import { readFileSync } from 'node:fs';
import { readTomlString, parseCsp } from './helpers/toml.cjs';

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
  'img-src': ["'self'", 'data:', 'https://pranavdhawan.goatcounter.com'],
  'script-src': ["'self'", 'https://gc.zgo.at'],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'frame-ancestors': ["'none'"],
  'form-action': ["'self'"],
  'connect-src': ["'self'", 'https://pranavdhawan.goatcounter.com']
};

const problems = [];

for (const [header, expected] of Object.entries(expectedHeaders)) {
  const actual = readTomlString(content, header);
  if (actual !== expected) {
    problems.push(`${header}: expected "${expected}", got "${actual ?? 'missing'}"`);
  }
}

const csp = parseCsp(readTomlString(content, 'Content-Security-Policy') || '');
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
