import { readdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const EXCLUDED = new Set(['og-card.png']);

async function convert(input, output, format) {
  try {
    const image = sharp(input);
    if (format === 'avif') {
      await image.avif({ quality: 55, effort: 4 }).toFile(output);
    } else {
      await image.webp({ quality: 78, effort: 6 }).toFile(output);
    }
  } catch (error) {
    throw new Error(`Image optimization could not create ${path.basename(output)}: ${error.message}`, {
      cause: error,
    });
  }
}

export async function optimizeImages(imagesDirectory) {
  const pngs = (await readdir(imagesDirectory))
    .filter((name) => name.endsWith('.png') && !EXCLUDED.has(name));
  if (pngs.length === 0) return;

  await Promise.all(pngs.flatMap((fileName) => {
    const base = fileName.slice(0, -'.png'.length);
    const input = path.join(imagesDirectory, fileName);
    return ['avif', 'webp'].map((format) => (
      convert(input, path.join(imagesDirectory, `${base}.${format}`), format)
    ));
  }));
}
