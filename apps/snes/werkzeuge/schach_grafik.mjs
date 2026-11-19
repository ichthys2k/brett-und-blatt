#!/usr/bin/env node
/*
 * Erzeugt die 16-Bit-Battle-Chess-Grafiken für Brett & Blatt 16:
 *   - res/schach_bg.bin      (24×24 Holz-Schachbrettfelder + Cursor/Ziel/Schlag-Rahmen ab Kachel 0x100)
 *   - res/schach_bg_pal.bin  (BG-Palette 5 für das Holzbrett & Markierungen)
 *   - res/schach_spr.bin     (512 4bpp-Kacheln = 16 KB OAM-Sprite-Sheet: 6 Figuren × 4 Frames à 32×32 + Kampf-Effekte)
 *   - res/schach_spr_pal.bin (4 OAM-Paletten: Weiß, Schwarz, Treffer-Blitz, Kampf-Effekte)
 *   - res/schach_grafik.h    (Kachel- und Sprite-Konstanten)
 *
 *   node werkzeuge/schach_grafik.mjs <ausgabeordner>
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] ?? 'res';
mkdirSync(out, { recursive: true });

function bgr555([r, g, b]) {
  return ((b >> 3) << 10) | ((g >> 3) << 5) | (r >> 3);
}

function palBytes(paletten) {
  const buf = Buffer.alloc(paletten.length * 32);
  paletten.forEach((pal, p) => {
    pal.forEach((rgb, i) => {
      buf.writeUInt16LE(bgr555(rgb), p * 32 + i * 2);
    });
  });
  return buf;
}

/** Wandelt ein 8×8-Pixelbild (Farbwerte 0..15) in eine 32-Byte-SNES-4bpp-Kachel. */
function kachel4bpp(getPx) {
  const out = Buffer.alloc(32);
  for (let y = 0; y < 8; y++) {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0;
    for (let x = 0; x < 8; x++) {
      const c = getPx(x, y) & 15;
      const bit = 7 - x;
      if (c & 1) b0 |= 1 << bit;
      if (c & 2) b1 |= 1 << bit;
      if (c & 4) b2 |= 1 << bit;
      if (c & 8) b3 |= 1 << bit;
    }
    out[y * 2] = b0;
    out[y * 2 + 1] = b1;
    out[16 + y * 2] = b2;
    out[16 + y * 2 + 1] = b3;
  }
  return out;
}

/* ==================================================================
 * 1. BG-Kacheln (ab Kachel 0x100): 24×24 Holzbrett & Markierungen
 * ================================================================== */

const BG_PALETTE = [
  [0, 0, 0],       // 0: transparent
  [240, 214, 168], // 1: Ahorn hell (Lichtkante)
  [222, 188, 134], // 2: Ahorn mittel
  [200, 162, 108], // 3: Ahorn Maserung
  [172, 134, 84],  // 4: Ahorn Schattenkante
  [148, 98, 56],   // 5: Nussbaum Lichtkante
  [120, 74, 40],   // 6: Nussbaum mittel
  [98, 58, 30],    // 7: Nussbaum Maserung
  [74, 42, 20],    // 8: Nussbaum Schattenkante
  [255, 224, 72],  // 9: Cursor Gold hell
  [196, 138, 24],  // 10: Cursor Gold dunkel
  [92, 236, 132],  // 11: Zielpunkt Grün hell
  [36, 152, 74],   // 12: Zielpunkt Grün dunkel
  [248, 84, 72],   // 13: Schlag-Rahmen Rot hell
  [156, 28, 28],   // 14: Schlag-Rahmen Rot dunkel
  [96, 212, 255],  // 15: Ausgewählt Cyan
];

const bgKacheln = [];
function addBgTile(fn) {
  const idx = 0x100 + bgKacheln.length;
  bgKacheln.push(kachel4bpp(fn));
  return idx;
}

function addBgBlock3x3(fn) {
  const start = 0x100 + bgKacheln.length;
  for (let ty = 0; ty < 3; ty++) {
    for (let tx = 0; tx < 3; tx++) {
      addBgTile((x, y) => fn(tx * 8 + x, ty * 8 + y));
    }
  }
  return start;
}

