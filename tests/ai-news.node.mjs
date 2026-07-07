import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  categorize,
  dedupe,
  escapeHtml,
  httpsUrl,
  injectDigest,
  normalizeUrl,
  parseFeed,
  parseSitemap,
  renderDigest,
  selectForPage,
  stripHtml,
  titleFromSlug,
  SOURCES,
} from '../scripts/fetch-ai-news.mjs';

test('stripHtml unwraps CDATA before stripping tags', () => {
  assert.equal(stripHtml('<![CDATA[How ChatGPT adoption has expanded]]>'), 'How ChatGPT adoption has expanded');
  assert.equal(stripHtml('<![CDATA[<p>Hello <b>world</b></p>]]>'), 'Hello world');
});

test('stripHtml removes double-encoded markup from descriptions', () => {
  assert.equal(stripHtml('&lt;img src="https://x.test/a.webp"&gt;Here are the updates.'), 'Here are the updates.');
});

test('httpsUrl upgrades plain http feed links', () => {
  assert.equal(httpsUrl('http://bair.berkeley.edu/blog/post/'), 'https://bair.berkeley.edu/blog/post/');
  assert.equal(httpsUrl('https://already.fine/x'), 'https://already.fine/x');
});

test('generated digest never links over plain http', async () => {
  const page = await readFile(new URL('../blog/index.html', import.meta.url), 'utf8');
  const region = page.split('<!-- AI-NEWS:START -->')[1].split('<!-- AI-NEWS:END -->')[0];
  assert.ok(!/href="http:\/\//.test(region), 'digest cards must use https links');
});

test('normalizeUrl drops tracking params, hashes, and trailing slashes', () => {
  assert.equal(
    normalizeUrl('https://Example.com/post/?utm_source=rss&utm_medium=feed#section'),
    'https://example.com/post'
  );
});

test('dedupe removes repeats by URL and by title', () => {
  const items = [
    { title: 'Introducing Model X', url: 'https://a.test/x' },
    { title: 'Introducing Model X', url: 'https://a.test/x?utm_source=rss' },
    { title: 'Introducing Model X!', url: 'https://mirror.test/model-x' },
    { title: 'Something else', url: 'https://a.test/y' },
  ];
  assert.equal(dedupe(items).length, 2);
});

test('categorize maps keywords to the expected tags', () => {
  assert.equal(categorize({ title: 'Introducing our new frontier model', summary: '' }), 'Model Release');
  assert.equal(categorize({ title: 'We open-sourced the training stack', summary: '' }), 'Open Source');
  assert.equal(categorize({ title: 'A new benchmark paper on unlearning', summary: '' }), 'Research');
  assert.equal(categorize({ title: 'Scaling our GPU cluster', summary: '' }), 'Infrastructure');
  assert.equal(categorize({ title: 'Untagged thing', summary: '' }, 'Product Update'), 'Product Update');
});

test('parseFeed handles RSS items and Atom entries', () => {
  const rss = `<rss><channel><item>
    <title><![CDATA[Story one]]></title>
    <link>https://a.test/one</link>
    <pubDate>Tue, 30 Jun 2026 09:00:00 GMT</pubDate>
    <description><![CDATA[Summary <b>one</b>]]></description>
  </item></channel></rss>`;
  const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><entry>
    <title>Paper two</title>
    <link href="https://arxiv.test/abs/1" rel="alternate"/>
    <published>2026-07-02T00:00:00Z</published>
    <summary>Abstract two</summary>
  </entry></feed>`;
  const [one] = parseFeed(rss);
  assert.deepEqual(one, { title: 'Story one', url: 'https://a.test/one', date: '2026-06-30', summary: 'Summary one' });
  const [two] = parseFeed(atom);
  assert.equal(two.url, 'https://arxiv.test/abs/1');
  assert.equal(two.date, '2026-07-02');
});

test('parseSitemap keeps only matching paths, newest first, titled from slug', () => {
  const xml = `<urlset>
    <url><loc>https://lab.test/news/new-model-launch</loc><lastmod>2026-07-01T00:00:00Z</lastmod></url>
    <url><loc>https://lab.test/careers/role</loc><lastmod>2026-07-03T00:00:00Z</lastmod></url>
    <url><loc>https://lab.test/news/safety-update</loc><lastmod>2026-07-02T00:00:00Z</lastmod></url>
  </urlset>`;
  const items = parseSitemap(xml, /^https:\/\/lab\.test\/news\//);
  assert.deepEqual(items.map((i) => i.url), ['https://lab.test/news/safety-update', 'https://lab.test/news/new-model-launch']);
  assert.equal(items[1].title, 'New Model Launch');
  assert.equal(titleFromSlug('https://lab.test/news/ai-for-science/'), 'AI For Science');
});

test('selectForPage surfaces every source before repeating one', () => {
  const now = new Date('2026-07-06T00:00:00Z');
  const items = [];
  for (let i = 0; i < 10; i += 1) {
    items.push({ title: `busy ${i}`, url: `https://busy.test/${i}`, date: '2026-07-05', sourceId: 'busy', sourceName: 'Busy' });
  }
  items.push({ title: 'quiet one', url: 'https://quiet.test/1', date: '2026-07-01', sourceId: 'quiet', sourceName: 'Quiet' });
  const picked = selectForPage(items, now);
  assert.ok(picked.some((i) => i.sourceId === 'quiet'), 'quiet source should appear despite older date');
  assert.ok(picked.filter((i) => i.sourceId === 'busy').length <= 3, 'per-source cap respected');
});

