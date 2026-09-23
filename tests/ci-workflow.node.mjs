import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

test('lychee excludes profile links that reject automated link checks', async () => {
  const workflow = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');

  // LinkedIn answers automated clients with HTTP 999 and can never be checked.
  assert.match(workflow, /--exclude https:\/\/linkedin\.com\/in\/pranavvdhawann/);
  assert.match(workflow, /--exclude https:\/\/www\.linkedin\.com\/in\/pranavvdhawann/);
});

// Excludes are a maintenance liability: each one hides a URL from validation
// forever. Drop the entry when the link leaves the site, or the next broken
// link behind that exclude goes unnoticed.
test('lychee does not carry excludes for links the site no longer has', async () => {
  const workflow = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const pages = await Promise.all(
    ['../index.html', '../privacy.html', '../blog/index.html', '../README.md']
      .map((p) => readFile(new URL(p, import.meta.url), 'utf8'))
  );
  const site = pages.join('\n');

  for (const dead of ['app.joinhandshake.com', 'stock-screen-25476982226.us-central1.run.app']) {
    assert.ok(!site.includes(dead), `${dead} is back on the site — restore its exclude if CI needs it`);
    assert.ok(!workflow.includes(dead), `${dead} is not linked anywhere; drop its stale lychee exclude`);
  }
});

test('production deploy builds a limited publish directory', async () => {
  const config = await readFile(new URL('../netlify.toml', import.meta.url), 'utf8');
  assert.match(config, /\[build\][\s\S]*command = "node scripts\/build-site\.mjs"/);
  assert.match(config, /\[build\][\s\S]*publish = "public"/);
});

test('CI checks high-severity dependency advisories and every public HTML page', async () => {
  const workflow = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.match(workflow, /npm audit --audit-level=high/);
  assert.match(workflow, /public\/index\.html public\/blog\/\*\.html public\/privacy\.html README\.md/);
  // Host-wide, not per-URL: the digest keeps adding openai.com links that 403
  // datacenter IPs, and a per-URL list goes stale every week.
  assert.match(workflow, /--exclude https:\/\/openai\.com\/(?=\s)/);
  assert.match(workflow, /--exclude https:\/\/pranavdhawan\.goatcounter\.com/);
  assert.match(workflow, /--exclude https:\/\/www\.goatcounter\.com/);
});

test('CI runs the complete project verification and production build', async () => {
  const workflow = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.match(workflow, /run: npm run check/);
  assert.match(workflow, /run: npm run build/);
});

// Rebasing before staging fails outright ("cannot pull with rebase: You have
// unstaged changes") because the generated digest dirties the tree, so the
// order matters as much as the rebase being there at all.
test('weekly workflow stages and commits before it rebases onto main', async () => {
  const workflow = await readFile(new URL('../.github/workflows/update-ai-news.yml', import.meta.url), 'utf8');
  const steps = workflow.split(/^ {6}- name: /m).filter((step) => step.includes('git pull --rebase'));
  assert.equal(steps.length, 2);
  for (const step of steps) {
    // indexOf returns -1 for a missing command, which would make the ordering
    // comparisons below pass vacuously — require each one to be present first.
    const at = (command) => {
      const index = step.indexOf(command);
      assert.notEqual(index, -1, `missing ${command}`);
      return index;
    };
    assert.ok(at('git add') < at('git commit'), 'stage before commit');
    assert.ok(at('git commit') < at('git pull --rebase'), 'commit before rebase');
    assert.ok(at('git pull --rebase') < at('git push'), 'rebase before push');
  }
});

test('crawl controls list every public page', async () => {
  const robots = await readFile(new URL('../robots.txt', import.meta.url), 'utf8');
  const sitemap = await readFile(new URL('../sitemap.xml', import.meta.url), 'utf8');
  assert.match(robots, /Sitemap: https:\/\/pranavdhawan\.com\/sitemap\.xml/);
  for (const path of ['/', '/blog/', '/blog/rag-hallucinations.html', '/blog/multimodal-finding.html', '/privacy.html']) {
    assert.match(sitemap, new RegExp(`https://pranavdhawan\\.com${path.replaceAll('.', '\\.')}`));
  }
});
