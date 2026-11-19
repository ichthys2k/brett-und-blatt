#!/usr/bin/env node
/*
 * Erzeugt das dynamische Spielkarten-Grafikpaket für Brett & Blatt 16:
 *   - Edle 24×32-Kartenkörper (Elfenbein-Blanko, königsblauer Filigran-Rücken, Ablage-Leerfeld)
 *   - Große, gestochen scharfe 24×16-Farbsymbole (Kreuz, Karo, Herz, Pik)
 *   - 4 prunkvolle Schmuck-Asse mit goldenem Zierkranz
 *   - 3 echte Hofkarten-Porträts (Bube mit Barett & Hellebarde, Dame mit Tiara & Rose,
 *     König mit Goldkrone & Zepter)
 *   - 5 Eins!/Uno-Aktions-Motive (Aussetzen, Richtungswechsel, +2, 4-Farben-Rad, +4)
 *   - Schwarzer-Peter-Kater + 8 bunte Paar-Symbole (Krone, Sonne, Stern, Blume, Haus, Herz, Anker, Mond)
 *
 * Alle Kacheln liegen im dynamischen Spiel-VRAM ab Kachel 0x100 (bis 768 Kacheln = 24 KB).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ziel = resolve(dirname(fileURLToPath(import.meta.url)), '../res');
mkdirSync(ziel, { recursive: true });

const rgb15 = (r, g, b) => ((r >> 3) & 31) | (((g >> 3) & 31) << 5) | (((b >> 3) & 31) << 10);

/* 4bpp-Kachel-Codierung */
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

function bildRegistrieren(name, w, h, malen) {
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
  const linie = (x0, y0, x1, y1, c) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) set(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
  };
  malen({ set, rect, kreis, linie, px, w, h });
  const basis = 0x100 + kacheln.length;
  konstanten[name] = basis;
  for (let ty = 0; ty < h; ty += 8)
    for (let tx = 0; tx < w; tx += 8)
      kacheln.push(kachel4bpp(px, tx, ty, w));
}

/*
 * 16-Farben-Spielkarten-Palette:
 *  0 = transparent
 *  1 = Tiefschwarz / dunkle Kontur (#1a1820)
 *  2 = Elfenbein-Papier (#fbf6e9)
 *  3 = Warmes Pergament / Schattierung (#e4d8be)
 *  4 = Kartenrahmen (normal: Dunkelbraun-Gold; Auswahl: Leuchtgold; Markiert: Hellblau)
 *  5 = Karmesinrot (Herz/Karo/Kleid) (#cc242c)
 *  6 = Hellrot-Glanz (#f46060)
 *  7 = Anthrazit-Pik/Kreuz (#262a34)
 *  8 = Königsblau (Rücken/Buben-Wams) (#26529a)
 *  9 = Hellblau-Glanz (#5c94dc)
 * 10 = Goldgelb (Krone/Zierrahmen/Sonne) (#eab830)
 * 11 = Hellgold-Glanz (#fff098)
 * 12 = Warmbraun (Haare/Holz/Zepter) (#784824)
 * 13 = Hautton (Gesichter der Hofkarten) (#f4c49c)
 * 14 = Smaragdgrün (Laub/Uno-Grün) (#2a9648)
 * 15 = Silbergrau (Glanz/Rüstung/Muster) (#b8c0cc)
 */
function paletteBauen(rahmenFarbe, papierFarbe, schattenFarbe) {
  const farben = [
    [0, 0, 0],
    [26, 24, 32],
    papierFarbe,
    schattenFarbe,
    rahmenFarbe,
    [204, 36, 44],
    [244, 96, 96],
    [38, 42, 52],
    [38, 82, 154],
    [92, 148, 220],
    [234, 184, 48],
    [255, 240, 152],
    [120, 72, 36],
    [244, 196, 156],
    [42, 150, 72],
    [184, 192, 204],
  ];
  const buf = Buffer.alloc(32);
  farben.forEach(([r, g, b], i) => buf.writeUInt16LE(rgb15(r, g, b), i * 2));
  return buf;
}

const palNormal = paletteBauen([96, 78, 52], [251, 246, 233], [228, 216, 190]);
const palAuswahl = paletteBauen([248, 204, 52], [255, 250, 236], [238, 224, 186]);
const palMark = paletteBauen([112, 188, 248], [236, 244, 252], [206, 220, 236]);

