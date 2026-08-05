#!/usr/bin/env node
/**
 * Weekly AI news digest generator.
 *
 * Fetches recent items from official AI lab blogs (RSS/Atom), the arXiv API,
 * and the GitHub search API, dedupes them against blog/data/ai-news.json,
 * and statically injects the freshest items into blog/index.html between
 * the <!-- AI-NEWS:START --> / <!-- AI-NEWS:END --> markers.
 *
 * Zero npm dependencies — native fetch + small regex-based feed parsing.
 * Run:  node scripts/fetch-ai-news.mjs
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA_FILE = path.join(ROOT, 'blog', 'data', 'ai-news.json');
const BLOG_PAGE = path.join(ROOT, 'blog', 'index.html');
const FEED_FILE = path.join(ROOT, 'blog', 'feed.xml');

const START_MARKER = '<!-- AI-NEWS:START -->';
const END_MARKER = '<!-- AI-NEWS:END -->';

const FETCH_TIMEOUT_MS = 20000;
const MAX_AGE_DAYS = 14; // only surface items newer than this
const MAX_ITEMS_ON_PAGE = 12;
const MAX_PER_SOURCE = 3; // keep the digest diverse
const MAX_ARCHIVE_ITEMS = 200;

/**
 * Feed sources. To add one, append an entry; to remove one, delete it.
 * type: 'feed'    — RSS 2.0 or Atom XML
 *       'sitemap' — sitemap.xml filtered by `pathFilter` (for sites with no
 *                   feed, e.g. anthropic.com); titles are derived from slugs
 *       'arxiv'   — Atom via export.arxiv.org
 *       'github'  — repo search API (optionally authenticated, GITHUB_TOKEN)
 * category: default category when keyword heuristics don't match.
 * fixedCategory: when true, always use `category` and skip the keyword
 *         heuristics (for sources whose items are all one kind, e.g. arXiv).
 * filter: optional regex an item's title+summary must match to be kept
 *         (for broad feeds where only AI items are wanted).
 */
export const SOURCES = [
  { id: 'openai', name: 'OpenAI', type: 'feed', url: 'https://openai.com/news/rss.xml', category: 'Product Update' },
  {
    id: 'anthropic', name: 'Anthropic', type: 'sitemap', category: 'Product Update',
    url: 'https://www.anthropic.com/sitemap.xml', pathFilter: /^https:\/\/www\.anthropic\.com\/news\//,
  },
  { id: 'deepmind', name: 'Google DeepMind', type: 'feed', url: 'https://deepmind.google/blog/rss.xml', category: 'Research' },
  { id: 'google-ai', name: 'Google AI', type: 'feed', url: 'https://blog.google/technology/ai/rss/', category: 'Product Update' },
  {
    id: 'meta-ai', name: 'Meta', type: 'feed', url: 'https://about.fb.com/news/feed/', category: 'Product Update',
    filter: /\bAI\b|artificial intelligence|\bllama\b|superintelligence/i,
  },
  { id: 'mistral', name: 'Mistral AI', type: 'feed', url: 'https://mistral.ai/rss.xml', category: 'Model Release' },
  { id: 'huggingface', name: 'Hugging Face', type: 'feed', url: 'https://huggingface.co/blog/feed.xml', category: 'Open Source' },
  { id: 'bair', name: 'Berkeley AI Research', type: 'feed', url: 'https://bair.berkeley.edu/blog/feed.xml', category: 'Research' },
  { id: 'mit-ai', name: 'MIT News — AI', type: 'feed', url: 'https://news.mit.edu/rss/topic/artificial-intelligence2', category: 'Research' },
  {
    id: 'arxiv', name: 'arXiv', type: 'arxiv', category: 'Research', fixedCategory: true,
    url: 'https://export.arxiv.org/api/query?search_query=cat:cs.LG+OR+cat:cs.CL+OR+cat:cs.AI&sortBy=submittedDate&sortOrder=descending&max_results=8',
  },
  {
    id: 'github-trending', name: 'GitHub', type: 'github', category: 'Open Source', fixedCategory: true,
    // `created:>DATE` is appended at fetch time so the search window tracks the run date.
    url: 'https://api.github.com/search/repositories?sort=stars&order=desc&per_page=6&q=',
    query: 'topic:llm topic:machine-learning',
  },
];