function holzFeld(hell) {
  const [cLicht, cMid, cMaser, cSchatten] = hell ? [1, 2, 3, 4] : [5, 6, 7, 8];
  return (x, y) => {
    if (x === 0 || y === 0) return cLicht;
    if (x === 23 || y === 23) return cSchatten;
    // Sanfte waagerechte Holzmaserung
    const welle = Math.sin(x * 0.28 + (hell ? 0.4 : 2.1)) * 1.4;
    const band = Math.floor(y + welle) % 5;
    if (band === 0) return cMaser;
    if (band === 3 && ((x + y) & 3) === 0) return cLicht;
    return cMid;
  };
}

const BG_HELL = addBgBlock3x3(holzFeld(true));
const BG_DUNKEL = addBgBlock3x3(holzFeld(false));

// Rahmen-Overlay (3×3 Kacheln, transparent innen)
function rahmen3x3(cAussen, cInnen, nurEcken) {
  return (x, y) => {
    const rand = x <= 1 || x >= 22 || y <= 1 || y >= 22;
    if (!rand) return 0;
    if (nurEcken) {
      const ecke = (x < 7 || x >= 17) && (y < 7 || y >= 17);
      if (!ecke) return 0;
    }
    const ganzAussen = x === 0 || x === 23 || y === 0 || y === 23;
    return ganzAussen ? cAussen : cInnen;
  };
}

const BG_CURSOR = addBgBlock3x3(rahmen3x3(10, 9, false));
const BG_GEWAEHLT = addBgBlock3x3(rahmen3x3(10, 15, false));
const BG_SCHLAG = addBgBlock3x3(rahmen3x3(14, 13, true));

// Zielpunkt (1 Kachel 8×8, zentriert auf dem 24×24-Feld)
const BG_ZIELPUNKT = addBgTile((x, y) => {
  const dx = x - 3.5, dy = y - 3.5;
  const r = Math.hypot(dx, dy);
  if (r <= 1.7) return 11;
  if (r <= 2.9) return 12;
  if (r <= 3.6) return 10;
  return 0;
});

// Schach-Brett-Rahmen (einfache dunkle Holz-Umrandung)
const BG_RAHMEN = addBgTile((x, y) => {
  if (x === 0 || y === 0) return 6;
  if (x === 7 || y === 7) return 8;
  return 7;
});

/* ==================================================================
 * 2. OAM-Sprites (512 Kacheln = 16 KB, 16 Kacheln breit × 32 hoch)
 *    6 Battle-Chess-Figuren × 4 Frames (32×32) + 6 Kampf-Effekte (16×16)
 * ================================================================== */

/*
 * Gemeinsame Sprite-Farbrollen (Indizes 1..15) für Palette 0 (Weiß) & Palette 1 (Schwarz):
 *   0: transparent
 *   1: Kontur / tiefster Schatten
 *   2: Bodenschatten (halbdunkel)
 *   3: Rüstung / Stein dunkel
 *   4: Rüstung / Stein mittel
 *   5: Rüstung / Stein hell (Glanz)
 *   6: Umhang / Wappen dunkel
 *   7: Umhang / Wappen hell
 *   8: Gold / Krone dunkel
 *   9: Gold / Krone hell
 *  10: Haut / Holz dunkel
 *  11: Haut / Holz hell
 *  12: Klinge / Magie-Spitze dunkel
 *  13: Klinge / Magie-Spitze hell
 *  14: Akzent / Augen / Edelstein
 *  15: Reines Glanzlicht
 */
