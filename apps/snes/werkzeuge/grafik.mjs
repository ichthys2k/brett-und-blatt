#!/usr/bin/env node
/*
 * Erzeugt die Grafik von Brett & Blatt 16 ohne Bildbearbeitung: Schrift, Rahmen, Filz,
 * Spielbrett-Felder und Titel werden hier aus Formeln gezeichnet und als SNES-Kacheln
 * (4 Bit je Bildpunkt) samt Farbpaletten geschrieben.
 *
 *   node werkzeuge/grafik.mjs <ausgabeordner>
 *
 * Ausgabe: kacheln.bin (Kacheldaten ab Kachel 0), palette.bin (128 Farben, BGR555) und
 * grafik.h (Kachelnummern und Paletten als C-Konstanten).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GLYPHEN } from './schrift8x8.mjs';

const out = process.argv[2] ?? 'res';
mkdirSync(out, { recursive: true });

// ---------------------------------------------------------------- Farben
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Gemeinsame Farben der Schrift-Paletten 0–4 (Index 3–7: Filz und Tafeln auf Ebene 2). */
const TISCH = {
  3: '#173d2b', // Filz dunkel
  4: '#1d4a34', // Filz hell
  5: '#3b2a1b', // Tafel innen (dunkles Holz)
  6: '#d4a64e', // Tafelrand hell (Messing)
  7: '#6e4c26', // Tafelrand dunkel
  8: '#2b1e13', // Tafel innen, Schattenkante
};
const SCHATTEN = '#120c08';
const schrift = (farbe) => ({ 1: farbe, 2: SCHATTEN, ...TISCH });

const holz = (hell, mittel, dunkel) => ({
  1: hell, 2: mittel, 3: dunkel,
  4: '#3e2814', // Gitter
  5: '#c8352c', 6: '#7c1c17', 9: '#f2806e', // Kreuz: Farbe, Kante, Licht
  7: '#2f62b8', 8: '#173570', 10: '#7fb0f4', // Kreis: Farbe, Kante, Licht
  11: '#f4ead2', // Weiß für kleine Zeichen
});

export const PALETTEN = [
  ['PAL_TEXT', schrift('#f4ecd8')],
  ['PAL_GELB', schrift('#f8d048')],
  ['PAL_GRAU', schrift('#8c8a84')],
  ['PAL_ROT', schrift('#f07060')],
  ['PAL_BLAU', schrift('#78aaf4')],
  ['PAL_BRETT', holz('#dcb27a', '#c99c64', '#ad8049')],
  ['PAL_BRETT_AUSWAHL', holz('#fff6c4', '#fbe79a', '#efd277')],
  ['PAL_BRETT_SIEG', holz('#9ee08a', '#86cc72', '#68b058')],
];
const HINTERGRUND = TISCH[3];

function bgr555([r, g, b]) {
  return (r >> 3) | ((g >> 3) << 5) | ((b >> 3) << 10);
}
const palette = Buffer.alloc(256);
PALETTEN.forEach(([, farben], p) => {
  for (let i = 0; i < 16; i++) {
    const h = i === 0 && p === 0 ? HINTERGRUND : farben[i];
    palette.writeUInt16LE(h ? bgr555(hex(h)) : 0, (p * 16 + i) * 2);
  }
});

// ---------------------------------------------------------------- Kacheln
/** Kacheln als 8×8-Felder mit Farbindex 0–15. */
const kacheln = [];
const konstanten = [];
function setze(nr, pixel) {
  kacheln[nr] = pixel;
}
const leer = () => Array.from({ length: 8 }, () => Array(8).fill(0));

/** Zerlegt ein Bild (Zeilen von Farbindizes) in Kacheln ab `start`, zeilenweise. */
function zerlege(bild, start) {
  const h = bild.length / 8;
  const b = bild[0].length / 8;
  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < b; tx++) {
      const k = leer();
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) k[y][x] = bild[ty * 8 + y][tx * 8 + x];
      setze(start + ty * b + tx, k);
    }
  }
  return { b, h };
}

