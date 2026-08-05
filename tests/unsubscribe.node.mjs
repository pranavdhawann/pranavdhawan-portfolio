import assert from 'node:assert/strict';
import { test } from 'node:test';

import { unsubscribeToken, verifyUnsubscribeToken } from '../netlify/functions/lib/unsubscribe-token.mjs';
import { stores } from '../netlify/functions/lib/stores.mjs';
import { SUPPRESSION_STORE } from '../netlify/functions/lib/unsubscribe-store.mjs';
import { CONFIRMED_STORE } from '../netlify/functions/lib/confirm-store.mjs';

const SECRET = 'test-secret';
process.env.UNSUBSCRIBE_SECRET = SECRET;
const { default: handler } = await import('../netlify/functions/unsubscribe.mjs');

// In-memory doubles: unit tests run outside the Netlify runtime, where
// getStore() throws for lack of a site ID and token.
const written = new Map();
const deleted = [];
stores.get = async (name) => ({
  set: async (key, value) => { written.set(`${name}:${key}`, value); },
  delete: async (key) => { deleted.push(`${name}:${key}`); },
});

const linkFor = (email) =>
  `https://pranavdhawan.com/.netlify/functions/unsubscribe?e=${encodeURIComponent(email)}&t=${encodeURIComponent(unsubscribeToken(email, SECRET))}`;

const oneClickPost = (email) => new Request(linkFor(email), {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: 'List-Unsubscribe=One-Click',
});

test('tokens verify only for the matching email and secret', () => {
  const token = unsubscribeToken('a@example.com', SECRET);
  assert.ok(verifyUnsubscribeToken('a@example.com', token, SECRET));
  assert.ok(verifyUnsubscribeToken('A@Example.com', token, SECRET), 'case-insensitive on the address');
  assert.ok(!verifyUnsubscribeToken('b@example.com', token, SECRET), 'wrong email rejected');
  assert.ok(!verifyUnsubscribeToken('a@example.com', token, 'other-secret'), 'wrong secret rejected');
  assert.ok(!verifyUnsubscribeToken('a@example.com', '', SECRET), 'empty token rejected');
});

// Mail scanners and prefetchers follow every link in an email. A GET that
// applied the opt-out unsubscribed people who never clicked anything.
test('GET only offers a confirm button and does not suppress anything', async () => {
  written.clear();
  const res = await handler(new Request(linkFor('get@example.com')));
  const body = await res.text();

  assert.equal(res.status, 200);
  assert.match(body, /<form method="POST"/, 'should ask for an explicit POST');
  assert.equal(written.size, 0, 'GET must not write to the suppression store');
});

test('GET with a tampered token is rejected', async () => {
  const res = await handler(new Request('https://pranavdhawan.com/.netlify/functions/unsubscribe?e=a@example.com&t=nope'));
  assert.equal(res.status, 400);
});

test('POST one-click with a valid token suppresses the address', async () => {
  written.clear();
  deleted.length = 0;
  const res = await handler(oneClickPost('a@example.com'));

  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'Unsubscribed');
  assert.ok(written.has(`${SUPPRESSION_STORE}:a@example.com`), 'address lands on the suppression list');
  // A later re-subscribe has to be confirmed again rather than reusing consent.
  assert.ok(deleted.includes(`${CONFIRMED_STORE}:a@example.com`), 'opt-in record is cleared');
});

test('POST from the browser confirm form gets a readable page', async () => {
  const res = await handler(new Request(linkFor('b@example.com'), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: '',
  }));

  assert.equal(res.status, 200);
  assert.match(await res.text(), /<h1>You are unsubscribed<\/h1>/);
});

// Reporting success on a failed write leaves someone believing they opted out
// while the mail keeps arriving, with no reason to try again.
test('a suppression-store failure is surfaced, not swallowed', async () => {
  const working = stores.get;
  stores.get = async () => { throw new Error('Blobs unavailable'); };

  try {
    const res = await handler(oneClickPost('c@example.com'));
    assert.equal(res.status, 503);
  } finally {
    stores.get = working;
  }
});
