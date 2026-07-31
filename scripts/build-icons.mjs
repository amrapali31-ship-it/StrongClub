/**
 * Rasterises the app mark into the PNG sizes that browsers and phones need.
 *
 *   npm run icons
 *
 * Edit `src/app/icon.svg` — that single file is the logo. Everything here is
 * generated from it, so re-run this after any change.
 *
 * Why PNGs at all: iOS ignores SVG for home-screen icons, and the web manifest
 * wants concrete raster sizes.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';

const SOURCE = path.join(process.cwd(), 'src', 'app', 'icon.svg');

const OUTPUTS = [
  // Next picks these up by filename convention and emits the right <link> tags.
  { file: path.join('src', 'app', 'apple-icon.png'), size: 180 },
  // Referenced by the web manifest.
  { file: path.join('public', 'icon-192.png'), size: 192 },
  { file: path.join('public', 'icon-512.png'), size: 512 },
];

const svg = await fs.readFile(SOURCE);

for (const { file, size } of OUTPUTS) {
  const out = path.join(process.cwd(), file);
  await fs.mkdir(path.dirname(out), { recursive: true });
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(out);
  console.log(`  ${file}  ${size}×${size}`);
}

console.log(`\nGenerated ${OUTPUTS.length} icons from src/app/icon.svg`);