// Schrift: Zeichen mit Schatten (Farbe 2) rechts unten.
function glyphe(zeilen, schatten = true) {
  const k = leer();
  const an = (x, y) => x >= 0 && y >= 0 && x < 8 && y < 8 && ((zeilen[y] >> x) & 1) === 1;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if (an(x, y)) k[y][x] = 1;
      else if (schatten && an(x - 1, y - 1)) k[y][x] = 2;
    }
  }
  return k;
}

/** Interne Zeichencodes über 0x7f – dieselbe Tabelle steht in src/bild.c (utf8_zeichen). */
export const SONDERZEICHEN = [
  [0x80, 0x00c4], [0x81, 0x00d6], [0x82, 0x00dc], [0x83, 0x00e4], [0x84, 0x00f6], [0x85, 0x00fc],
  [0x86, 0x00df], [0x87, 0x00d7], [0x88, 0x00b7],
];
for (let c = 0x20; c < 0x7f; c++) setze(c, glyphe(GLYPHEN[c]));
for (const [code, cp] of SONDERZEICHEN) setze(code, glyphe(GLYPHEN[cp]));
// Eigene Zeichen: Gedankenstrich, Anführungszeichen unten und oben, Pfeile.
setze(0x89, glyphe([0, 0, 0, 0x7f, 0, 0, 0, 0])); // –
setze(0x8a, glyphe([0, 0, 0, 0, 0, 0x36, 0x36, 0x12])); // „
setze(0x8b, glyphe([0x24, 0x36, 0x36, 0, 0, 0, 0, 0])); // “
setze(0x8c, glyphe([0x08, 0x0c, 0x0e, 0x0f, 0x0e, 0x0c, 0x08, 0])); // ◀
setze(0x8d, glyphe([0x02, 0x06, 0x0e, 0x1e, 0x0e, 0x06, 0x02, 0])); // ▶ (kleiner Pfeil in Texten)
setze(0x8e, glyphe([0x18, 0x18, 0x7e, 0x7e, 0x18, 0x18, 0, 0])); // ✚ (Steuerkreuz)
setze(0x8f, glyphe([0, 0, 0, 0, 0, 0, 0x49, 0])); // …
konstanten.push(['Z_AE', 0x80], ['Z_PFEIL_LINKS', 0x8c], ['Z_PFEIL_RECHTS', 0x8d], ['Z_KREUZ', 0x8e]);

// Auswahlpfeil (Kachel 0x0b), groß und mit Schatten.
setze(0x0b, glyphe([0x03, 0x0f, 0x3f, 0x7f, 0x3f, 0x0f, 0x03, 0]));
konstanten.push(['K_PFEIL', 0x0b]);

// Tafel (Ebene 2): Rand in Messing mit dunkler Kante, Innenfläche dunkles Holz.
function tafel(teil) {
  const k = leer();
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const links = teil.includes('L') ? x : 99;
      const rechts = teil.includes('R') ? 7 - x : 99;
      const oben = teil.includes('O') ? y : 99;
      const unten = teil.includes('U') ? 7 - y : 99;
      const d = Math.min(links, rechts, oben, unten);
      // Abgerundete Ecken: außerhalb des Viertelkreises durchsichtig.
      const ecke = (teil.includes('L') || teil.includes('R')) && (teil.includes('O') || teil.includes('U'));
      if (ecke) {
        const cx = teil.includes('L') ? 3.5 - x : x - 3.5;
        const cy = teil.includes('O') ? 3.5 - y : y - 3.5;
        if (cx > 0 && cy > 0 && cx * cx + cy * cy > 16) {
          k[y][x] = 0;
          continue;
        }
        const r = Math.sqrt(Math.max(cx, 0) ** 2 + Math.max(cy, 0) ** 2);
        if (cx > 0 && cy > 0) {
          k[y][x] = r > 3 ? 7 : r > 1.6 ? 6 : 5;
          continue;
        }
      }
      k[y][x] = d === 0 ? 7 : d === 1 ? 6 : d === 2 && (oben === 2 || links === 2) ? 8 : 5;
    }
  }
  return k;
}
const TAFEL = [
  ['K_TAFEL_OL', 0x01, 'LO'], ['K_TAFEL_O', 0x02, 'O'], ['K_TAFEL_OR', 0x03, 'RO'],
  ['K_TAFEL_L', 0x04, 'L'], ['K_TAFEL_M', 0x05, ''], ['K_TAFEL_R', 0x06, 'R'],
  ['K_TAFEL_UL', 0x07, 'LU'], ['K_TAFEL_U', 0x08, 'U'], ['K_TAFEL_UR', 0x09, 'RU'],
];
for (const [name, nr, teil] of TAFEL) {
  setze(nr, tafel(teil));
  konstanten.push([name, nr]);
}

