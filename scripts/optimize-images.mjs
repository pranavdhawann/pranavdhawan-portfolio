import path from 'node:path';
import sharp from 'sharp';

const imageNames = [
  'photo',
  'eye',
  'stockscreen',
  'multimodal',
  'pii',
  'weather-dashboard',
];

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
  await Promise.all(imageNames.flatMap((imageName) => {
    const input = path.join(imagesDirectory, `${imageName}.png`);
    return ['avif', 'webp'].map((format) => (
      convert(input, path.join(imagesDirectory, `${imageName}.${format}`), format)
    ));
  }));
}