const SPR_PALETTEN = [
  // 0: Weiß (Silber-Ritter, Königsblau, Gold)
  [
    [0, 0, 0],       // 0 transparent
    [24, 20, 28],    // 1 Kontur
    [48, 36, 28],    // 2 Bodenschatten
    [140, 148, 168], // 3 Rüstung dunkel
    [198, 206, 224], // 4 Rüstung mittel
    [244, 248, 255], // 5 Rüstung hell
    [32, 72, 168],   // 6 Umhang/Schild blau dunkel
    [76, 136, 238],  // 7 Umhang/Schild blau hell
    [192, 138, 28],  // 8 Gold dunkel
    [252, 218, 84],  // 9 Gold hell
    [186, 128, 92],  // 10 Haut/Holz dunkel
    [238, 188, 148], // 11 Haut/Holz hell
    [142, 176, 212], // 12 Klinge dunkel
    [224, 244, 255], // 13 Klinge hell
    [236, 68, 84],   // 14 Juwel / Federbusch rot
    [255, 255, 255], // 15 Glanzlicht
  ],
  // 1: Schwarz (Obsidian-Ritter, Purpur/Karmesin, Bronze/Gold)
  [
    [0, 0, 0],       // 0 transparent
    [12, 10, 18],    // 1 Kontur
    [36, 26, 22],    // 2 Bodenschatten
    [46, 44, 62],    // 3 Rüstung dunkel
    [82, 80, 106],   // 4 Rüstung mittel
    [136, 136, 168], // 5 Rüstung Kantenlicht (klar lesbar!)
    [124, 22, 52],   // 6 Umhang/Schild karmesin dunkel
    [198, 48, 84],   // 7 Umhang/Schild karmesin hell
    [164, 104, 24],  // 8 Bronze/Gold dunkel
    [242, 188, 64],  // 9 Bronze/Gold hell
    [136, 92, 68],   // 10 Haut/Holz dunkel
    [194, 146, 114], // 11 Haut/Holz hell
    [128, 96, 182],  // 12 Klinge/Magie violett dunkel
    [216, 184, 255], // 13 Klinge/Magie violett hell
    [255, 196, 48],  // 14 Augen/Juwel gold
    [240, 240, 255], // 15 Glanzlicht
  ],
  // 2: Treffer-Blitz (kurzes Aufleuchten beim Einschlag)
  [
    [0, 0, 0],
    [120, 48, 24],
    [120, 48, 24],
    [255, 180, 72],
    [255, 224, 136],
    [255, 255, 232],
    [255, 140, 64],
    [255, 210, 110],
    [255, 230, 140],
    [255, 255, 220],
    [255, 200, 120],
    [255, 240, 180],
    [255, 255, 255],
    [255, 255, 255],
    [255, 255, 255],
    [255, 255, 255],
  ],
  // 3: Kampf-Effekte (Funken, Magieblitz, Staubwolke)
  [
    [0, 0, 0],       // 0 transparent
    [48, 24, 16],    // 1 Kontur dunkel
    [168, 44, 24],   // 2 Feuer rot
    [236, 112, 28],  // 3 Feuer orange
    [255, 204, 48],  // 4 Funken gelb
    [255, 252, 208], // 5 Funken weiß-gelb
    [44, 88, 216],   // 6 Magie blau
    [88, 192, 255],  // 7 Magie cyan
    [204, 248, 255], // 8 Magie weiß-cyan
    [152, 84, 228],  // 9 Magie violett
    [118, 102, 88],  // 10 Staub dunkel
    [168, 152, 134], // 11 Staub mittel
    [216, 204, 186], // 12 Staub hell
    [248, 244, 236], // 13 Licht
    [255, 140, 180], // 14 Pink-Blitz
    [255, 255, 255], // 15 Weiß
  ],
];

// Hilfs-Canvas für 32×32 oder 16×16 Pixel-Art mit automatischer 1px-Kontur!
function canvas(w, h) {
  const px = new Uint8Array(w * h);
  const set = (x, y, c) => {
    const ix = Math.round(x), iy = Math.round(y);
    if (ix >= 0 && ix < w && iy >= 0 && iy < h) px[iy * w + ix] = c;
  };
  const get = (x, y) => (x >= 0 && x < w && y >= 0 && y < h ? px[y * w + x] : 0);
  const rect = (x, y, rw, rh, c) => {
    for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) set(x + i, y + j, c);
  };
  const ell = (cx, cy, rx, ry, c) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (d <= 1) set(x, y, c);
      }
    }
  };
  const line = (x0, y0, x1, y1, c, thick = 1) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= steps; i++) {
      const x = x0 + ((x1 - x0) * i) / steps;
      const y = y0 + ((y1 - y0) * i) / steps;
      set(x, y, c);
      if (thick > 1) { set(x + 1, y, c); set(x, y + 1, c); }
    }
  };
  const outline = (c = 1) => {
    const copy = new Uint8Array(px);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (copy[y * w + x] !== 0) continue;
        if (
          (x > 0 && copy[y * w + x - 1] > 2) ||
          (x + 1 < w && copy[y * w + x + 1] > 2) ||
          (y > 0 && copy[(y - 1) * w + x] > 2) ||
          (y + 1 < h && copy[(y + 1) * w + x] > 2)
        ) {
          px[y * w + x] = c;
        }
      }
    }
  };
  const shadow = (cx = 15.5, cy = 28.5, rx = 8, ry = 2.2) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (d <= 1 && get(x, y) === 0) set(x, y, 2);
      }
    }
  };
  return { w, h, px, set, get, rect, ell, line, outline, shadow };
}