// Filz (Ebene 2): ruhiges Muster aus zwei Grüntönen.
{
  const k = leer();
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) k[y][x] = (x * 3 + y * 5 + ((x * y) % 3)) % 7 === 0 ? 4 : 3;
  setze(0x0a, k);
  konstanten.push(['K_FILZ', 0x0a]);
}

// ---------------------------------------------------------------- Spielbrett-Felder (48 × 48)
const ZELLE = 48;
function holzfeld(x, y) {
  const maser = Math.sin(y * 0.55 + Math.sin(x * 0.09) * 2.2) + Math.sin(y * 1.7 + x * 0.05) * 0.35;
  return maser > 0.95 ? 3 : maser < -0.9 ? 1 : 2;
}
function feld(art) {
  const bild = [];
  const c = (ZELLE - 1) / 2;
  for (let y = 0; y < ZELLE; y++) {
    const zeile = [];
    for (let x = 0; x < ZELLE; x++) {
      let f = holzfeld(x, y);
      if (x < 2 || y < 2 || x >= ZELLE - 2 || y >= ZELLE - 2) f = 4;
      const dx = x - c;
      const dy = y - c;
      const geist = art.startsWith('geist');
      if (art.endsWith('kreuz')) {
        const halb = 15;
        const breite = geist ? 2.2 : 4.2;
        const d1 = Math.abs(dx - dy) / Math.SQRT2;
        const d2 = Math.abs(dx + dy) / Math.SQRT2;
        const innen = Math.abs(dx) <= halb && Math.abs(dy) <= halb;
        const d = Math.min(d1, d2);
        if (innen && d <= breite + 1.2) {
          if (geist) f = 9;
          else f = d > breite ? 6 : (d1 < d2 ? dx + dy : dx - dy) < -2 && d < breite - 1.5 ? 9 : 5;
        }
      }
      if (art.endsWith('kreis')) {
        const r = Math.sqrt(dx * dx + dy * dy);
        const radius = 13.5;
        const breite = geist ? 2 : 4;
        const abstand = Math.abs(r - radius);
        if (abstand <= breite + 1.2) {
          if (geist) f = 10;
          else f = abstand > breite ? 8 : dx + dy < -6 && abstand < breite - 1.5 ? 10 : 7;
        }
      }
      zeile.push(f);
    }
    bild.push(zeile);
  }
  return bild;
}
let naechste = 0x100;
for (const [name, art] of [
  ['K_FELD_LEER', 'leer'], ['K_FELD_KREUZ', 'kreuz'], ['K_FELD_KREIS', 'kreis'],
  ['K_FELD_GEIST_KREUZ', 'geist-kreuz'], ['K_FELD_GEIST_KREIS', 'geist-kreis'],
]) {
  zerlege(feld(art), naechste);
  konstanten.push([name, naechste]);
  naechste += 36;
}
konstanten.push(['FELD_KACHELN', ZELLE / 8]);

