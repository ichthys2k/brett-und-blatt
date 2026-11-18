// Erzeugt die Pixelfiguren der Schach-Zeitmaschine (Jahrgang 1989, #512) aus den klassischen SVG-Figuren:
// jede Figur wird im Browser auf 16 × 16 Punkte verkleinert und in vier Graustufen eingeteilt.
// Aufruf: node scripts/schach-pixelfiguren.mjs  → packages/games/chess/src/ui/pixelfiguren.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const SIZE = 16;
const dir = new URL('../packages/games/chess/src/ui/figuren/', import.meta.url);
const out = new URL('../packages/games/chess/src/ui/pixelfiguren.ts', import.meta.url);
const browser = await chromium.launch(process.env.RAUCHTEST_CHROMIUM ? { executablePath: process.env.RAUCHTEST_CHROMIUM } : {});
const page = await browser.newPage();
const result = {};
for (const side of ['w', 'b']) {
  for (const type of ['k', 'q', 'r', 'b', 'n', 'p']) {
    // Ohne Bodenschatten, sonst wird er zu einer Pixelzeile.
    const svg = readFileSync(new URL(`classic-${type}-${side}.svg`, dir), 'utf8').replace(/<ellipse[^>]*\/>/, '');
    const rows = await page.evaluate(
      async ({ svg, size }) => {
        const img = new Image();
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;
        const grid = [];
        for (let y = 0; y < size; y++) {
          const row = [];
          for (let x = 0; x < size; x++) {
            const i = (y * size + x) * 4;
            const a = data[i + 3] / 255;
            if (a < 0.45) row.push(-1);
            else {
              const l = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
              row.push(l > 0.8 ? 0 : l > 0.55 ? 1 : l > 0.3 ? 2 : 3);
            }
          }
          grid.push(row);
        }
        return grid;
      },
      { svg, size: SIZE },
    );
    // Rand der Figur immer in der dunkelsten Stufe, damit sie sich vom Feld abhebt.
    const at = (x, y) => (rows[y]?.[x] ?? -1);
    const lines = rows.map((row, y) =>
      row
        .map((v, x) => {
          if (v < 0) return '.';
          const edge = at(x - 1, y) < 0 || at(x + 1, y) < 0 || at(x, y - 1) < 0 || at(x, y + 1) < 0;
          return String(edge ? 3 : v);
        })
        .join(''),
    );
    result[`${type}${side}`] = lines;
  }
}
await browser.close();
const body = Object.entries(result)
  .map(([key, lines]) => `  ${key}: [\n${lines.map((l) => `    '${l}',`).join('\n')}\n  ],`)
  .join('\n');
writeFileSync(
  out,
  `// Erzeugt von scripts/schach-pixelfiguren.mjs – nicht von Hand ändern.\n` +
    `// Je Figur 16 Zeilen zu 16 Punkten: '.' frei, 0 hell bis 3 dunkel. Schlüssel: Figur + Farbe (w/b).\n` +
    `export const PIXEL_PIECES: Record<string, string[]> = {\n${body}\n};\n`,
);
console.log('geschrieben:', out.pathname);