/* --- 1. BAUER (Fußsoldat mit Helm, Schild & Speer) --- */
function drawBauer(frame) {
  const c = canvas(32, 32);
  if (frame === 3) {
    // Sturz: liegt am Boden, Schild und Speer verrutscht
    c.shadow(16, 27, 11, 2.5);
    c.rect(7, 22, 16, 5, 4); c.rect(9, 21, 12, 2, 5);
    c.ell(8, 22, 3.2, 3, 4); c.ell(8, 21, 2, 1.5, 5); // Helm
    c.rect(14, 19, 6, 6, 7); c.rect(15, 20, 4, 4, 6); c.set(17, 22, 9); // Schild
    c.line(5, 26, 26, 24, 10, 1); c.line(25, 24, 28, 23, 13, 1); // Speer
    c.outline(1);
    return c;
  }
  const dy = frame === 1 ? -1 : 0;
  const step = frame === 1 ? 2 : 0;
  const atk = frame === 2;
  c.shadow(15.5, 28.5, 7.5, 2);
  // Beine
  c.rect(12 - step, 23 + dy, 3, 5, 3);
  c.rect(16 + step, 23 + dy, 3, 5, 3);
  // Körper / Brustpanzer
  c.rect(11, 15 + dy, 9, 8, 4);
  c.rect(12, 15 + dy, 5, 6, 5);
  c.rect(11, 21 + dy, 9, 2, 6); // Waffenrock
  // Kopf & Helm
  c.ell(15.5, 11.5 + dy, 3.8, 3.8, 11);
  c.rect(12, 8 + dy, 7, 3, 4);
  c.rect(13, 7 + dy, 5, 2, 5);
  c.set(17, 11 + dy, 1); // Auge
  // Schild (links)
  c.rect(8, 16 + dy, 5, 7, 6);
  c.rect(9, 17 + dy, 3, 5, 7);
  c.set(10, 19 + dy, 9);
  // Speer (rechts; bei Angriff nach rechts vorgestoßen!)
  if (atk) {
    c.line(16, 17, 27, 15, 10, 1);
    c.line(26, 15, 30, 14, 13, 2);
    c.set(30, 14, 15);
  } else {
    c.line(21, 26 + dy, 23, 7 + dy, 10, 1);
    c.line(23, 7 + dy, 24, 3 + dy, 13, 2);
  }
  c.outline(1);
  return c;
}

