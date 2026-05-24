import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '../public/icons');

const sizes = [96, 144, 192, 512];

async function convertIcons() {
  // Ensure icons directory exists
  await mkdir(iconsDir, { recursive: true });

  // Convert each JPG to PNG
  for (const size of sizes) {
    const inputPath = join(iconsDir, `icon-${size}x${size}.jpg`);
    const outputPath = join(iconsDir, `icon-${size}x${size}.png`);
    
    try {
      await sharp(inputPath)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      console.log(`Created: icon-${size}x${size}.png`);
    } catch (err) {
      console.error(`Error converting ${size}x${size}:`, err.message);
    }
  }

  // Convert maskable icon
  try {
    await sharp(join(iconsDir, 'icon-maskable-512x512.jpg'))
      .resize(512, 512)
      .png()
      .toFile(join(iconsDir, 'icon-maskable-512x512.png'));
    console.log('Created: icon-maskable-512x512.png');
  } catch (err) {
    console.error('Error converting maskable icon:', err.message);
  }

  console.log('\nDone! Now update manifest.json to use .png extensions.');
}

convertIcons();
