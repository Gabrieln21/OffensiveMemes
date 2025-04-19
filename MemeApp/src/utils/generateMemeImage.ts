// src/utils/generateMemeImage.ts
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface Caption {
  text: string;
  top: string; // in px
  left: string; // in px
  fontSize?: string; // in px
  fontFamily?: string;
  color?: string;
  width?: string; // in px
}

export async function generateMemeImage(
  gameId: string,
  templateUrl: string,
  captions: Caption[]
): Promise<string> {
  const normalizedPath = templateUrl.replace(/^\/+/, '');
  const fullPath = path.join(process.cwd(), 'src', 'public', normalizedPath);
  console.log('🧭 Loading template from:', fullPath);

  const image = await loadImage(fullPath);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  captions.forEach((caption, i) => {
    const text = caption.text || '';
    if (!text.trim()) return;

    const fontSize = parseFloat(caption.fontSize?.replace('px', '') || '36');
    const left = parseFloat(caption.left?.replace('px', '') || '0');
    const top = parseFloat(caption.top?.replace('px', '') || '0');
    const fontFamily = caption.fontFamily || 'Impact';
    const color = caption.color || '#ffffff';
    const maxWidth = parseFloat(caption.width?.replace('px', '') || '300');

    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'top';

    const lineHeight = fontSize * 1.2;
    let y = top;

    console.log(`🖍️ Rendering caption[${i}]: "${text}"`);
    console.log(`🧮 top: ${top}, left: ${left}, fontSize: ${fontSize}px, font: ${fontFamily}, maxWidth: ${maxWidth}`);

    let currentLine = '';
    for (let char of text) {
      const testLine = currentLine + char;
      const testWidth = ctx.measureText(testLine).width;
      if (testWidth > maxWidth && currentLine.length > 0) {
        ctx.fillText(currentLine, left, y);
        y += lineHeight;
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      ctx.fillText(currentLine, left, y);
    }
  });

  const filename = `meme-${gameId}-${uuidv4()}.png`; // ✅ Now safe
  const relativePath = `/generated/${filename}`;
  const outputDir = path.resolve('src/public/generated');
  const outPath = path.resolve(outputDir, filename);

  fs.mkdirSync(outputDir, { recursive: true });

  return new Promise((resolve, reject) => {
    const out = fs.createWriteStream(outPath);
    const stream = canvas.createPNGStream();

    stream.pipe(out);

    out.on('finish', () => {
      console.log('✅ Meme image saved at:', outPath);
      resolve(relativePath);
    });

    out.on('error', (err) => {
      console.error('❌ Error saving meme image:', err);
      reject(new Error('Failed to save meme image'));
    });
  });
}