/* --- 2. SPRINGER (Gepanzerter Ritter zu Pferd mit Lanze) --- */
function drawSpringer(frame) {
  const c = canvas(32, 32);
  if (frame === 3) {
    // Sturz: Pferd & Ritter gestürzt
    c.shadow(16, 27, 12, 2.5);
    c.ell(15, 23, 9, 4, 4); c.ell(14, 22, 6, 2.5, 5);
    c.rect(10, 21, 9, 3, 7); // Schabracke
    c.ell(23, 22, 3.5, 2.5, 4); // Pferdekopf
    c.line(6, 26, 25, 20, 9, 1); // Lanze
    c.outline(1);
    return c;
  }
  const jump = frame === 1 ? -3 : (frame === 2 ? -1 : 0);
  const atk = frame === 2;
  c.shadow(15.5, 28.5, 9.5, 2.2);
  // Pferdebeine
  if (frame === 1) {
    c.line(10, 22 + jump, 6, 27 + jump, 3, 2);
    c.line(13, 22 + jump, 10, 27 + jump, 4, 2);
    c.line(19, 22 + jump, 24, 25 + jump, 4, 2);
    c.line(21, 22 + jump, 26, 23 + jump, 5, 2);
  } else if (atk) {
    // Aufbäumen!
    c.line(10, 22, 9, 28, 3, 2);
    c.line(13, 22, 13, 28, 4, 2);
    c.line(20, 18, 25, 21, 5, 2);
    c.line(22, 17, 27, 19, 4, 2);
  } else {
    c.rect(9, 22, 2, 6, 3); c.rect(12, 22, 2, 6, 4);
    c.rect(18, 22, 2, 6, 4); c.rect(21, 22, 2, 6, 5);
  }
  // Pferdekörper & Schabracke
  c.ell(15.5, 19.5 + jump, 7.5, 4.2, 4);
  c.ell(15, 18.5 + jump, 6, 2.5, 5);
  c.rect(11, 18 + jump, 8, 5, 6);
  c.rect(12, 18 + jump, 6, 3, 7);
  // Pferdehals & Kopf (nach rechts)
  c.line(19, 17 + jump, 23, 11 + jump, 4, 2);
  c.ell(23.5, 11 + jump, 3.2, 2.4, 5);
  c.rect(24, 11 + jump, 4, 2, 4); // Schnauze
  c.set(24, 10 + jump, 14); // Auge
  // Ritter im Sattel
  c.rect(12, 10 + jump, 6, 7, 4);
  c.rect(13, 10 + jump, 4, 5, 5);
  c.ell(15, 7.5 + jump, 3, 3, 5); // Helm
  c.rect(12, 4 + jump, 5, 2, 14); // Federbusch
  // Lanze
  if (atk) {
    c.line(13, 13, 29, 11, 9, 2);
    c.line(27, 11, 31, 10, 13, 1);
  } else {
    c.line(15, 15 + jump, 26, 4 + jump, 9, 1);
    c.line(26, 4 + jump, 28, 2 + jump, 13, 1);
  }
  c.outline(1);
  return c;
}

/* --- 3. LÄUFER (Kleriker / Magier mit Mitra/Spitzhut & Zauberstab) --- */
function drawLaeufer(frame) {
  const c = canvas(32, 32);
  if (frame === 3) {
    c.shadow(16, 27, 11, 2.3);
    c.ell(15, 23, 8, 3.5, 6); c.ell(14, 22, 6, 2, 7);
    c.ell(8, 22, 3, 2.5, 5); // Hut
    c.line(10, 26, 27, 22, 9, 1); c.ell(27, 22, 2, 2, 13);
    c.outline(1);
    return c;
  }
  const dy = frame === 1 ? -1 : 0;
  const atk = frame === 2;
  c.shadow(15.5, 28.5, 7.5, 2);
  // Robe (schmal oben, weit unten)
  for (let y = 13; y <= 27; y++) {
    const hw = 3 + ((y - 13) * 4.5) / 14;
    c.rect(15.5 - hw, y + dy, hw * 2, 1, y % 3 === 0 ? 6 : 7);
  }
  // Goldene Stola in der Mitte
  c.rect(14, 14 + dy, 3, 13, 8);
  c.rect(15, 14 + dy, 1, 13, 9);
  // Kopf & Mitra (hohe Bischofsmütze)
  c.ell(15.5, 11.5 + dy, 3.2, 3.2, 11);
  c.set(17, 11 + dy, 1);
  c.line(12, 9 + dy, 15, 3 + dy, 5, 2);
  c.line(18, 9 + dy, 15, 3 + dy, 4, 2);
  c.rect(13, 6 + dy, 4, 3, 5);
  c.set(15, 5 + dy, 9); // Goldkreuz
  // Magierstab (rechts)
  if (atk) {
    c.line(18, 16, 26, 11, 8, 2);
    c.ell(27, 10, 3, 3, 13);
    c.ell(27, 10, 1.5, 1.5, 15);
  } else {
    c.line(21, 27 + dy, 22, 8 + dy, 8, 1);
    c.ell(22, 7 + dy, 2.2, 2.2, 13);
    c.set(22, 7 + dy, 15);
  }
  c.outline(1);
  return c;
}

