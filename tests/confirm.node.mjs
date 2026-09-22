import assert from 'node:assert/strict';
import { test } from 'node:test';

import { confirmToken, verifyConfirmToken } from '../netlify/functions/lib/confirm-token.mjs';
import { unsubscribeToken } from '../netlify/functions/lib/unsubscribe-token.mjs';
import { stores } from '../netlify/functions/lib/stores.mjs';
import { CONFIRMED_STORE } from '../netlify/functions/lib/confirm-store.mjs';
import { SUPPRESSION_STORE } from '../netlify/functions/lib/unsubscribe-store.mjs';
import { confirmUrlFor, buildConfirmEmail } from '../netlify/functions/submission-created.mjs';

const SECRET = 'test-secret';
process.env.UNSUBSCRIBE_SECRET = SECRET;
const { default: handler } = await import('../netlify/functions/confirm.mjs');

const written = new Map();
const deleted = [];
stores.get = async (name) => ({
  set: async (key, value) => { written.set(`${name}:${key}`, value); },
  delete: async (key) => { deleted.push(`${name}:${key}`); },
});

const linkFor = (email) =>
  `https://pranavdhawan.com/.netlify/functions/confirm?e=${encodeURIComponent(email)}&t=${encodeURIComponent(confirmToken(email, SECRET))}`;

test('confirm tokens verify only for the matching email and secret', () => {
  const token = confirmToken('a@example.com', SECRET);
  assert.ok(verifyConfirmToken('a@example.com', token, SECRET));
  assert.ok(verifyConfirmToken('A@Example.com', token, SECRET), 'case-insensitive on the address');
  assert.ok(!verifyConfirmToken('b@example.com', token, SECRET), 'wrong email rejected');
  assert.ok(!verifyConfirmToken('a@example.com', token, 'other-secret'), 'wrong secret rejected');
});

// The two token spaces must not overlap, or a confirmation link mailed to a
// subscriber would double as a valid unsubscribe for the same address.
test('confirm and unsubscribe tokens are not interchangeable', () => {
  const email = 'a@example.com';
  assert.notEqual(confirmToken(email, SECRET), unsubscribeToken(email, SECRET));
  assert.ok(!verifyConfirmToken(email, unsubscribeToken(email, SECRET), SECRET));
});

test('GET only offers a confirm button and records nothing', async () => {
  written.clear();
  const res = await handler(new Request(linkFor('get@example.com')));

  assert.equal(res.status, 200);
  assert.match(await res.text(), /<form method="POST"/);
  assert.equal(written.size, 0, 'a prefetching scanner must not create consent');
});

test('POST records the opt-in', async () => {
  written.clear();
  const res = await handler(new Request(linkFor('yes@example.com'), { method: 'POST' }));

  assert.equal(res.status, 200);
  assert.match(await res.text(), /You&#39;re subscribed|You're subscribed/);
  assert.ok(written.has(`${CONFIRMED_STORE}:yes@example.com`));
});

test('a tampered confirmation token is rejected', async () => {
  const res = await handler(new Request(
    'https://pranavdhawan.com/.netlify/functions/confirm?e=a@example.com&t=nope',
    { method: 'POST' }
  ));
  assert.equal(res.status, 400);
});

// Links expire: a forwarded or leaked confirmation link must not stay a
// consent capability forever.
test('an expired confirmation token is rejected', () => {
  const stale = Date.now() - 8 * 86400000;
  const token = confirmToken('old@example.com', SECRET, stale);
  assert.ok(!verifyConfirmToken('old@example.com', token, SECRET));
});

test('pre-expiry tokens still verify (boundary)', () => {
  const almost = Date.now() - 6 * 86400000;
  assert.ok(verifyConfirmToken('fresh@example.com', confirmToken('fresh@example.com', SECRET, almost), SECRET));
});

// Legacy format (bare HMAC, no timestamp) must not verify against v2.
test('legacy timestamp-less tokens are rejected', async () => {
  const { createHmac } = await import('node:crypto');
  const legacy = createHmac('sha256', SECRET).update(`confirm:a@example.com`).digest('base64url');
  assert.ok(!verifyConfirmToken('a@example.com', legacy, SECRET));
});

// A fresh POST is new consent: any suppression entry left by an earlier
// unsubscribe has to be cleared, or the sender would keep skipping the
// address it just told "You're subscribed".
test('POST clears a stale suppression entry', async () => {
  written.clear();
  deleted.length = 0;
  const res = await handler(new Request(linkFor('back@example.com'), { method: 'POST' }));

  assert.equal(res.status, 200);
  assert.ok(written.has(`${CONFIRMED_STORE}:back@example.com`));
  assert.ok(deleted.includes(`${SUPPRESSION_STORE}:back@example.com`), 'stale opt-out removed on re-consent');
});

test('a store failure tells the subscriber instead of claiming success', async () => {
  const working = stores.get;
  stores.get = async () => { throw new Error('Blobs unavailable'); };

  try {
    const res = await handler(new Request(linkFor('d@example.com'), { method: 'POST' }));
    assert.equal(res.status, 503);
    assert.match(await res.text(), /not recorded/i);
  } finally {
    stores.get = working;
  }
});

test('the confirmation email carries a signed, per-recipient link', () => {
  const url = confirmUrlFor('a@example.com', SECRET);
  assert.match(url, /\/\.netlify\/functions\/confirm\?e=a%40example\.com&t=/);
  assert.notEqual(confirmUrlFor('b@example.com', SECRET), url, 'links must be per-recipient');

  const { text, html } = buildConfirmEmail(url);
  assert.ok(text.includes(url), 'plain-text part carries the link');
  // The URL is entity-escaped into the href (& → &amp;) — correct HTML.
  assert.ok(html.includes(url.replaceAll('&', '&amp;')), 'html part carries the link');
  assert.match(text, /ignore this email/i, 'tells a mis-typed recipient they need do nothing');
});
