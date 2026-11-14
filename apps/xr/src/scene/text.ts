/**
 * Schrift und Emoji in 3D: auf eine Leinwand gemalt und als Textur verwendet. So braucht die
 * App keine Schriftdatei aus dem Netz; Emoji kommen aus der Systemschrift des Browsers.
 */
import { CanvasTexture, SRGBColorSpace } from 'three';

export const INK = '#f6ead2';
export const WOOD = '#5a3b22';
export const WOOD_DARK = '#3f2a18';
export const GOLD = '#e6b450';
export const GREEN = '#2f5d3a';
export const WINE = '#a32a1c';
export const PARCHMENT = '#efe3c8';

export interface LabelStyle {
  width?: number;
  height?: number;
  background?: string | null;
  color?: string;
  border?: string | null;
  font?: number;
  align?: CanvasTextAlign;
}

const cache = new Map<string, CanvasTexture>();

/** Eine Textur mit einer oder mehreren Zeilen; gleiche Inhalte teilen sich eine Textur. */
export function labelTexture(lines: string[], style: LabelStyle = {}): CanvasTexture {
  const { width = 512, height = 128, background = WOOD_DARK, color = INK, border = GOLD, font = 44, align = 'center' } = style;
  const key = JSON.stringify([lines, width, height, background, color, border, font, align]);
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  if (background) {
    ctx.fillStyle = background;
    roundRect(ctx, 4, 4, width - 8, height - 8, 24);
    ctx.fill();
  }
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = 6;
    roundRect(ctx, 6, 6, width - 12, height - 12, 22);
    ctx.stroke();
  }
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  const lineHeight = height / Math.max(lines.length, 1);
  lines.forEach((line, i) => {
    let size = font;
    ctx.font = `600 ${size}px system-ui, "Noto Color Emoji", "Apple Color Emoji", sans-serif`;
    // Zu lange Zeilen verkleinern statt abschneiden.
    while (ctx.measureText(line).width > width - 40 && size > 14) {
      size -= 2;
      ctx.font = `600 ${size}px system-ui, "Noto Color Emoji", "Apple Color Emoji", sans-serif`;
    }
    const x = align === 'left' ? 24 : align === 'right' ? width - 24 : width / 2;
    ctx.fillText(line, x, lineHeight * (i + 0.5));
  });
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  if (cache.size > 300) cache.clear();
  cache.set(key, texture);
  return texture;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

let woodCache: CanvasTexture | null = null;

/** Gemalte Holzmaserung für Tisch und Boden (kein Fremdmodell nötig). */
export function woodTexture(): CanvasTexture {
  if (woodCache) return woodCache;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#6b4728';
  ctx.fillRect(0, 0, 512, 512);
  // Bretter mit leicht verschiedenen Tönen und feinen Maserungslinien; fester Ablauf statt Zufall.
  for (let plank = 0; plank < 8; plank++) {
    const shade = 90 + ((plank * 37) % 30);
    ctx.fillStyle = `rgb(${shade + 10}, ${Math.round(shade * 0.66)}, ${Math.round(shade * 0.38)})`;
    ctx.fillRect(plank * 64, 0, 62, 512);
    for (let line = 0; line < 14; line++) {
      ctx.strokeStyle = `rgba(40, 24, 12, ${0.12 + ((line * 7) % 5) / 40})`;
      ctx.lineWidth = 1 + (line % 3);
      ctx.beginPath();
      const x = plank * 64 + 4 + ((line * 13) % 56);
      ctx.moveTo(x, 0);
      for (let y = 0; y <= 512; y += 32) ctx.lineTo(x + Math.sin((y + line * 40 + plank * 90) / 70) * 3, y);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(30, 18, 10, 0.6)';
    ctx.fillRect(plank * 64 + 62, 0, 2, 512);
  }
  woodCache = new CanvasTexture(canvas);
  woodCache.colorSpace = SRGBColorSpace;
  return woodCache;
}
