import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const ICONS_DIR = path.join(process.cwd(), 'public', 'icons');

// MAJH EVENTS brand colors
const BACKGROUND_COLOR = '#1a0e2e'; // Deep purple
const ACCENT_COLOR = '#d4af37'; // Gold

// Create a simple "M" logo SVG
function createLogoSVG(size, padding = 0) {
  const innerSize = size - (padding * 2);
  const strokeWidth = Math.max(innerSize / 8, 4);
  
  return `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="${BACKGROUND_COLOR}"/>
      <g transform="translate(${padding}, ${padding})">
        <text 
          x="${innerSize/2}" 
          y="${innerSize * 0.72}" 
          font-family="Arial Black, sans-serif" 
          font-size="${innerSize * 0.6}" 
          font-weight="900"
          fill="${ACCENT_COLOR}" 
          text-anchor="middle"
        >M</text>
      </g>
    </svg>
  `;
}

async function generateIcons() {
  // Ensure icons directory exists
  if (!existsSync(ICONS_DIR)) {
    await mkdir(ICONS_DIR, { recursive: true });
  }

  const sizes = [
    { size: 192, name: 'icon-192x192.png', padding: 0 },
    { size: 512, name: 'icon-512x512.png', padding: 0 },
    { size: 512, name: 'icon-maskable-512x512.png', padding: 80 }, // 20% padding for maskable
  ];

  for (const { size, name, padding } of sizes) {
    const svg = createLogoSVG(size, padding);
    const outputPath = path.join(ICONS_DIR, name);
    
    await sharp(Buffer.from(svg))
      .png()
      .toFile(outputPath);
    
    console.log(`Generated: ${name} (${size}x${size})`);
  }

  console.log('\nAll PWA icons generated successfully!');
}

generateIcons().catch(console.error);