const CATEGORY_RULES = [
  { category: 'Model Release', pattern: /\b(introducing|announcing|releas\w+|launch\w+|unveil\w+|preview of)\b.*\b(model|weights|gpt|claude|gemini|llama|mistral|sonnet|opus|haiku)\b|\bnew (flagship |frontier )?model\b/i },
  { category: 'Open Source', pattern: /\bopen[- ]sourc\w+|\bopen[- ]weights?\b|\bapache[- ]2|mit licen[cs]e|\brepo(sitor(y|ies))?\b/i },
  { category: 'Infrastructure', pattern: /\b(gpu|tpu|chip|cluster|data ?cent(er|re)|inference stack|training run|compute|super ?computer|silicon)\b/i },
  { category: 'Research', pattern: /\b(papers?|stud(?:y|ies)|benchmarks?|evaluat\w+|interpretab\w+|arxiv|preprint|research\w*|findings?)\b/i },
  { category: 'Product Update', pattern: /\b(api|pricing|features?|update\w*|available (now|today|in)|rolling out|integration|app|enterprise)\b/i },
];

// Named entities that show up in feed text. Feeds often double-encode
// (&amp;mdash;), so these run after the &amp; pass to catch both forms.
const NAMED_ENTITIES = {
  mdash: '—', ndash: '–', hellip: '…', middot: '·', bull: '•',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  trade: '™', copy: '©', reg: '®', deg: '°',
};

const safeCodePoint = (n, fallback) => {
  // Out-of-range or lone-surrogate references — keep the raw text.
  if (!Number.isInteger(n) || n < 0 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) return fallback;
  return String.fromCodePoint(n);
};

export function decodeEntities(str) {
  return String(str)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (m, n) => safeCodePoint(Number(n), m))
    .replace(/&#x([0-9a-f]+);/gi, (m, n) => safeCodePoint(parseInt(n, 16), m))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&(apos|#39);/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&([a-z]+);/gi, (m, name) => NAMED_ENTITIES[name.toLowerCase()] || m);
}

