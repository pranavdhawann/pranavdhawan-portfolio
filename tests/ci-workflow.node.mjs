import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

test('lychee excludes profile links that reject automated link checks', async () => {
  const workflow = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');

  assert.match(
    workflow,
    /--exclude https:\/\/app\.joinhandshake\.com\/profiles\/pranavvdhawann/,
    'Handshake returns 403 to lychee and should be excluded like other CI-blocking social profiles'
  );
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
  assert.match(workflow, /--exclude https:\/\/pranavdhawan\.com\/privacy\.html/);
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

test('production build emits modern images without relying on global image tools', async () => {
  const nodeDirectory = path.dirname(process.execPath);
  await execFileAsync(process.execPath, ['scripts/build-site.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: {
      ...process.env,
      PATH: nodeDirectory,
      Path: nodeDirectory,
    },
    windowsHide: true,
  });

  for (const image of ['photo', 'eye', 'stockscreen', 'multimodal', 'pii', 'weather-dashboard']) {
    for (const extension of ['avif', 'webp']) {
      const output = new URL(`../public/images/${image}.${extension}`, import.meta.url);
      assert.ok((await stat(output)).size > 0, `${image}.${extension} should be generated`);
    }
  }

  const sourceCss = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  const builtCss = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  const sourceJs = await readFile(new URL('../script.js', import.meta.url), 'utf8');
  const builtJs = await readFile(new URL('../public/script.js', import.meta.url), 'utf8');
  assert.ok(builtCss.length < sourceCss.length, 'production CSS should be minified');
  assert.ok(builtJs.length < sourceJs.length, 'production JavaScript should be minified');
});

test('image optimization uses a declared cross-platform npm dependency', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(packageJson.devDependencies?.sharp ?? '', /^\^?\d+\./);
});
