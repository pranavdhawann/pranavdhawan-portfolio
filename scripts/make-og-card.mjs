// One-off generator for the 1200x630 social share card (images/og-card.png).
// Run with: node scripts/make-og-card.mjs
// The output is committed; it is not part of the Netlify build.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const images = path.join(root, 'images');

const avatar = await readFile(path.join(images, 'photo.png'));
const avatarUri = `data:image/png;base64,${avatar.toString('base64')}`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#FFF8E1"/>
  <rect x="24" y="24" width="1152" height="582" fill="#FFF8E1" stroke="#1A1A1A" stroke-width="10"/>
  <rect x="60" y="60" width="14" height="510" fill="#FFD600" stroke="#1A1A1A" stroke-width="4"/>

  <g font-family="'Space Grotesk','DejaVu Sans',sans-serif">
    <rect x="110" y="92" width="250" height="52" fill="#FFD600" stroke="#1A1A1A" stroke-width="4"/>
    <text x="130" y="128" font-size="26" font-weight="700" fill="#1A1A1A" letter-spacing="2">AI ENGINEER</text>

    <text x="108" y="250" font-size="82" font-weight="800" fill="#1A1A1A">Pranav Dhawan</text>
    <text x="110" y="300" font-size="30" font-weight="500" fill="#4A4A4A">MS Data Science @ GWU &#183; Washington DC</text>

    <g font-size="30" font-weight="600" fill="#1A1A1A">
      <text x="110" y="392">&#8226; ~70% of monthly service-desk tickets automated</text>
      <text x="110" y="446">&#8226; 98.1% F1 across 54 PII entity types</text>
      <text x="110" y="500">&#8226; ML pipelines over 10,000+ documents</text>
    </g>
  </g>

  <rect x="864" y="176" width="248" height="248" fill="#7C4DFF" stroke="#1A1A1A" stroke-width="8"/>
  <rect x="848" y="160" width="248" height="248" fill="#FFD600" stroke="#1A1A1A" stroke-width="8"/>
  <clipPath id="avatarClip"><rect x="856" y="168" width="232" height="232"/></clipPath>
  <image x="856" y="168" width="232" height="232" href="${avatarUri}" clip-path="url(#avatarClip)" preserveAspectRatio="xMidYMid slice"/>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(path.join(images, 'og-card.png'));
console.log('Wrote images/og-card.png (1200x630)');
