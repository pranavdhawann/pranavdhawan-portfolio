import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler, { config } from '../netlify/functions/csp-report.mjs';

const report = (body, ip) => handler(new Request('http://localhost/.netlify/functions/csp-report', {
  method: 'POST',
  headers: { 'x-nf-client-connection-ip': ip },
  body,
}));

test('accepts a legacy report and logs a bounded directive', async (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const response = await report(JSON.stringify({ 'csp-report': { 'violated-directive': 'x'.repeat(500) } }), '10.0.0.1');
  assert.equal(response.status, 204);
  assert.equal(warn.mock.calls[0].arguments[1].directive.length, 80);
});

test('rejects non-POST and oversized bodies', async () => {
  const get = await handler(new Request('http://localhost/.netlify/functions/csp-report'));
  assert.equal(get.status, 405);
  const big = await report('x'.repeat(17 * 1024), '10.0.0.2');
  assert.equal(big.status, 413);
});

test('is rate limited per IP by the platform config', () => {
  assert.deepEqual(config.rateLimit.aggregateBy, ['ip']);
});
