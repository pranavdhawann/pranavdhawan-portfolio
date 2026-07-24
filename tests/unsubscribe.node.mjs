import assert from 'node:assert/strict';
import { test } from 'node:test';

import { unsubscribeToken, verifyUnsubscribeToken } from '../netlify/functions/lib/unsubscribe-token.mjs';

const SECRET = 'test-secret';
process.env.UNSUBSCRIBE_SECRET = SECRET;
const { default: handler } = await import('../netlify/functions/unsubscribe.mjs');

const linkFor = (email) =>
  `https://pranavdhawan.com/.netlify/functions/unsubscribe?e=${encodeURIComponent(email)}&t=${encodeURIComponent(unsubscribeToken(email, SECRET))}`;

test('tokens verify only for the matching email and secret', () => {
  const token = unsubscribeToken('a@example.com', SECRET);
  assert.ok(verifyUnsubscribeToken('a@example.com', token, SECRET));
  assert.ok(verifyUnsubscribeToken('A@Example.com', token, SECRET), 'case-insensitive on the address');
  assert.ok(!verifyUnsubscribeToken('b@example.com', token, SECRET), 'wrong email rejected');
  assert.ok(!verifyUnsubscribeToken('a@example.com', token, 'other-secret'), 'wrong secret rejected');
  assert.ok(!verifyUnsubscribeToken('a@example.com', '', SECRET), 'empty token rejected');
});

test('GET with a valid token confirms the unsubscribe', async () => {
  const res = await handler(new Request(linkFor('a@example.com')));
  assert.equal(res.status, 200);
  assert.match(await res.text(), /unsubscribed/i);
});

test('GET with a tampered token is rejected', async () => {
  const res = await handler(new Request('https://pranavdhawan.com/.netlify/functions/unsubscribe?e=a@example.com&t=nope'));
  assert.equal(res.status, 400);
});

test('POST one-click with a valid token returns 200', async () => {
  const res = await handler(new Request(linkFor('a@example.com'), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'List-Unsubscribe=One-Click',
  }));
  assert.equal(res.status, 200);
});
