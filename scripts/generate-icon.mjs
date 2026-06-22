// 从 icon_1024.png 生成多尺寸 ICO 和缩略 PNG
import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '..', 'resources');
mkdirSync(outDir, { recursive: true });

const srcPng = resolve(outDir, 'icon_1024.png');

if (!existsSync(srcPng)) {
  const size = 1024;
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="180" fill="#2563eb"/>
      <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
        font-family="Segoe UI, Arial, sans-serif" font-size="360" font-weight="700" fill="#ffffff">AI</text>
    </svg>
  `;
  await sharp(Buffer.from(svg)).png().toFile(srcPng);
  console.log('✓ 已生成默认 icon_1024.png');
}

const icoSizes = [256, 128, 64, 48, 32, 16];

const tmpPaths = [];
for (const s of icoSizes) {
  const p = resolve(outDir, `_tmp_${s}.png`);
  await sharp(srcPng).resize(s, s).png().toFile(p);
  tmpPaths.push(p);
}

const icoBuf = await pngToIco(tmpPaths);
writeFileSync(resolve(outDir, 'icon.ico'), icoBuf);
console.log(`✓ icon.ico (${icoSizes.join(',')})`);

for (const p of tmpPaths) unlinkSync(p);

await sharp(srcPng).resize(512, 512).png().toFile(resolve(outDir, 'icon.png'));
console.log('✓ icon.png (512)');

console.log('Done → resources/icon.ico, resources/icon.png');
