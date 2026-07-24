import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform as transformJavaScript } from 'esbuild';
import { transform as transformCss } from 'lightningcss';
import { optimizeImages } from './optimize-images.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publish = path.join(root, 'public');
const assets = [
  'index.html',
  'styles.css',
  'script.js',
  'theme-init.js',
  'Pranav_Dhawan_Resume.pdf',
  'robots.txt',
  'sitemap.xml',
  'privacy.html',
  'images',
  'blog',
];
const browserScripts = ['script.js', 'theme-init.js', 'blog/newsletter.js'];
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

await Promise.all(browserScripts.map(async (relativePath) => {
  const sourcePath = path.join(root, relativePath);
  const { code } = await transformJavaScript(await readFile(sourcePath, 'utf8'), {
    minify: true,
    target: 'es2020',
    legalComments: 'none',
  });
  await writeFile(path.join(publish, relativePath), code);
}));
