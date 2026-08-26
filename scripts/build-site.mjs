import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform as transformJavaScript } from 'esbuild';
import { transform as transformCss } from 'lightningcss';
import { optimizeImages } from './optimize-images.mjs';
import { rewriteBlogLastmod } from './lib/sitemap-lastmod.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publish = path.join(root, 'public');
const assets = [
  'index.html',
  'styles.css',
  'script.js',
  'site-common.js',
  'theme-init.js',
  'Pranav_Dhawan_Resume.pdf',
  'robots.txt',
  'sitemap.xml',
  'privacy.html',
  'images',
  'blog',
];
const browserScripts = ['script.js', 'site-common.js', 'theme-init.js', 'blog/newsletter.js'];
const fontAssets = [
  {
    source: 'node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2',
    output: 'dm-sans-variable.woff2',
  },
  {
    source: 'node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2',
    output: 'space-grotesk-variable.woff2',
  },
];

await rm(publish, { recursive: true, force: true });
await mkdir(publish, { recursive: true });
await Promise.all(assets.map((asset) => cp(path.join(root, asset), path.join(publish, asset), { recursive: true })));

// blog/data holds generator runtime state (ai-news.json, newsletter-state.json)
// that no page fetches at runtime — never publish it. If the state schema ever
// gains subscriber addresses it would otherwise ship straight to the CDN.
await rm(path.join(publish, 'blog', 'data'), { recursive: true, force: true });

const fontsDirectory = path.join(publish, 'fonts');
await mkdir(fontsDirectory, { recursive: true });
await Promise.all(fontAssets.map(({ source, output }) => (
  cp(path.join(root, source), path.join(fontsDirectory, output))
)));

await optimizeImages(path.join(publish, 'images'));

const cssPath = path.join(root, 'styles.css');
const minifiedCss = transformCss({
  filename: cssPath,
  code: Buffer.from(await readFile(cssPath)),
  minify: true,
});
await writeFile(path.join(publish, 'styles.css'), minifiedCss.code);

// The blog index changes every Monday, so its sitemap lastmod is derived from
// the digest data rather than hand-maintained (and going stale the same week).
const digestUpdated = await readFile(path.join(root, 'blog', 'data', 'ai-news.json'), 'utf8')
  .then((raw) => JSON.parse(raw).updated)
  .catch(() => null);

if (digestUpdated) {
  const sitemapPath = path.join(publish, 'sitemap.xml');
  const sitemap = await readFile(sitemapPath, 'utf8');
  let result;
  try {
    result = rewriteBlogLastmod(sitemap, digestUpdated);
  } catch (error) {
    throw new Error(`sitemap lastmod update failed: ${error.message}`);
  }
  if (!result.replaced) {
    console.warn('sitemap.xml no longer matches the blog lastmod pattern — stale date shipped.');
  }
  await writeFile(sitemapPath, result.xml);
}

await Promise.all(browserScripts.map(async (relativePath) => {
  const sourcePath = path.join(root, relativePath);
  const { code } = await transformJavaScript(await readFile(sourcePath, 'utf8'), {
    minify: true,
    target: 'es2020',
    legalComments: 'none',
  });
  await writeFile(path.join(publish, relativePath), code);
}));
