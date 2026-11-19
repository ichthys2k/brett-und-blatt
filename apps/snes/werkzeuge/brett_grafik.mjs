#!/usr/bin/env node
/*
 * Erzeugt das dynamische Brett- & Tisch-Grafikpaket für Brett & Blatt 16:
 *   - Go 9×9: Warmes Kaya-Holzbrett (16×16 je Schnittpunkt, Ecken/Ränder/Mitte/Hoshi),
 *     glänzende schwarze Schiefer- und weiße Muschelsteine (16×16), goldener Zielcursor (16×16)
 *   - Domino: Echte Elfenbein-Dominosteine (16×8 Pixel) mit Augenpunkten 0–6 (und 7–12 für Doppel-9/12)
 *   - Mäxle: Klassischer Sattelleder-Würfelbecher (40×24 Pixel) für verdeckte Würfe
 *
 * Alle Kacheln liegen im dynamischen Spiel-VRAM ab Kachel 0x100.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ziel = resolve(dirname(fileURLToPath(import.meta.url)), '../res');
mkdirSync(ziel, { recursive: true });

const rgb15 = (r, g, b) => ((r >> 3) & 31) | (((g >> 3) & 31) << 5) | (((b >> 3) & 31) << 10);

const kacheln = [];
const konstanten = {};

function kachel4bpp(px, ox, oy, stride) {
  const b = Buffer.alloc(32);
  for (let y = 0; y < 8; y++) {
    let p0 = 0, p1 = 0, p2 = 0, p3 = 0;
    for (let x = 0; x < 8; x++) {
      const v = px[(oy + y) * stride + (ox + x)] & 15;
      const bit = 7 - x;
      if (v & 1) p0 |= 1 << bit;
      if (v & 2) p1 |= 1 << bit;
      if (v & 4) p2 |= 1 << bit;
      if (v & 8) p3 |= 1 << bit;
    }
    b[y * 2] = p0;
    b[y * 2 + 1] = p1;
    b[16 + y * 2] = p2;
    b[16 + y * 2 + 1] = p3;
  }
  return b;
}

function bild(name, w, h, malen) {
  const px = new Uint8Array(w * h);
  const set = (x, y, c) => {
    const ix = Math.round(x), iy = Math.round(y);
    if (ix >= 0 && ix < w && iy >= 0 && iy < h) px[iy * w + ix] = c;
  };
  const rect = (x, y, rw, rh, c) => {
    for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) set(x + i, y + j, c);
  };
  const kreis = (cx, cy, r, c) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r + 0.25) set(x, y, c);
  };
  malen({ set, rect, kreis, w, h });
  const basis = 0x100 + kacheln.length;
  konstanten[name] = basis;
  for (let ty = 0; ty < h; ty += 8)
    for (let tx = 0; tx < w; tx += 8)
      kacheln.push(kachel4bpp(px, tx, ty, w));
}

/*
 * 16-Farben-Palette für Go, Domino & Mäxle:
 *  0 = transparent
 *  1 = Tiefschwarz / Gitterlinie / Schieferstein-Kern (#1a181c)
 *  2 = Kaya-Holz hell (#e4b668)
 *  3 = Kaya-Holz mittel / Maserung (#cfa050)
 *  4 = Kaya-Holz dunkel / Rahmen (#96682c)
 *  5 = Elfenbein hell (Domino / weißer Stein) (#fbf6e8)
 *  6 = Elfenbein Schatten (#d4ccb4)
 *  7 = Stein-Glanz / Weiß-Highlight (#ffffff)
 *  8 = Schiefer-Glanz (dunkelgrau) (#505664)
 *  9 = Goldgelb (Cursor / Becher-Zierband) (#f4c438)
 * 10 = Hellgold (#fff098)
 * 11 = Sattelleder mittel (Mäxle-Becher) (#8c4420)
 * 12 = Sattelleder dunkel (#582810)
 * 13 = Sattelleder Glanz (#b86838)
 * 14 = Karmesinrot (Domino-Markierung / 1er-Auge) (#cc2830)
 * 15 = Königsblau (Domino-Farbwert) (#2c60b0)
 */
function palBauen(elfenbein, rand, akzent) {
  const f = [
    [0, 0, 0],
    [26, 24, 28],
    [228, 182, 104],
    [207, 160, 80],
    rand,
    elfenbein,
    [212, 204, 180],
    [255, 255, 255],
    [80, 86, 100],
    akzent,
    [255, 240, 152],
    [140, 68, 32],
    [88, 40, 16],
    [184, 104, 56],
    [204, 40, 48],
    [44, 96, 176],
  ];
  const buf = Buffer.alloc(32);
  f.forEach(([r, g, b], i) => buf.writeUInt16LE(rgb15(r, g, b), i * 2));
  return buf;
}

