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

/** The mark's own background, used to fill the corners. Keep in sync with the SVG. */
const BRAND = '#ff4d9d';

const OUTPUTS = [
  // Next picks this up by filename convention and emits the apple-touch-icon link.
  { file: path.join('src', 'app', 'apple-icon.png'), size: 180 },
  // Referenced by the web manifest.
  { file: path.join('public', 'icon-192.png'), size: 192 },
  { file: path.join('public', 'icon-512.png'), size: 512 },
];

const svg = await fs.readFile(SOURCE);

for (const { file, size } of OUTPUTS) {
  const out = path.join(process.cwd(), file);
  await fs.mkdir(path.dirname(out), { recursive: true });

  await sharp(svg, { density: 384 })
    .resize(size, size)
    // Full-bleed square, no alpha. The SVG has its own rounded corners for the
    // browser tab, but a home-screen icon must not: iOS paints transparency
    // black and then applies its own mask, which would leave dark wedges in
    // the corners. Filling them with the brand colour lets the mask cut clean.
    .flatten({ background: BRAND })
    .png()
    .toFile(out);

  console.log(`  ${file}  ${size}×${size}`);
}

console.log(`\nGenerated ${OUTPUTS.length} icons from src/app/icon.svg`);
