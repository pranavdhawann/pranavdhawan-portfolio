import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  confirmUrlFor,
  normalizeSiteUrl,
} from '../netlify/functions/submission-created.mjs';

test('normalizeSiteUrl strips www', () => {
  assert.equal(normalizeSiteUrl('https://www.pranavdhawan.com'), 'https://pranavdhawan.com');
  assert.equal(normalizeSiteUrl('https://pranavdhawan.com/'), 'https://pranavdhawan.com/');
});

// A www SITE_URL would route signed links through the apex 301, which converts
// RFC 8058 POSTs into GETs and silently kills one-click unsubscribe.
test('confirmUrlFor never emits a www host', () => {
  const url = confirmUrlFor('a@example.com', 'secret', 'https://www.pranavdhawan.com');
  assert.ok(url.startsWith('https://pranavdhawan.com/.netlify/functions/confirm'));
});