const palNormal = palBauen([251, 246, 232], [150, 104, 44], [244, 196, 56]);
const palAuswahl = palBauen([255, 244, 196], [244, 196, 56], [255, 240, 128]);
const palMark = palBauen([228, 240, 255], [96, 168, 244], [140, 212, 255]);

/* ======================== 1. GO: KAYA-HOLZBRETT & STEINE ======================== */
function kayaGrund({ set }, oben, unten, links, rechts, hoshi) {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const m = ((y * 3 + Math.floor(Math.sin(x * 0.45) * 2) + 8) % 5 === 0) ? 3 : 2;
      set(x, y, m);
    }
  }
  // Gitterlinien kreuzen sich exakt bei (7..8, 7..8)
  const x0 = links ? 0 : 7;
  const x1 = rechts ? 15 : 8;
  const y0 = oben ? 0 : 7;
  const y1 = unten ? 15 : 8;
  for (let x = x0; x <= x1; x++) set(x, 7, 1);
  for (let y = y0; y <= y1; y++) set(7, y, 1);
  if (hoshi) {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) set(7 + dx, 7 + dy, 1);
  }
}

bild('BRETT_GO_MITTE', 16, 16, (g) => kayaGrund(g, 1, 1, 1, 1, 0));
bild('BRETT_GO_HOSHI', 16, 16, (g) => kayaGrund(g, 1, 1, 1, 1, 1));
bild('BRETT_GO_OL', 16, 16, (g) => kayaGrund(g, 0, 1, 0, 1, 0));
bild('BRETT_GO_OR', 16, 16, (g) => kayaGrund(g, 0, 1, 1, 0, 0));
bild('BRETT_GO_UL', 16, 16, (g) => kayaGrund(g, 1, 0, 0, 1, 0));
bild('BRETT_GO_UR', 16, 16, (g) => kayaGrund(g, 1, 0, 1, 0, 0));
bild('BRETT_GO_OBEN', 16, 16, (g) => kayaGrund(g, 0, 1, 1, 1, 0));
bild('BRETT_GO_UNTEN', 16, 16, (g) => kayaGrund(g, 1, 0, 1, 1, 0));
bild('BRETT_GO_LINKS', 16, 16, (g) => kayaGrund(g, 1, 1, 0, 1, 0));
bild('BRETT_GO_RECHTS', 16, 16, (g) => kayaGrund(g, 1, 1, 1, 0, 0));

bild('BRETT_GO_SCHWARZ', 16, 16, ({ kreis, set }) => {
  kreis(8, 8, 6.4, 4); // weicher Schatten auf Holz
  kreis(7.5, 7.5, 6.2, 1);
  kreis(5.5, 5.5, 2.0, 8);
  set(5, 4, 7); set(6, 4, 7); set(4, 5, 7);
});

bild('BRETT_GO_WEISS', 16, 16, ({ kreis, set }) => {
  kreis(8, 8, 6.4, 4); // Schatten
  kreis(7.5, 7.5, 6.2, 1); // Kontur
  kreis(7.5, 7.5, 5.4, 6); // Muschel-Schatten
  kreis(7.0, 7.0, 4.6, 5); // Elfenbein
  kreis(5.5, 5.5, 2.0, 7); // Glanzpunkt
  set(5, 4, 7);
});

bild('BRETT_GO_CURSOR', 16, 16, ({ rect, set }) => {
  // Goldene Ecken als Zielcursor auf Ebene 1
  rect(0, 0, 5, 2, 9); rect(0, 0, 2, 5, 9); set(1, 1, 10);
  rect(11, 0, 5, 2, 9); rect(14, 0, 2, 5, 9); set(14, 1, 10);
  rect(0, 14, 5, 2, 9); rect(0, 11, 2, 5, 9); set(1, 14, 10);
  rect(11, 14, 5, 2, 9); rect(14, 11, 2, 5, 9); set(14, 14, 10);
});

bild('BRETT_GO_RAHMEN', 8, 8, ({ rect, set }) => {
  rect(0, 0, 8, 8, 4);
  for (let y = 0; y < 8; y += 2) for (let x = 0; x < 8; x += 3) set(x, y, 12);
});

/* ======================== 2. DOMINO: ECHTE ELFENBEINSTEINE ======================== */
const AUGEN = [
  [],
  [[3, 3]],
  [[1, 1], [5, 5]],
  [[1, 1], [3, 3], [5, 5]],
  [[1, 1], [5, 1], [1, 5], [5, 5]],
  [[1, 1], [5, 1], [3, 3], [1, 5], [5, 5]],
  [[1, 1], [3, 1], [5, 1], [1, 5], [3, 5], [5, 5]],
];