export function stripHtml(str) {
  // Unwrap CDATA before stripping tags — a CDATA block with no '>' in its
  // content would otherwise be consumed whole by the tag regex. Feeds also
  // double-encode markup (&lt;img ...&gt;), hence the second strip pass.
  let s = String(str).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  s = decodeEntities(s.replace(/<[^>]*>/g, ' '));
  return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function truncate(str, max = 220) {
  const s = String(str).trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 40)).replace(/[,;:.!?]$/, '')}…`;
}

/** Some feeds (e.g. BAIR) publish http:// links; serve https on an https site. */
export function httpsUrl(url) {
  try {
    const parsed = new URL(String(url).trim());
    if (parsed.protocol === 'http:') {
      parsed.protocol = 'https:';
      return parsed.href;
    }
    return parsed.protocol === 'https:' ? parsed.href : '';
  } catch {
    return '';
  }
}

/** Canonical form of a URL for dedup: no tracking params, hash, or trailing slash. */
export function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) {
      if (/^(utm_|ref|source|mc_|fbclid|gclid)/i.test(key)) u.searchParams.delete(key);
    }
    u.pathname = u.pathname.replace(/\/+$/, '') || '/';
    return `${u.origin}${u.pathname}${u.search}`.toLowerCase();
  } catch {
    return String(url).trim().toLowerCase();
  }
}

/** Loose title key so the same story from mirrors dedupes too. */
export function titleKey(title) {
  return stripHtml(title).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 120);
}

export function categorize(item, fallback = 'Research') {
  const text = `${item.title} ${item.summary || ''}`;
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(text)) return rule.category;
  }
  return fallback;
}

/** Parse RSS 2.0 <item> or Atom <entry> blocks into plain objects. */
export function parseFeed(xml) {
  const items = [];
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) || [];
  for (const block of blocks) {
    const tag = (name) => {
      const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
      return m ? m[1].trim() : '';
    };
    let link = tag('link');
    if (!link || /</.test(link)) {
      const alt = block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i)
        || block.match(/<link[^>]*href=["']([^"']+)["']/i);
      link = alt ? alt[1] : '';
    }
    const title = stripHtml(tag('title'));
    const date = tag('pubDate') || tag('published') || tag('updated') || tag('dc:date');
    const summary = stripHtml(tag('description') || tag('summary') || tag('content:encoded') || tag('content'));
    if (title && link) {
      items.push({ title, url: decodeEntities(link), date: toIsoDate(date), summary });
    }
  }
  return items;
}

export function toIsoDate(str) {
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
}

async function fetchText(url, headers = {}) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    // Some hosts (openai.com) serve an empty document to non-browser UAs.
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; pranavdhawan-portfolio-digest; +https://pranavdhawan.com)', ...headers },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/** "claude-fable-5-mythos-5" -> "Claude Fable 5 Mythos 5" */
export function titleFromSlug(url) {
  const slug = new URL(url).pathname.replace(/\/+$/, '').split('/').pop() || '';
  return slug
    .split('-')
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w.toUpperCase()))
    .join(' ');
}

export function parseSitemap(xml, pathFilter) {
  const entries = [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*(?:<lastmod>([^<]+)<\/lastmod>)?/g)]
    .filter((m) => pathFilter.test(m[1]) && m[2])
    .sort((a, b) => b[2].localeCompare(a[2]))
    .slice(0, 10);
  return entries.map(([, loc, lastmod]) => ({
    title: titleFromSlug(loc),
    url: loc,
    date: toIsoDate(lastmod),
    summary: '',
  }));
}

async function fetchSource(source, now = new Date()) {
  if (source.type === 'sitemap') {
    return parseSitemap(await fetchText(source.url), source.pathFilter);
  }
  if (source.type === 'github') {
    const since = new Date(now.getTime() - 45 * 86400000).toISOString().slice(0, 10);
    const q = encodeURIComponent(`${source.query} created:>${since}`);
    const headers = { Accept: 'application/vnd.github+json' };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const body = JSON.parse(await fetchText(source.url + q, headers));
    return (body.items || []).map((repo) => ({
      title: `${repo.full_name} — trending AI repo`,
      url: repo.html_url,
      date: toIsoDate(repo.created_at),
      summary: repo.description ? `${repo.description} (★ ${repo.stargazers_count.toLocaleString('en-US')})` : `★ ${repo.stargazers_count.toLocaleString('en-US')}`,
    }));
  }
  return parseFeed(await fetchText(source.url));
}

export function dedupe(items, seenUrls = new Set(), seenTitles = new Set()) {
  const out = [];
  for (const item of items) {
    const urlId = normalizeUrl(item.url);
    const titleId = titleKey(item.title);
    if (seenUrls.has(urlId) || (titleId && seenTitles.has(titleId))) continue;
    seenUrls.add(urlId);
    if (titleId) seenTitles.add(titleId);
    out.push(item);
  }
  return out;
}

export function selectForPage(items, now = new Date()) {
  const cutoff = new Date(now.getTime() - MAX_AGE_DAYS * 86400000).toISOString().slice(0, 10);
  const fresh = items.filter((i) => i.date >= cutoff);
  const pool = (fresh.length >= 4 ? fresh : items)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));
  // Pass 1: the newest item from every source, so prolific feeds don't
  // crowd quieter labs out of the digest. Pass 2: fill by recency.
  const perSource = new Map();
  const picked = [];
  for (const item of pool) {
    if (picked.length >= MAX_ITEMS_ON_PAGE) break;
    if (perSource.has(item.sourceId)) continue;
    perSource.set(item.sourceId, 1);
    picked.push(item);
  }
  for (const item of pool) {
    if (picked.length >= MAX_ITEMS_ON_PAGE) break;
    const count = perSource.get(item.sourceId) || 0;
    if (count >= MAX_PER_SOURCE || picked.includes(item)) continue;
    perSource.set(item.sourceId, count + 1);
    picked.push(item);
  }
  return picked.sort((a, b) => b.date.localeCompare(a.date));
}

export function formatDate(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
  });
}

export function renderDigest(items, updatedIso) {
  const cards = items
    .map((item) => ({ ...item, url: httpsUrl(item.url) }))
    .filter((item) => item.url)
    .map((item) => {
      const host = new URL(item.url).hostname.replace(/^www\./, '');
      return [
        `                    <a class="writing-card" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">`,
        `                        <span class="writing-tag">${escapeHtml(item.category)} &middot; ${escapeHtml(item.sourceName)}</span>`,
        `                        <h3>${escapeHtml(item.title)}</h3>`,
        `                        <p>${escapeHtml(truncate(item.summary || 'Read the full story at the source.'))}</p>`,
        `                        <span class="writing-readmore"><span class="writing-date">${escapeHtml(formatDate(item.date))}</span> &middot; ${escapeHtml(host)} &rarr;</span>`,
        '                    </a>',
      ].join('\n');
    }).join('\n');
  const digestBody = cards || '                <p class="writing-intro">No safe, recent items are available this week. Please check back soon.</p>';
  return [
    START_MARKER,
    `                <p class="writing-intro">A weekly digest of AI developments, curated automatically by a zero-dependency pipeline I built — pulled straight from official lab blogs, arXiv, and GitHub. Every card links to its original source. <a href="feed.xml">Subscribe via RSS</a>. Updated ${escapeHtml(formatDate(updatedIso))}.</p>`,
    cards ? '                <div class="writing-grid">' : '',
    digestBody,
    cards ? '                </div>' : '',
    `                ${END_MARKER}`,
  ].join('\n');
}