/* 1. Kartenkörper (24×32 = 3×4 Kacheln) */
bildRegistrieren('KARTEN_BG_BLANKO', 24, 32, ({ set, rect }) => {
  // Grundfläche mit abgerundeten Ecken
  rect(1, 0, 22, 32, 4);
  rect(0, 1, 24, 30, 4);
  rect(1, 1, 22, 30, 2);
  // Dezente 3D-Schattierung rechts & unten
  rect(22, 2, 1, 28, 3);
  rect(2, 30, 21, 1, 3);
  // Zarter Pergament-Innenrahmen um die Bildmitte
  rect(2, 8, 20, 1, 3);
  rect(2, 23, 20, 1, 3);
  set(0, 0, 0); set(23, 0, 0); set(0, 31, 0); set(23, 31, 0);
});

bildRegistrieren('KARTEN_BG_RUECKEN', 24, 32, ({ set, rect }) => {
  rect(1, 0, 22, 32, 4);
  rect(0, 1, 24, 30, 4);
  rect(1, 1, 22, 30, 2);
  // Königsblauer Rücken mit goldenem Zierrahmen
  rect(2, 2, 20, 28, 8);
  rect(3, 3, 18, 1, 10);
  rect(3, 28, 18, 1, 10);
  rect(3, 3, 1, 26, 10);
  rect(20, 3, 1, 26, 10);
  // Filigranes Rautenmuster
  for (let y = 5; y < 27; y++) {
    for (let x = 5; x < 19; x++) {
      if (((x + y) & 3) === 0 || ((x - y + 32) & 3) === 0) set(x, y, 9);
    }
  }
  // Goldenes Mittelmedaillon
  for (let dy = -4; dy <= 4; dy++) {
    const hw = 4 - Math.abs(dy);
    for (let dx = -hw; dx <= hw; dx++) set(12 + dx, 16 + dy, Math.abs(dx) === hw ? 10 : 11);
  }
  set(12, 16, 5);
  set(0, 0, 0); set(23, 0, 0); set(0, 31, 0); set(23, 31, 0);
});

bildRegistrieren('KARTEN_BG_LEER', 24, 32, ({ set }) => {
  // Gestrichelter Ablage-Rahmen
  for (let x = 2; x < 22; x += 2) { set(x, 1, 4); set(x, 30, 4); }
  for (let y = 2; y < 30; y += 2) { set(1, y, 4); set(22, y, 4); }
});

/* Hilfsfunktionen für große Farbsymbole (zentriert in 24×16) */
function zeichneHerz(g, cx, cy, r = 5) {
  const { set, kreis } = g;
  kreis(cx - 3, cy - 2, 3, 5);
  kreis(cx + 3, cy - 2, 3, 5);
  for (let dy = 0; dy <= r + 1; dy++) {
    const hw = Math.max(0, 6 - dy);
    for (let dx = -hw; dx <= hw; dx++) set(cx + dx, cy + dy - 1, 5);
  }
  set(cx - 4, cy - 3, 6); set(cx - 3, cy - 4, 6);
}

function zeichneKaro(g, cx, cy, r = 6) {
  const { set } = g;
  for (let dy = -r; dy <= r; dy++) {
    const hw = Math.max(0, Math.round((r - Math.abs(dy)) * 0.85));
    for (let dx = -hw; dx <= hw; dx++) set(cx + dx, cy + dy, dx < 0 && dy < 0 ? 6 : 5);
  }
}

function zeichnePik(g, cx, cy) {
  const { set, rect, kreis } = g;
  for (let dy = -6; dy <= 0; dy++) {
    const hw = Math.max(0, 6 + dy);
    for (let dx = -hw; dx <= hw; dx++) set(cx + dx, cy + dy, 7);
  }
  kreis(cx - 3, cy + 1, 3, 7);
  kreis(cx + 3, cy + 1, 3, 7);
  rect(cx - 1, cy + 2, 3, 4, 7);
  rect(cx - 3, cy + 5, 7, 1, 7);
  set(cx - 2, cy - 2, 15); set(cx - 1, cy - 3, 15);
}

