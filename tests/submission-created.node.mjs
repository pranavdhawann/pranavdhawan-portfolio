import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildContactEmail,
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

test('contact notification escapes visitor input in the HTML part', () => {
  const { subject, text, html } = buildContactEmail({
    name: 'Eve <script>alert(1)</script>',
    email: 'eve@example.com',
    message: '<img src=x onerror=alert(2)> hello',
    receivedAt: '2026-08-25T00:00:00Z',
  });
  // Angle brackets are stripped from the name outright...
  assert.ok(!html.includes('<script>'));
  assert.ok(!subject.includes('<'));
  // ...and the message is entity-escaped into the HTML part.
  assert.ok(html.includes('&lt;img src=x onerror=alert(2)&gt;'));
  // The plain-text part is genuinely plain — no escaping artifacts.
  assert.ok(text.includes('<img src=x onerror=alert(2)> hello'));
});

// Name flows into the SMTP Subject header; CRLF there is header injection.
test('subject strips control characters from the visitor name', () => {
  const { subject } = buildContactEmail({
    name: 'Bob\r\nBcc: victim@example.com',
    email: 'bob@example.com',
    message: 'hi',
    receivedAt: '2026-08-25T00:00:00Z',
  });
  assert.ok(!/[\r\n]/.test(subject));
  assert.match(subject, /^Portfolio message from Bob/);
});