/* --- 4. TURM (Massiver Steingolem / Festungsturm mit Zinnen & Fäusten) --- */
function drawTurm(frame) {
  const c = canvas(32, 32);
  if (frame === 3) {
    // Einsturz: Steintrümmer-Haufen
    c.shadow(16, 27, 12, 2.8);
    c.rect(6, 22, 7, 5, 4); c.rect(14, 21, 8, 6, 3); c.rect(20, 23, 6, 4, 5);
    c.rect(10, 19, 6, 4, 5); c.rect(17, 20, 5, 3, 4);
    c.outline(1);
    return c;
  }
  const dy = frame === 1 ? -1 : 0;
  const atk = frame === 2;
  c.shadow(15.5, 28.5, 10, 2.5);
  // Massive Beine
  c.rect(9, 23 + dy + (frame === 1 ? -1 : 0), 5, 5, 3);
  c.rect(17, 23 + dy + (frame === 1 ? 1 : 0), 5, 5, 4);
  // Festungs-Rumpf (Quader mit Mauerfugen)
  c.rect(8, 11 + dy, 15, 13, 4);
  c.rect(9, 11 + dy, 6, 12, 5);
  c.rect(8, 16 + dy, 15, 1, 3);
  c.rect(8, 20 + dy, 15, 1, 3);
  // Torbogen / glühende Augen
  c.rect(12, 13 + dy, 2, 2, 14);
  c.rect(17, 13 + dy, 2, 2, 14);
  // Zinnenkrone oben
  c.rect(7, 6 + dy, 4, 5, 5);
  c.rect(13, 6 + dy, 5, 5, 5);
  c.rect(20, 6 + dy, 4, 5, 4);
  // Stein-Arme / Fäuste
  if (atk) {
    // Rechter Riesenarm nach vorn geschmettert!
    c.rect(20, 12, 9, 5, 5);
    c.rect(25, 14, 5, 7, 4);
    c.rect(4, 13, 4, 6, 3);
  } else {
    c.rect(4, 13 + dy, 4, 8, 3);
    c.rect(23, 13 + dy, 4, 8, 4);
  }
  c.outline(1);
  return c;
}

/* --- 5. DAME (Kampf-Königin mit Krone, Umhang & Lichtschwert) --- */
function drawDame(frame) {
  const c = canvas(32, 32);
  if (frame === 3) {
    c.shadow(16, 27, 11, 2.3);
    c.ell(15, 23, 9, 3.5, 7); c.ell(13, 22, 6, 2, 5);
    c.rect(7, 20, 5, 3, 9); // Krone
    c.line(18, 24, 28, 21, 13, 1);
    c.outline(1);
    return c;
  }
  const dy = frame === 1 ? -2 : 0;
  const atk = frame === 2;
  c.shadow(15.5, 28.5, 8.5, 2.2);
  // Weiter königlicher Umhang + Rüstungskleid
  for (let y = 13; y <= 27; y++) {
    const hw = 3.5 + ((y - 13) * 5.5) / 14;
    c.rect(15.5 - hw, y + dy, hw * 2, 1, 6);
    c.rect(15.5 - hw * 0.65, y + dy, hw * 1.3, 1, 7);
  }
  // Silberner Brustpanzer
  c.rect(12, 13 + dy, 7, 7, 5);
  c.rect(13, 14 + dy, 5, 5, 4);
  c.set(15, 16 + dy, 9);
  // Kopf & Zackenkrone
  c.ell(15.5, 10 + dy, 3.2, 3.2, 11);
  c.set(17, 10 + dy, 1);
  c.rect(11, 5 + dy, 9, 3, 8);
  c.set(11, 4 + dy, 9); c.set(13, 3 + dy, 9); c.set(15, 3 + dy, 15);
  c.set(17, 3 + dy, 9); c.set(19, 4 + dy, 9);
  // Lichtschwert
  if (atk) {
    c.line(18, 15, 29, 9, 13, 2);
    c.line(20, 14, 30, 8, 15, 1);
    c.rect(17, 15, 3, 2, 9);
  } else {
    c.line(21, 20 + dy, 25, 8 + dy, 13, 2);
    c.set(25, 8 + dy, 15);
    c.rect(20, 19 + dy, 3, 2, 9);
  }
  c.outline(1);
  return c;
}