function zeichneKreuz(g, cx, cy) {
  const { set, rect, kreis } = g;
  kreis(cx, cy - 3, 3, 7);
  kreis(cx - 4, cy + 1, 3, 7);
  kreis(cx + 4, cy + 1, 3, 7);
  rect(cx - 1, cy, 3, 6, 7);
  rect(cx - 3, cy + 5, 7, 1, 7);
  set(cx - 1, cy - 4, 15); set(cx - 5, cy, 15);
}

/* 2. Große Farbsymbole (24×16 = 3×2 Kacheln) */
bildRegistrieren('KARTEN_BG_KREUZ', 24, 16, (g) => zeichneKreuz(g, 12, 8));
bildRegistrieren('KARTEN_BG_KARO', 24, 16, (g) => zeichneKaro(g, 12, 8));
bildRegistrieren('KARTEN_BG_HERZ', 24, 16, (g) => zeichneHerz(g, 12, 8));
bildRegistrieren('KARTEN_BG_PIK', 24, 16, (g) => zeichnePik(g, 12, 8));

/* 3. Prunkvolle Schmuck-Asse mit goldenem Lorbeerkranz (24×16) */
function schmuckRahmen({ set }) {
  for (let x = 3; x <= 20; x++) {
    if ((x & 1) === 0) { set(x, 0, 10); set(x, 15, 10); }
    else { set(x, 1, 11); set(x, 14, 11); }
  }
  for (let y = 2; y <= 13; y++) {
    set(2, y, (y & 1) ? 10 : 14);
    set(21, y, (y & 1) ? 10 : 14);
  }
  set(3, 1, 10); set(20, 1, 10); set(3, 14, 10); set(20, 14, 10);
}

bildRegistrieren('KARTEN_BG_ASS_KREUZ', 24, 16, (g) => { schmuckRahmen(g); zeichneKreuz(g, 12, 8); });
bildRegistrieren('KARTEN_BG_ASS_KARO', 24, 16, (g) => { schmuckRahmen(g); zeichneKaro(g, 12, 8, 5); });
bildRegistrieren('KARTEN_BG_ASS_HERZ', 24, 16, (g) => { schmuckRahmen(g); zeichneHerz(g, 12, 8, 4); });
bildRegistrieren('KARTEN_BG_ASS_PIK', 24, 16, (g) => { schmuckRahmen(g); zeichnePik(g, 12, 8); });

/* 4. Echte Hofkarten-Porträts (24×16 = 3×2 Kacheln) */
function hofRahmen({ rect, set }) {
  // Feiner goldener Porträtrahmen links/rechts
  rect(2, 0, 1, 16, 10);
  rect(21, 0, 1, 16, 10);
  set(3, 0, 10); set(20, 0, 10); set(3, 15, 10); set(20, 15, 10);
}

// Bube: Edelknappe mit Federbarett, blau-goldenem Wams & Hellebarde
bildRegistrieren('KARTEN_BG_BUBE', 24, 16, (g) => {
  const { set, rect, linie } = g;
  hofRahmen(g);
  // Federbarett (blau mit goldener Feder)
  rect(7, 1, 9, 2, 8);
  rect(8, 0, 7, 1, 9);
  set(15, 0, 11); set(16, 1, 10);
  // Gesicht & Haare
  rect(8, 3, 7, 5, 13);
  rect(7, 3, 1, 3, 12); rect(15, 3, 1, 3, 12);
  set(10, 5, 1); set(13, 5, 1); // Augen
  set(11, 7, 5); set(12, 7, 5); // Mund
  // Kragen & Wams (Königsblau + Rot/Gold-Schärpe)
  rect(7, 8, 9, 2, 2);
  rect(6, 10, 11, 6, 8);
  rect(10, 10, 3, 6, 5);
  rect(6, 13, 11, 1, 10);
  // Hellebarde rechts
  linie(18, 1, 18, 15, 12);
  rect(17, 2, 3, 3, 15);
  set(19, 1, 15);
});

