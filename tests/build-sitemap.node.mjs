import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { ISO_DATE_PATTERN, rewriteBlogLastmod } from '../scripts/lib/sitemap-lastmod.mjs';

const SITEMAP = await readFile(new URL('../sitemap.xml', import.meta.url), 'utf8');

test('ISO_DATE_PATTERN accepts W3C dates only', () => {
  assert.ok(ISO_DATE_PATTERN.test('2026-08-10'));
  assert.ok(!ISO_DATE_PATTERN.test('Aug 10, 2026'));
  assert.ok(!ISO_DATE_PATTERN.test(''));
  assert.ok(!ISO_DATE_PATTERN.test('2026-8-10'));
});

test('rewriteBlogLastmod replaces the blog entry lastmod', () => {
  const { xml, replaced } = rewriteBlogLastmod(SITEMAP, '2026-08-25');
  assert.ok(replaced);
  assert.ok(xml.includes('<loc>https://pranavdhawan.com/blog/</loc><lastmod>2026-08-25</lastmod>'));
  assert.notEqual(xml, SITEMAP);
});

test('rewriteBlogLastmod tolerates whitespace between loc and lastmod', () => {
  const reformatted = SITEMAP.replace(
    '<loc>https://pranavdhawan.com/blog/</loc><lastmod>',
    '<loc>https://pranavdhawan.com/blog/</loc>\n    <lastmod>'
  );
  const { xml, replaced } = rewriteBlogLastmod(reformatted, '2026-09-01');
  assert.ok(replaced);
  assert.ok(xml.includes('<lastmod>2026-09-01</lastmod>'));
});

// The old inline regex was a silent no-op when the markup drifted; the caller
// now warns via this flag instead of shipping a stale date on a green build.
test('rewriteBlogLastmod reports a miss instead of failing silently', () => {
  const { replaced } = rewriteBlogLastmod('<urlset></urlset>', '2026-08-25');
  assert.equal(replaced, false);
});

test('rewriteBlogLastmod refuses to corrupt the sitemap with a bad date', () => {
  assert.throws(() => rewriteBlogLastmod(SITEMAP, 'Aug 10 2026'));
  assert.throws(() => rewriteBlogLastmod(SITEMAP, ''));
});
