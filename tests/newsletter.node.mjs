import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  buildEmailHtml,
  buildEmailText,
  buildSubject,
  cleanEnv,
  extractSubscribers,
  shouldSend,
  suppressionStoreOptions,
  unsubscribeUrlFor,
} from '../scripts/send-newsletter.mjs';
import { verifyUnsubscribeToken } from '../netlify/functions/lib/unsubscribe-token.mjs';
import { SUPPRESSION_STORE } from '../netlify/functions/lib/unsubscribe-store.mjs';
import { subscriberRows, toCsv } from '../scripts/list-subscribers.mjs';

const ITEMS = [{
  title: 'Introducing <Model> X',
  url: 'https://lab.test/x?a=1&b=2',
  date: '2026-07-06',
  summary: 'A "big" release & more',
  sourceName: 'Lab',
  sourceId: 'lab',
  category: 'Model Release',
}];

test('extractSubscribers dedupes, lowercases, and drops invalid emails', () => {
  const subs = extractSubscribers([
    { data: { email: 'A@Example.com ' } },
    { data: { email: 'a@example.com' } },
    { data: { email: 'not-an-email' } },
    { data: { email: '' } },
    { data: {} },
    { data: { email: 'b@example.com' } },
  ]);
  assert.deepEqual(subs, ['a@example.com', 'b@example.com']);
});

test('shouldSend blocks a re-run within the same week', () => {
  const now = new Date('2026-07-06T06:15:00Z');
  assert.equal(shouldSend({}, now), true, 'first send always goes out');
  assert.equal(shouldSend({ lastSent: '2026-07-05T06:15:00Z' }, now), false, 'sent yesterday — skip');
  assert.equal(shouldSend({ lastSent: '2026-06-28T06:15:00Z' }, now), true, 'sent last week — send');
});

test('email html escapes item text and links to sources', () => {
  const html = buildEmailHtml(ITEMS, '2026-07-06');
  assert.ok(!html.includes('<Model>'), 'markup in titles must be escaped');
  assert.ok(html.includes('href="https://lab.test/x?a=1&amp;b=2"'));
  assert.ok(html.includes('Model Release'));
  assert.ok(/unsubscribe/i.test(html), 'must tell readers how to unsubscribe');
});

test('email builders skip unsafe item links', () => {
  const unsafeItems = [{ ...ITEMS[0], url: 'javascript:alert(1)' }];
  const html = buildEmailHtml(unsafeItems, '2026-07-06');
  const text = buildEmailText(unsafeItems, '2026-07-06');
  assert.ok(!html.includes('javascript:'), 'unsafe links must not be rendered in HTML email');
  assert.ok(!text.includes('javascript:'), 'unsafe links must not be rendered in text email');
});

test('plain-text version carries title, link, and unsubscribe note', () => {
  const text = buildEmailText(ITEMS, '2026-07-06');
  assert.ok(text.includes('https://lab.test/x?a=1&b=2'));
  assert.ok(/unsubscribe/i.test(text));
  assert.equal(buildSubject('2026-07-06'), 'AI This Week — Jul 6, 2026');
});

test('one-click unsubscribe link is per-recipient and signed', () => {
  const url = unsubscribeUrlFor('a@example.com', 'secret');
  assert.ok(url.includes('/.netlify/functions/unsubscribe'));
  const token = new URL(url).searchParams.get('t');
  assert.ok(verifyUnsubscribeToken('a@example.com', token, 'secret'));
  assert.equal(unsubscribeUrlFor('a@example.com', ''), '', 'no link without a signing secret');
});

test('emails include the one-click link and a postal address (CAN-SPAM)', () => {
  const opts = { unsubscribeUrl: 'https://pranavdhawan.com/.netlify/functions/unsubscribe?e=a%40example.com&t=abc' };
  const html = buildEmailHtml(ITEMS, '2026-07-06', opts);
  const text = buildEmailText(ITEMS, '2026-07-06', opts);
  // The URL is HTML-escaped in the HTML body (& -> &amp;); check the un-escaped stem plus the escaped query.
  assert.ok(html.includes('/.netlify/functions/unsubscribe?e=a%40example.com&amp;t=abc'), 'HTML carries the escaped one-click link');
  assert.ok(text.includes(opts.unsubscribeUrl), 'text carries the raw one-click link');
  assert.ok(/Washington, DC/.test(html) && /Washington, DC/.test(text), 'both carry a postal address');
});