// Dame: Königin mit goldener Tiara, langem Haar, Karmesin-Kleid & Rose
bildRegistrieren('KARTEN_BG_DAME', 24, 16, (g) => {
  const { set, rect } = g;
  hofRahmen(g);
  // Goldene Tiara mit Rubin
  rect(8, 1, 8, 2, 10);
  set(9, 0, 11); set(12, 0, 11); set(15, 0, 11);
  set(12, 1, 5);
  // Langes braunes Haar & Gesicht
  rect(7, 3, 10, 6, 12);
  rect(9, 3, 6, 5, 13);
  set(10, 5, 1); set(13, 5, 1);
  set(11, 7, 5); set(12, 7, 5);
  // Perlenkette & Karmesin-Kleid
  rect(8, 9, 8, 1, 11);
  rect(6, 10, 12, 6, 5);
  rect(10, 10, 4, 6, 6);
  rect(9, 10, 1, 6, 10); rect(14, 10, 1, 6, 10);
  // Rose links
  rect(4, 9, 2, 2, 5); set(5, 8, 6);
  rect(4, 11, 1, 4, 14); set(5, 12, 14);
});

// König: Bärtiger Herrscher mit großer Goldkrone, Purpurmantel & Zepter
bildRegistrieren('KARTEN_BG_KOENIG', 24, 16, (g) => {
  const { set, rect, linie } = g;
  hofRahmen(g);
  // Große Goldkrone
  rect(7, 1, 10, 2, 10);
  set(7, 0, 11); set(10, 0, 11); set(13, 0, 11); set(16, 0, 11);
  set(11, 1, 5); set(12, 1, 5);
  // Gesicht & edler Bart
  rect(8, 3, 8, 4, 13);
  set(10, 4, 1); set(13, 4, 1);
  rect(8, 7, 8, 2, 15); // weißer/silberner Vollbart
  rect(9, 9, 6, 1, 15);
  // Purpurmantel mit Hermelinkragen & Goldkette
  rect(5, 10, 14, 6, 5);
  rect(6, 10, 12, 1, 2);
  rect(9, 11, 6, 5, 8);
  rect(11, 11, 2, 5, 10);
  // Goldzepter rechts
  linie(19, 3, 19, 15, 10);
  rect(18, 2, 3, 2, 11);
  set(19, 2, 5);
});

/* 5. Eins! / Uno Aktions-Motive (24×16) */
bildRegistrieren('KARTEN_BG_UNO_SKIP', 24, 16, ({ set, linie }) => {
  // Verbotskreis ⊘
  for (let y = 1; y < 15; y++) {
    for (let x = 5; x < 19; x++) {
      const d = Math.hypot(x - 11.5, y - 7.5);
      if (d >= 4.2 && d <= 6.2) set(x, y, 5);
    }
  }
  linie(8, 11, 15, 4, 5);
  linie(8, 12, 16, 4, 5);
});

bildRegistrieren('KARTEN_BG_UNO_REV', 24, 16, ({ rect, set }) => {
  // Doppelpfeile ⇄
  rect(6, 4, 10, 2, 8);
  set(16, 3, 8); set(17, 4, 8); set(17, 5, 8); set(16, 6, 8);
  rect(8, 10, 10, 2, 14);
  set(7, 9, 14); set(6, 10, 14); set(6, 11, 14); set(7, 12, 14);
});

bildRegistrieren('KARTEN_BG_UNO_P2', 24, 16, ({ rect }) => {
  // Zwei überlappende Spielkarten
  rect(5, 3, 8, 10, 1); rect(6, 4, 6, 8, 5);
  rect(11, 2, 8, 10, 1); rect(12, 3, 6, 8, 10);
});

bildRegistrieren('KARTEN_BG_UNO_WILD', 24, 16, ({ set }) => {
  // 4-Farben-Kreis (Rot, Gelb, Grün, Blau)
  for (let y = 1; y < 15; y++) {
    for (let x = 5; x < 19; x++) {
      const dx = x - 11.5, dy = y - 7.5;
      const d = Math.hypot(dx, dy);
      if (d <= 6.4) {
        if (d > 5.4) set(x, y, 1);
        else if (dx < 0 && dy < 0) set(x, y, 5);
        else if (dx >= 0 && dy < 0) set(x, y, 10);
        else if (dx < 0 && dy >= 0) set(x, y, 14);
        else set(x, y, 8);
      }
    }
  }
});

bildRegistrieren('KARTEN_BG_UNO_P4', 24, 16, ({ rect }) => {
  // 4 bunte überlappende Karten
  rect(3, 4, 6, 9, 1); rect(4, 5, 4, 7, 5);
  rect(7, 3, 6, 9, 1); rect(8, 4, 4, 7, 10);
  rect(11, 2, 6, 9, 1); rect(12, 3, 4, 7, 14);
  rect(15, 4, 6, 9, 1); rect(16, 5, 4, 7, 8);
});

