import sharp from "sharp";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

function createSvg(size) {
  const fontSize = Math.round(size * 0.38);
  const borderRadius = Math.round(size * 0.18);
  const yOffset = Math.round(size * 0.58);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a73e8"/>
      <stop offset="100%" style="stop-color:#0d47a1"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${borderRadius}" ry="${borderRadius}" fill="url(#bg)"/>
  <text x="50%" y="${yOffset}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="900" font-size="${fontSize}px" fill="#ffffff" letter-spacing="${Math.round(size * 0.01)}">SKZ</text>
</svg>`;
}

const sizes = [16, 48, 128];

for (const size of sizes) {
  const svg = createSvg(size);
  await sharp(Buffer.from(svg))
    .png()
    .toFile(join(outDir, `icon${size}.png`));
  console.log(`Generated icon${size}.png`);
}

console.log("Done!");