/* --- 6. KÖNIG (Gekrönter Herrscher mit großer Krone, Mantel & Breitschwert) --- */
function drawKoenig(frame) {
  const c = canvas(32, 32);
  if (frame === 3) {
    c.shadow(16, 27, 12, 2.5);
    c.rect(7, 21, 16, 6, 6); c.rect(9, 20, 12, 4, 4);
    c.rect(6, 18, 6, 4, 9); c.set(9, 16, 9); // Krone mit Kreuz
    c.line(19, 24, 29, 22, 13, 2);
    c.outline(1);
    return c;
  }
  const dy = frame === 1 ? -1 : 0;
  const atk = frame === 2;
  c.shadow(15.5, 28.5, 9, 2.3);
  // Breiter Königsmantel
  c.rect(9, 13 + dy, 13, 14, 6);
  c.rect(10, 14 + dy, 11, 12, 7);
  // Plattenrüstung & Goldgürtel
  c.rect(11, 13 + dy, 9, 10, 4);
  c.rect(12, 13 + dy, 5, 8, 5);
  c.rect(11, 20 + dy, 9, 2, 9);
  // Beine
  c.rect(11, 23 + dy + (frame === 1 ? -1 : 0), 3, 5, 3);
  c.rect(17, 23 + dy + (frame === 1 ? 1 : 0), 3, 5, 3);
  // Kopf mit Bart & hoher Kreuzkrone
  c.ell(15.5, 10 + dy, 3.5, 3.5, 11);
  c.rect(13, 11 + dy, 5, 2, 5); // Bart
  c.set(17, 9 + dy, 1);
  c.rect(11, 5 + dy, 9, 3, 9);
  c.rect(12, 4 + dy, 7, 2, 8);
  c.rect(15, 1 + dy, 2, 5, 9); // Kreuz oben
  c.rect(13, 2 + dy, 6, 2, 9);
  c.set(15, 2 + dy, 15);
  // Breitschwert
  if (atk) {
    c.line(18, 16, 30, 13, 13, 2);
    c.line(20, 15, 31, 13, 15, 1);
    c.rect(17, 14, 2, 5, 9);
  } else {
    c.line(22, 23 + dy, 24, 9 + dy, 13, 2);
    c.rect(20, 21 + dy, 5, 2, 9);
  }
  c.outline(1);
  return c;
}

/* --- 7. KAMPF-EFFEKTE (16×16, Palette 3) --- */
function drawFunke(big) {
  const c = canvas(16, 16);
  const r = big ? 7 : 5;
  c.line(8 - r, 8, 8 + r, 8, 3, 1);
  c.line(8, 8 - r, 8, 8 + r, 3, 1);
  c.line(8 - r + 2, 8 - r + 2, 8 + r - 2, 8 + r - 2, 4, 1);
  c.line(8 - r + 2, 8 + r - 2, 8 + r - 2, 8 - r + 2, 4, 1);
  c.ell(8, 8, big ? 3.5 : 2.2, big ? 3.5 : 2.2, 5);
  c.ell(8, 8, big ? 2 : 1, big ? 2 : 1, 15);
  return c;
}

function drawMagie(big) {
  const c = canvas(16, 16);
  c.ell(8, 8, big ? 6.5 : 4.5, big ? 6.5 : 4.5, 6);
  c.ell(8, 8, big ? 5 : 3.2, big ? 5 : 3.2, 7);
  c.ell(8, 8, big ? 3 : 2, big ? 3 : 2, 8);
  c.ell(8, 8, 1.5, 1.5, 15);
  if (big) {
    c.set(2, 3, 9); c.set(13, 2, 7); c.set(14, 12, 9); c.set(2, 13, 7);
  }
  return c;
}

function drawStaub(big) {
  const c = canvas(16, 16);
  const s = big ? 1 : 0;
  c.ell(5, 10, 3 + s, 2.5 + s, 10);
  c.ell(10, 10, 3.5 + s, 2.5 + s, 11);
  c.ell(8, 7, 3.5 + s, 3 + s, 12);
  c.ell(7, 6, 2, 1.5, 13);
  return c;
}

// 16 Kacheln breit × 32 Kacheln hoch = 512 Kacheln = 16384 Bytes
const SHEET_TILES = Array.from({ length: 512 }, () => Buffer.alloc(32));