/* 6. Schwarzer Peter: Kater + 8 Paar-Symbole (24×16) */
bildRegistrieren('KARTEN_BG_PETER_KATER', 24, 16, ({ set, rect, kreis }) => {
  // Spitze Katzenohren
  rect(6, 1, 2, 3, 1); set(7, 2, 5);
  rect(16, 1, 2, 3, 1); set(16, 2, 5);
  // Schwarzer runder Kopf
  kreis(12, 8, 6, 1);
  // Leuchtend gelbe Augen mit Schlitzpupillen
  rect(8, 6, 3, 2, 11); set(9, 6, 1); set(9, 7, 1);
  rect(13, 6, 3, 2, 11); set(14, 6, 1); set(14, 7, 1);
  // Rosa Nase & Schnurrhaare
  set(11, 9, 6); set(12, 9, 6);
  rect(3, 9, 3, 1, 15); rect(3, 11, 3, 1, 15);
  rect(18, 9, 3, 1, 15); rect(18, 11, 3, 1, 15);
});

const PAAR_MOTIVE = [
  // 0: Krone
  ({ rect, set }) => { rect(6, 6, 12, 6, 10); set(6, 4, 11); set(10, 3, 11); set(13, 3, 11); set(17, 4, 11); set(9, 8, 5); set(14, 8, 8); },
  // 1: Sonne
  ({ kreis, set }) => { kreis(12, 8, 4, 10); kreis(12, 8, 2, 11); for (const [x, y] of [[12,1],[12,14],[5,8],[19,8],[7,3],[17,3],[7,13],[17,13]]) set(x, y, 10); },
  // 2: Stern
  ({ set, rect }) => { rect(11, 2, 2, 12, 10); rect(6, 7, 12, 2, 10); rect(9, 5, 6, 6, 11); set(8, 4, 10); set(15, 4, 10); set(8, 11, 10); set(15, 11, 10); },
  // 3: Blume
  ({ kreis, rect }) => { rect(11, 10, 2, 5, 14); kreis(12, 4, 2, 5); kreis(9, 7, 2, 5); kreis(15, 7, 2, 5); kreis(12, 10, 2, 5); kreis(12, 7, 2, 11); },
  // 4: Haus
  ({ rect, set }) => { for (let y = 0; y < 5; y++) for (let x = 11 - y; x <= 12 + y; x++) set(x, 2 + y, 5); rect(7, 7, 10, 7, 13); rect(10, 10, 4, 4, 12); rect(8, 8, 2, 2, 9); },
  // 5: Herz
  (g) => zeichneHerz(g, 12, 8),
  // 6: Anker
  ({ rect, set }) => { rect(11, 3, 2, 10, 8); rect(8, 5, 8, 2, 8); rect(7, 11, 10, 2, 8); set(7, 10, 9); set(16, 10, 9); set(11, 2, 10); set(12, 2, 10); },
  // 7: Mond
  ({ kreis }) => { kreis(12, 8, 5, 10); kreis(14, 7, 4, 2); },
];
PAAR_MOTIVE.forEach((fn, i) => bildRegistrieren(`KARTEN_BG_PAAR_${i}`, 24, 16, fn));

/* Dateien schreiben */
const bgBin = Buffer.concat(kacheln);
const palBin = Buffer.concat([palNormal, palAuswahl, palMark]);
writeFileSync(resolve(ziel, 'karten_bg.bin'), bgBin);
writeFileSync(resolve(ziel, 'karten_bg_pal.bin'), palBin);

const header = [
  '/* Automatisch erzeugt von werkzeuge/karten_grafik.mjs – nicht von Hand bearbeiten. */',
  '#ifndef KARTEN_GRAFIK_H',
  '#define KARTEN_GRAFIK_H',
  '',
  ...Object.entries(konstanten).map(([k, v]) => `#define ${k} 0x${v.toString(16)}`),
  '#define KARTEN_BG_PAAR_ANZAHL 8',
  '',
  '#endif',
  '',
].join('\n');
writeFileSync(resolve(ziel, 'karten_grafik.h'), header);

console.log(`karten_grafik.mjs: ${kacheln.length} BG-Kacheln (${bgBin.length} B), 3 Paletten (${palBin.length} B)`);