test('renderDigest escapes item text and links every card to its source', () => {
  const html = renderDigest([{
    title: '<script>alert(1)</script> "Model"',
    url: 'https://a.test/x?a=1&b=2',
    date: '2026-07-01',
    summary: 'Summary & more',
    sourceName: 'Lab',
    sourceId: 'lab',
    category: 'Research',
  }], '2026-07-06');
  assert.ok(!html.includes('<script>'), 'markup in titles must be escaped');
  assert.ok(html.includes('href="https://a.test/x?a=1&amp;b=2"'));
  assert.ok(html.includes('rel="noopener noreferrer"'));
});

test('injectDigest replaces only the marked region and rejects missing markers', () => {
  const page = 'before\n<!-- AI-NEWS:START -->old<!-- AI-NEWS:END -->\nafter';
  assert.equal(injectDigest(page, '<!-- AI-NEWS:START -->new<!-- AI-NEWS:END -->'),
    'before\n<!-- AI-NEWS:START -->new<!-- AI-NEWS:END -->\nafter');
  assert.throws(() => injectDigest('no markers here', 'x'));
});

test('blog page keeps the digest markers the generator writes into', async () => {
  const page = await readFile(new URL('../blog/index.html', import.meta.url), 'utf8');
  assert.ok(page.includes('<!-- AI-NEWS:START -->') && page.includes('<!-- AI-NEWS:END -->'));
});

test('escapeHtml covers the characters html-validate rejects', () => {
  assert.equal(escapeHtml('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
});

test('weekly workflow runs the generator on a cron with write permission', async () => {
  const workflow = await readFile(new URL('../.github/workflows/update-ai-news.yml', import.meta.url), 'utf8');
  assert.match(workflow, /schedule:\s*[\s\S]*cron:/, 'needs a cron schedule');
  assert.match(workflow, /contents: write/, 'needs permission to push the digest commit');
  assert.match(workflow, /node scripts\/fetch-ai-news\.mjs/, 'must run the generator');
});

test('source list covers the major labs plus research and code feeds', () => {
  const ids = SOURCES.map((s) => s.id);
  for (const id of ['openai', 'anthropic', 'deepmind', 'meta-ai', 'mistral', 'huggingface', 'arxiv', 'github-trending']) {
    assert.ok(ids.includes(id), `missing source: ${id}`);
  }
});
