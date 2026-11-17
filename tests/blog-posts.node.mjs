// Posts are published by hand, so nothing generates the places that list them.
// This guard fails when a post file exists but one of those places was missed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const posts = readdirSync(new URL('../blog/', import.meta.url))
  .filter((name) => name.endsWith('.html') && name !== 'index.html');

test('there is at least one post', () => {
  assert.ok(posts.length > 0);
});

for (const post of posts) {
  test(`${post} is listed everywhere a post has to be`, () => {
    const url = `https://pranavdhawan.com/blog/${post}`;
    assert.ok(read('blog/index.html').includes(`href="${post}"`), 'missing from the blog index list');
    assert.ok(read('blog/index.html').includes(`"url": "${url}"`), 'missing from the blog index JSON-LD');
    assert.ok(read('blog/feed.xml').includes(`<link>${url}</link>`), 'missing from blog/feed.xml');
    assert.ok(read('sitemap.xml').includes(`<loc>${url}</loc>`), 'missing from sitemap.xml');
    assert.ok(read('llms.txt').includes(url), 'missing from llms.txt');
  });

  test(`${post} has consistent metadata`, () => {
    const html = read(`blog/${post}`);
    const url = `https://pranavdhawan.com/blog/${post}`;
    assert.ok(html.includes(`<link rel="canonical" href="${url}">`), 'canonical does not match the filename');
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    const posting = blocks.find((block) => block['@type'] === 'BlogPosting');
    assert.ok(posting, 'no BlogPosting JSON-LD');
    assert.equal(posting.mainEntityOfPage, url);
    assert.match(posting.datePublished, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(html.includes(`<time datetime="${posting.datePublished}">`), 'visible date differs from datePublished');
    assert.ok(html.includes(`<h1>${posting.headline.replace(/&/g, '&amp;')}</h1>`), 'h1 differs from the JSON-LD headline');
  });
}

test('the homepage teaser only links to posts that exist', () => {
  const links = [...read('index.html').matchAll(/href="blog\/([^"]+\.html)"/g)].map((m) => m[1]);
  assert.ok(links.length > 0);
  for (const link of links) assert.ok(posts.includes(link), `index.html links to missing post ${link}`);
});