function placeOnSheet(tileCol, tileRow, canv) {
  const tw = canv.w / 8, th = canv.h / 8;
  for (let ty = 0; ty < th; ty++) {
    for (let tx = 0; tx < tw; tx++) {
      const idx = (tileRow + ty) * 16 + (tileCol + tx);
      SHEET_TILES[idx] = kachel4bpp((x, y) => canv.get(tx * 8 + x, ty * 8 + y));
    }
  }
  return tileRow * 16 + tileCol;
}

const FIGUR_DRAW = [drawBauer, drawSpringer, drawLaeufer, drawTurm, drawDame, drawKoenig];
const FIGUR_NAMEN = ['BAUER', 'SPRINGER', 'LAEUFER', 'TURM', 'DAME', 'KOENIG'];
const FIGUR_BASIS = [];

for (let p = 0; p < 6; p++) {
  const row = p * 4;
  FIGUR_BASIS.push(row * 16);
  for (let f = 0; f < 4; f++) {
    placeOnSheet(f * 4, row, FIGUR_DRAW[p](f));
  }
}

const SPR_FUNKE_A = placeOnSheet(0, 24, drawFunke(false));
const SPR_FUNKE_B = placeOnSheet(2, 24, drawFunke(true));
const SPR_MAGIE_A = placeOnSheet(4, 24, drawMagie(false));
const SPR_MAGIE_B = placeOnSheet(6, 24, drawMagie(true));
const SPR_STAUB_A = placeOnSheet(8, 24, drawStaub(false));
const SPR_STAUB_B = placeOnSheet(10, 24, drawStaub(true));

/* ==================================================================
 * 3. Dateien schreiben
 * ================================================================== */

writeFileSync(join(out, 'schach_bg.bin'), Buffer.concat(bgKacheln));
writeFileSync(join(out, 'schach_bg_pal.bin'), palBytes([BG_PALETTE]));
writeFileSync(join(out, 'schach_spr.bin'), Buffer.concat(SHEET_TILES));
writeFileSync(join(out, 'schach_spr_pal.bin'), palBytes(SPR_PALETTEN));

const header = `/* Erzeugt von werkzeuge/schach_grafik.mjs – nicht von Hand ändern. */
#ifndef SCHACH_GRAFIK_H
#define SCHACH_GRAFIK_H

#define SCHACH_BG_HELL 0x${BG_HELL.toString(16)}
#define SCHACH_BG_DUNKEL 0x${BG_DUNKEL.toString(16)}
#define SCHACH_BG_CURSOR 0x${BG_CURSOR.toString(16)}
#define SCHACH_BG_GEWAEHLT 0x${BG_GEWAEHLT.toString(16)}
#define SCHACH_BG_SCHLAG 0x${BG_SCHLAG.toString(16)}
#define SCHACH_BG_ZIELPUNKT 0x${BG_ZIELPUNKT.toString(16)}
#define SCHACH_BG_RAHMEN 0x${BG_RAHMEN.toString(16)}

/* OAM-Sprite-Basis (je Figur 4 Frames im Abstand +4: 0=Stand, 1=Lauf, 2=Angriff, 3=Sturz) */
${FIGUR_NAMEN.map((n, i) => `#define SCHACH_SPR_${n} 0x${FIGUR_BASIS[i].toString(16)}`).join('\n')}

#define SCHACH_SPR_FUNKE_A 0x${SPR_FUNKE_A.toString(16)}
#define SCHACH_SPR_FUNKE_B 0x${SPR_FUNKE_B.toString(16)}
#define SCHACH_SPR_MAGIE_A 0x${SPR_MAGIE_A.toString(16)}
#define SCHACH_SPR_MAGIE_B 0x${SPR_MAGIE_B.toString(16)}
#define SCHACH_SPR_STAUB_A 0x${SPR_STAUB_A.toString(16)}
#define SCHACH_SPR_STAUB_B 0x${SPR_STAUB_B.toString(16)}

#define SCHACH_PAL_WEISS 0
#define SCHACH_PAL_SCHWARZ 1
#define SCHACH_PAL_TREFFER 2
#define SCHACH_PAL_EFFEKT 3

#endif
`;
writeFileSync(join(out, 'schach_grafik.h'), header);
console.log(`Battle-Chess-Grafik: ${bgKacheln.length} BG-Kacheln (${bgKacheln.length * 32} B), 512 OAM-Sprite-Kacheln (16384 B).`);