test('cleanEnv strips the BOM and whitespace that shell pipes can add to secrets', () => {
  assert.equal(cleanEnv('﻿tok3n\n'), 'tok3n');
  assert.equal(cleanEnv('  plain  '), 'plain');
  assert.equal(cleanEnv(undefined), '');
});

// The sender runs in GitHub Actions, outside the Netlify runtime that
// auto-configures Blobs. Without explicit credentials the store throws, the
// read falls back to "no suppressions", and unsubscribed people get mailed.
test('suppression store is addressed with explicit Netlify credentials', () => {
  const opts = suppressionStoreOptions({ siteID: 'site-1', token: 'tok3n' });
  assert.equal(opts.name, SUPPRESSION_STORE);
  assert.equal(opts.siteID, 'site-1');
  assert.equal(opts.token, 'tok3n');
});

test('suppression store credentials fall back to the workflow env, sanitized', () => {
  const prev = { site: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN };
  process.env.NETLIFY_SITE_ID = '﻿site-2\n';
  process.env.NETLIFY_AUTH_TOKEN = '  tok4n  ';
  try {
    assert.deepEqual(suppressionStoreOptions(), {
      name: SUPPRESSION_STORE,
      siteID: 'site-2',
      token: 'tok4n',
    });
  } finally {
    process.env.NETLIFY_SITE_ID = prev.site;
    process.env.NETLIFY_AUTH_TOKEN = prev.token;
  }
});

test('subscriberRows dedupes by email keeping the earliest signup', () => {
  const rows = subscriberRows([
    { data: { email: 'a@example.com' }, created_at: '2026-07-02T10:00:00Z' },
    { data: { email: 'A@example.com' }, created_at: '2026-07-01T10:00:00Z' },
    { data: { email: 'bad' }, created_at: '2026-07-01T10:00:00Z' },
    { data: { email: 'b@example.com' }, created_at: '2026-07-03T10:00:00Z' },
  ]);
  assert.deepEqual(rows, [
    { email: 'a@example.com', subscribedAt: '2026-07-01T10:00:00Z' },
    { email: 'b@example.com', subscribedAt: '2026-07-03T10:00:00Z' },
  ]);
  assert.equal(toCsv(rows).split('\n')[0], 'email,subscribed_at');
});

test('CSV export neutralizes spreadsheet formulas and quotes fields', () => {
  const csv = toCsv([{ email: '=HYPERLINK("https://evil.example")', subscribedAt: '+2026-07-01' }]);
  assert.equal(csv, 'email,subscribed_at\n"\'=HYPERLINK(""https://evil.example"")",\'+2026-07-01\n');
});

test('subscriber CSV export stays out of git', async () => {
  const gitignore = await readFile(new URL('../.gitignore', import.meta.url), 'utf8');
  assert.ok(gitignore.includes('subscribers.csv'), 'subscriber emails must never be committed');
});

test('blog page has the Netlify newsletter form with honeypot', async () => {
  const page = await readFile(new URL('../blog/index.html', import.meta.url), 'utf8');
  assert.match(page, /<form[^>]*name="newsletter"[^>]*data-netlify="true"/);
  assert.match(page, /netlify-honeypot="bot-field"/);
  assert.match(page, /name="form-name" value="newsletter"/);
  assert.match(page, /newsletter\.js/);
});

test('weekly workflow sends the newsletter after the digest update', async () => {
  const workflow = await readFile(new URL('../.github/workflows/update-ai-news.yml', import.meta.url), 'utf8');
  assert.match(workflow, /node scripts\/send-newsletter\.mjs/);
  assert.match(workflow, /SMTP_PASS: \$\{\{ secrets\.SMTP_PASS \}\}/, 'credentials must come from secrets, never the repo');
});