// Kleine Zeichen 16 × 16 für Spielerleisten (Palette PAL_BRETT, durchsichtiger Grund).
function klein(art) {
  const bild = [];
  for (let y = 0; y < 16; y++) {
    const zeile = [];
    for (let x = 0; x < 16; x++) {
      const dx = x - 7.5;
      const dy = y - 7.5;
      let f = 0;
      if (art === 'kreuz') {
        const d = Math.min(Math.abs(dx - dy), Math.abs(dx + dy)) / Math.SQRT2;
        if (Math.abs(dx) < 6.5 && Math.abs(dy) < 6.5 && d < 2.6) f = d > 1.6 ? 6 : 5;
      } else {
        const a = Math.abs(Math.sqrt(dx * dx + dy * dy) - 5);
        if (a < 2.4) f = a > 1.4 ? 8 : 7;
      }
      zeile.push(f);
    }
    bild.push(zeile);
  }
  return bild;
}
zerlege(klein('kreuz'), 0x0c);
zerlege(klein('kreis'), 0x10);
konstanten.push(['K_KLEIN_KREUZ', 0x0c], ['K_KLEIN_KREIS', 0x10]);

// ---------------------------------------------------------------- Titel in doppelter Größe
function grosseSchrift(text, start) {
  const zeichen = [...text];
  const b = zeichen.length * 16 + 8;
  const bild = Array.from({ length: 24 }, () => Array(b).fill(0));
  zeichen.forEach((z, i) => {
    const g = GLYPHEN[z.codePointAt(0)];
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (!((g[y] >> x) & 1)) continue;
        for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) bild[4 + y * 2 + sy][4 + i * 16 + x * 2 + sx] = 1;
      }
    }
  });
  // Dunkler Umriss und Schatten nach rechts unten.
  const umriss = bild.map((z) => [...z]);
  for (let y = 0; y < bild.length; y++) {
    for (let x = 0; x < b; x++) {
      if (bild[y][x]) continue;
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-2, -2], [-1, -2], [-2, -1], [-1, -1]]) {
        if (bild[y + oy]?.[x + ox] === 1) umriss[y][x] = 2;
      }
    }
  }
  return zerlege(umriss, start);
}
const titel = grosseSchrift('Brett & Blatt', 0x1c0);
konstanten.push(['K_TITEL', 0x1c0], ['TITEL_B', titel.b], ['TITEL_H', titel.h]);
const sechzehn = grosseSchrift('16', 0x1c0 + titel.b * titel.h);
konstanten.push(['K_TITEL_16', 0x1c0 + titel.b * titel.h], ['TITEL_16_B', sechzehn.b], ['TITEL_16_H', sechzehn.h]);

// ---------------------------------------------------------------- Ausgabe
const anzahl = kacheln.length;
const daten = Buffer.alloc(anzahl * 32);
for (let n = 0; n < anzahl; n++) {
  const k = kacheln[n] ?? leer();
  for (let y = 0; y < 8; y++) {
    let p0 = 0, p1 = 0, p2 = 0, p3 = 0;
    for (let x = 0; x < 8; x++) {
      const f = k[y][x];
      const bit = 7 - x;
      p0 |= (f & 1) << bit;
      p1 |= ((f >> 1) & 1) << bit;
      p2 |= ((f >> 2) & 1) << bit;
      p3 |= ((f >> 3) & 1) << bit;
    }
    daten[n * 32 + y * 2] = p0;
    daten[n * 32 + y * 2 + 1] = p1;
    daten[n * 32 + 16 + y * 2] = p2;
    daten[n * 32 + 16 + y * 2 + 1] = p3;
  }
}
writeFileSync(join(out, 'kacheln.bin'), daten);
writeFileSync(join(out, 'palette.bin'), palette);

const zeilen = [
  '/* Erzeugt von werkzeuge/grafik.mjs – nicht von Hand ändern. */',
  '#ifndef GRAFIK_H',
  '#define GRAFIK_H',
  `#define KACHEL_ANZAHL ${anzahl}`,
  ...PALETTEN.map(([name], i) => `#define ${name} ${i}`),
  ...konstanten.map(([name, wert]) => `#define ${name} 0x${wert.toString(16)}`),
  '#endif',
  '',
];
writeFileSync(join(out, 'grafik.h'), zeilen.join('\n'));
console.log(`Grafik: ${anzahl} Kacheln (${daten.length} Bytes), ${PALETTEN.length} Paletten`);