// Kompakte 3×5-Ziffern für Werte 7..12 (Doppel-9/12-Satz)
const ZIFFERN_3X5 = {
  7: ['111', '001', '010', '010', '010'],
  8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'],
  10: ['1011', '1011', '1011', '1011', '1011'], // kompakt 4px
  11: ['101', '101', '101', '101', '101'],
  12: ['1011', '1001', '1011', '1010', '1011'],
};

function dominoHaelfte(g, wert, istLinks) {
  const { rect, set } = g;
  // Elfenbeinkörper mit dunklem Außenrand und Mittelstrich
  rect(0, 0, 8, 8, 5);
  rect(0, 0, 8, 1, 4); // oben
  rect(0, 7, 8, 1, 4); // unten
  rect(0, 6, 8, 1, 6); // zarte 3D-Schattierung unten
  if (istLinks) {
    rect(0, 0, 1, 8, 4); // linker Rand
    rect(7, 1, 1, 6, 6); // halber Mittelstrich
  } else {
    rect(7, 0, 1, 8, 4); // rechter Rand
    rect(0, 1, 1, 6, 4); // Mittelstrich
  }
  const ox = istLinks ? 1 : 1;
  if (wert <= 6) {
    const col = wert === 1 ? 14 : wert === 6 ? 15 : 1;
    for (const [px, py] of AUGEN[wert]) {
      set(ox + px, 1 + py, col);
      if (wert === 1) {
        set(ox + px - 1, 1 + py, col);
        set(ox + px + 1, 1 + py, col);
        set(ox + px, 1 + py - 1, col);
        set(ox + px, 1 + py + 1, col);
      }
    }
  } else {
    const pat = ZIFFERN_3X5[wert];
    const col = wert >= 10 ? 14 : 15;
    const sx = pat[0].length === 4 ? 2 : 2;
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < pat[r].length; c++)
        if (pat[r][c] === '1') set(sx + c, 1 + r, col);
  }
}

for (let w = 0; w <= 12; w++) {
  bild(`BRETT_DOMINO_L_${w}`, 8, 8, (g) => dominoHaelfte(g, w, true));
}
for (let w = 0; w <= 12; w++) {
  bild(`BRETT_DOMINO_R_${w}`, 8, 8, (g) => dominoHaelfte(g, w, false));
}

/* ======================== 3. MÄXLE: LEDER-WÜRFELBECHER (40×24 = 5×3) ======================== */
bild('BRETT_MAEXLE_BECHER', 40, 24, ({ rect, set }) => {
  // Trapezförmiger klassischer Lederbecher mit Goldrand & Schatten
  for (let y = 2; y < 22; y++) {
    const t = (y - 2) / 19;
    const x0 = Math.round(8 - t * 5);
    const x1 = Math.round(31 + t * 5);
    for (let x = x0; x <= x1; x++) {
      let c = 11;
      if (x === x0 || x === x1 || y === 2 || y === 21) c = 1;
      else if (x < x0 + 4) c = 13; // Glanzstreifen links
      else if (x > x1 - 4) c = 12; // Schatten rechts
      set(x, y, c);
    }
  }
  // Goldene Zierbänder oben & unten
  rect(8, 4, 24, 2, 9);
  rect(10, 4, 5, 1, 10);
  rect(5, 18, 30, 2, 9);
  rect(7, 18, 6, 1, 10);
  // Deckel-Oval oben
  rect(9, 1, 22, 2, 12);
  rect(11, 1, 18, 1, 13);
  // Kleines Fragezeichen-Emblem in der Mitte des Bechers
  rect(18, 8, 4, 1, 10);
  rect(21, 9, 1, 2, 10);
  rect(19, 11, 2, 2, 10);
  rect(19, 14, 2, 2, 10);
  // Bodenschatten
  rect(4, 22, 32, 2, 12);
});

const bgBin = Buffer.concat(kacheln);
const palBin = Buffer.concat([palNormal, palAuswahl, palMark]);
writeFileSync(resolve(ziel, 'brett_bg.bin'), bgBin);
writeFileSync(resolve(ziel, 'brett_bg_pal.bin'), palBin);

const header = [
  '/* Automatisch erzeugt von werkzeuge/brett_grafik.mjs – nicht von Hand bearbeiten. */',
  '#ifndef BRETT_GRAFIK_H',
  '#define BRETT_GRAFIK_H',
  '',
  ...Object.entries(konstanten).map(([k, v]) => `#define ${k} 0x${v.toString(16)}`),
  '#define BRETT_DOMINO_L_BASIS BRETT_DOMINO_L_0',
  '#define BRETT_DOMINO_R_BASIS BRETT_DOMINO_R_0',
  '',
  '#endif',
  '',
].join('\n');
writeFileSync(resolve(ziel, 'brett_grafik.h'), header);

console.log(`brett_grafik.mjs: ${kacheln.length} BG-Kacheln (${bgBin.length} B), 3 Paletten (${palBin.length} B)`);
