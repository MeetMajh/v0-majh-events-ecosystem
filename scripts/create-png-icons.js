import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { join } from 'path';

const iconsDir = join(process.cwd(), 'public', 'icons');

// Create icons directory
await mkdir(iconsDir, { recursive: true });

// Create a simple gradient icon with "M" letter
const createIcon = async (size, filename, isMaskable = false) => {
  // Safe zone padding for maskable (40% inset means content in 60% center)
  const padding = isMaskable ? Math.floor(size * 0.2) : Math.floor(size * 0.1);
  const contentSize = size - (padding * 2);
  const fontSize = Math.floor(contentSize * 0.6);
  const textY = Math.floor(size / 2 + fontSize * 0.35);
  
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1a0e2e"/>
          <stop offset="100%" style="stop-color:#0a0a0a"/>
        </linearGradient>
        <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#d4af37"/>
          <stop offset="100%" style="stop-color:#b8860b"/>
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#bg)"/>
      <text 
        x="50%" 
        y="${textY}" 
        font-family="Arial Black, sans-serif" 
        font-size="${fontSize}" 
        font-weight="900" 
        fill="url(#gold)" 
        text-anchor="middle"
      >M</text>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(join(iconsDir, filename));
  
  console.log(`Created ${filename}`);
};

// Generate required icons
await createIcon(192, 'icon-192x192.png');
await createIcon(512, 'icon-512x512.png');
await createIcon(512, 'icon-maskable-512x512.png', true);

console.log('All PNG icons created successfully!');