const FEED_URL = 'https://pranavdhawan.com/blog/feed.xml';
const BLOG_URL = 'https://pranavdhawan.com/blog/';

/**
 * RSS 2.0 for the weekly digest.
 *
 * Each <item> points at the original source rather than a local permalink —
 * the digest has no per-item page, and sending readers to the lab's own post is
 * the honest destination. guid isPermaLink="false" keeps readers from treating
 * the external URL as this feed's canonical id.
 */
export function renderFeed(items, updatedIso) {
  const entries = items
    .map((item) => ({ ...item, url: httpsUrl(item.url) }))
    .filter((item) => item.url)
    .map((item) => [
      '    <item>',
      `      <title>${escapeHtml(item.title)}</title>`,
      `      <link>${escapeHtml(item.url)}</link>`,
      `      <guid isPermaLink="false">${escapeHtml(normalizeUrl(item.url))}</guid>`,
      `      <pubDate>${new Date(`${item.date}T00:00:00Z`).toUTCString()}</pubDate>`,
      `      <category>${escapeHtml(item.category)}</category>`,
      `      <source url="${escapeHtml(FEED_URL)}">${escapeHtml(item.sourceName)}</source>`,
      `      <description>${escapeHtml(truncate(item.summary || 'Read the full story at the source.'))}</description>`,
      '    </item>',
    ].join('\n'))
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AI This Week — Pranav Dhawan</title>
    <link>${BLOG_URL}</link>
    <atom:link href="${FEED_URL}" rel="self" type="application/rss+xml"/>
    <description>A weekly, auto-curated digest of AI developments from official lab blogs, arXiv, and GitHub.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date(`${updatedIso}T00:00:00Z`).toUTCString()}</lastBuildDate>
${entries}
  </channel>
</rss>
`;
}

export function injectDigest(html, digestHtml) {
  const start = html.indexOf(START_MARKER);
  const end = html.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Markers ${START_MARKER} / ${END_MARKER} not found in blog page`);
  }
  return html.slice(0, start) + digestHtml + html.slice(end + END_MARKER.length);
}

async function loadArchive() {
  try {
    return JSON.parse(await readFile(DATA_FILE, 'utf8'));
  } catch {
    return { updated: null, items: [] };
  }
}

async function main() {
  const now = new Date();
  const archive = await loadArchive();
  archive.items = archive.items
    .map((i) => ({ ...i, url: httpsUrl(i.url) }))
    .filter((i) => i.url);
  const seenUrls = new Set(archive.items.map((i) => normalizeUrl(i.url)));
  const seenTitles = new Set(archive.items.map((i) => titleKey(i.title)));

  const results = await Promise.allSettled(SOURCES.map(async (source) => {
    const raw = await fetchSource(source, now);
    return raw
      .filter((item) => !source.filter || source.filter.test(`${item.title} ${item.summary || ''}`))
      .map((item) => ({
        ...item,
        url: httpsUrl(item.url),
        sourceId: source.id,
        sourceName: source.name,
        category: source.fixedCategory ? source.category : categorize(item, source.category),
      }))
      .filter((item) => item.url);
  }));

  let fetched = [];
  let okCount = 0;
  results.forEach((result, i) => {
    const source = SOURCES[i];
    if (result.status === 'fulfilled') {
      okCount += 1;
      console.log(`ok    ${source.id}: ${result.value.length} items`);
      fetched = fetched.concat(result.value);
    } else {
      console.warn(`fail  ${source.id}: ${result.reason?.message || result.reason}`);
    }
  });

  if (okCount === 0) {
    // Fallback: leave the existing page and archive untouched so the last
    // good digest keeps serving; fail loudly so the scheduled job alerts.
    console.error('All sources failed — keeping the previous digest.');
    process.exitCode = 1;
    return;
  }

  const fresh = dedupe(fetched, seenUrls, seenTitles);
  console.log(`\n${fresh.length} new items after dedup (${archive.items.length} already archived)`);

  const items = fresh.concat(archive.items)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, MAX_ARCHIVE_ITEMS);
  const updatedIso = now.toISOString().slice(0, 10);

  await mkdir(path.dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, `${JSON.stringify({ updated: updatedIso, items }, null, 2)}\n`);

  const page = await readFile(BLOG_PAGE, 'utf8');
  const selected = selectForPage(items, now);
  await writeFile(BLOG_PAGE, injectDigest(page, renderDigest(selected, updatedIso)));
  await writeFile(FEED_FILE, renderFeed(selected, updatedIso));
  console.log(`Wrote ${selected.length} items to blog/index.html and blog/feed.xml, and ${items.length} to blog/data/ai-news.json`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
