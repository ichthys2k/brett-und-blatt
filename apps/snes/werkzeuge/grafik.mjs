#!/usr/bin/env node
/*
 * Erzeugt die Grafik von Brett & Blatt 16 ohne Bildbearbeitung: Schrift, Rahmen, Filz,
 * Spielbrett-Felder und Titel werden hier aus Formeln gezeichnet und als SNES-Kacheln
 * (4 Bit je Bildpunkt) samt Farbpaletten geschrieben.
 *
 *   node werkzeuge/grafik.mjs <ausgabeordner>
 *
 * Ausgabe:
 *   kacheln_a.bin, kacheln_b.bin  Kacheldaten (je höchstens 512 Kacheln, für zwei ROM-Abschnitte)
 *   palette.bin                   die acht Hintergrundpaletten beim Start (BGR555)
 *   karten.bin                    Kachelkarten der Bilder (u16 je Kachel, zeilenweise)
 *   spielfarben.bin               je Spiel drei Brettpaletten (Paletten 5–7)
 *   grafik.h                      Kachelnummern, Kartenadressen und Farben als C-Konstanten
 *
 * Feste Kacheln (Schrift, Tafeln) liegen unter 0x100; alle Bilder werden ab 0x100 in Kacheln
 * zerlegt, gleiche Kacheln nur einmal abgelegt.
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

/*
 * Brettpaletten folgen in allen Spielen derselben Belegung, damit ein Bild mit jeder der drei
 * Paletten (normal, Cursor, markiert) passt: 1–3 Grund hell/mittel/dunkel, 4 Linien,
 * 5/6/9 Spielstein A (Farbe, Kante, Licht), 7/8/10 Spielstein B, 11 Hinweis/Krone, 12 Loch.
 */
const STEIN_ROT = { 5: '#c8352c', 6: '#7c1c17', 9: '#f2806e' };
const STEIN_BLAU = { 7: '#2f62b8', 8: '#173570', 10: '#7fb0f4' };
const holz = (hell, mittel, dunkel) => ({
  1: hell, 2: mittel, 3: dunkel,
  4: '#3e2814', // Gitter
  ...STEIN_ROT, // Kreuz
  ...STEIN_BLAU, // Kreis
  11: '#f4ead2',
});

export const PALETTEN = [
  ['PAL_TEXT', schrift('#f4ecd8')],
  ['PAL_GELB', schrift('#f8d048')],
  ['PAL_GRAU', schrift('#8c8a84')],
  ['PAL_ROT', schrift('#f07060')],
  ['PAL_BLAU', schrift('#78aaf4')],
  ['PAL_BRETT', holz('#dcb27a', '#c99c64', '#ad8049')],
  ['PAL_BRETT_AUSWAHL', holz('#fff6c4', '#fbe79a', '#efd277')],
  ['PAL_BRETT_MARKE', holz('#9ee08a', '#86cc72', '#68b058')],
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
setze(0x90, glyphe([0x08, 0x1c, 0x3e, 0x7f, 0x1c, 0x1c, 0x1c, 0])); // ▲
setze(0x91, glyphe([0x1c, 0x1c, 0x1c, 0x7f, 0x3e, 0x1c, 0x08, 0])); // ▼
setze(0x92, glyphe([0x1c, 0x3e, 0x7f, 0x7f, 0x7f, 0x3e, 0x1c, 0])); // ●
setze(0x93, glyphe([0x1c, 0x22, 0x41, 0x41, 0x41, 0x22, 0x1c, 0])); // ○

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

// ---------------------------------------------------------------- Bilder mit Dedup
/** Kacheln ab 0x100: gleiche Kacheln werden nur einmal abgelegt. */
const kachelIndex = new Map();
let naechsteKachel = 0x100;
const KACHELN_MAX = 0x400;
const karten = [];
let kartenBytes = 0;

function kachelFuer(k) {
  const schluessel = k.map((z) => z.join(',')).join(';');
  let nr = kachelIndex.get(schluessel);
  if (nr === undefined) {
    if (naechsteKachel >= KACHELN_MAX) throw new Error('Zu viele Kacheln – Bilder verkleinern oder zusammenlegen.');
    nr = naechsteKachel++;
    kachelIndex.set(schluessel, nr);
    setze(nr, k);
  }
  return nr;
}

/** Zerlegt ein Bild in Kacheln und legt die Kachelkarte ab. Gibt die Kartenadresse zurück. */
function karte(name, bild) {
  const h = bild.length / 8;
  const b = bild[0].length / 8;
  if (!Number.isInteger(h) || !Number.isInteger(b)) throw new Error(`${name}: Maße kein Vielfaches von 8`);
  const adresse = kartenBytes;
  const eintraege = [];
  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < b; tx++) {
      const k = leer();
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) k[y][x] = bild[ty * 8 + y][tx * 8 + x];
      eintraege.push(kachelFuer(k));
    }
  }
  karten.push(...eintraege);
  kartenBytes += eintraege.length * 2;
  if (name) konstanten.push([`KARTE_${name}`, adresse]);
  return { adresse, b, h };
}

/** Bild als Funktion der Bildpunkte (x, y) → Farbindex. */
function male(b, h, f) {
  return Array.from({ length: h }, (_, y) => Array.from({ length: b }, (_, x) => f(x, y)));
}

/** Je Spiel drei Brettpaletten (normal, Cursor, markiert) für die Paletten 5–7. */
const spielfarben = [];
function farben(name, paletten) {
  konstanten.push([`FARBEN_${name}`, spielfarben.length * 96]);
  for (const p of paletten) {
    for (let i = 0; i < 16; i++) spielfarben.push(p[i] ? bgr555(hex(p[i])) : 0);
  }
}

/** Ein runder Spielstein mit Kante und Lichtpunkt oben links (Farben: Haupt, Kante, Licht). */
function stein(dx, dy, r, [haupt, kante, licht]) {
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > r) return null;
  if (d > r - 1.2) return kante;
  const l = Math.sqrt((dx + r * 0.35) ** 2 + (dy + r * 0.35) ** 2);
  if (l < r * 0.32) return licht;
  if (dx + dy > r * 0.75) return kante;
  return haupt;
}
const A = [5, 6, 9];
const B = [7, 8, 10];

// ---------------------------------------------------------------- Tic-Tac-Toe: Felder 48 × 48
const ZELLE = 48;
function holzfeld(x, y) {
  const maser = Math.sin(y * 0.55 + Math.sin(x * 0.09) * 2.2) + Math.sin(y * 1.7 + x * 0.05) * 0.35;
  return maser > 0.95 ? 3 : maser < -0.9 ? 1 : 2;
}
function zeichenPunkt(art, dx, dy, groesse) {
  // Kreuz oder Kreis um den Mittelpunkt, `groesse` = halbe Breite des Zeichens.
  const geist = art.startsWith('geist');
  if (art.endsWith('kreuz')) {
    const breite = (geist ? 2.2 : 4.2) * (groesse / 15);
    const d1 = Math.abs(dx - dy) / Math.SQRT2;
    const d2 = Math.abs(dx + dy) / Math.SQRT2;
    const d = Math.min(d1, d2);
    if (Math.abs(dx) <= groesse && Math.abs(dy) <= groesse && d <= breite + 1.2) {
      if (geist) return 9;
      return d > breite ? 6 : (d1 < d2 ? dx + dy : dx - dy) < -2 && d < breite - 1.5 ? 9 : 5;
    }
  }
  if (art.endsWith('kreis')) {
    const radius = groesse * 0.9;
    const breite = (geist ? 2 : 4) * (groesse / 15);
    const abstand = Math.abs(Math.sqrt(dx * dx + dy * dy) - radius);
    if (abstand <= breite + 1.2) {
      if (geist) return 10;
      return abstand > breite ? 8 : dx + dy < -6 && abstand < breite - 1.5 ? 10 : 7;
    }
  }
  return null;
}
function tttFeld(art, groesse = ZELLE, rand = 2) {
  const c = (groesse - 1) / 2;
  return male(groesse, groesse, (x, y) => {
    if (x < rand || y < rand || x >= groesse - rand || y >= groesse - rand) return 4;
    if (art === 'remis' && (x + y) % 6 < 2) return 3;
    return zeichenPunkt(art, x - c, y - c, groesse * 0.31) ?? holzfeld(x, y);
  });
}
for (const [name, art] of [
  ['TTT_LEER', 'leer'], ['TTT_KREUZ', 'kreuz'], ['TTT_KREIS', 'kreis'],
  ['TTT_GEIST_KREUZ', 'geist-kreuz'], ['TTT_GEIST_KREIS', 'geist-kreis'], ['TTT_REMIS', 'remis'],
]) karte(name, tttFeld(art));
farben('TTT', [
  holz('#dcb27a', '#c99c64', '#ad8049'),
  holz('#fff6c4', '#fbe79a', '#efd277'),
  holz('#9ee08a', '#86cc72', '#68b058'),
]);

// ---------------------------------------------------------------- Ultimate Tic-Tac-Toe: Felder 16 × 16
for (const [name, art] of [
  ['UTTT_LEER', 'leer'], ['UTTT_KREUZ', 'kreuz'], ['UTTT_KREIS', 'kreis'],
  ['UTTT_GEIST_KREUZ', 'geist-kreuz'], ['UTTT_GEIST_KREIS', 'geist-kreis'],
]) karte(name, tttFeld(art, 16, 1));
farben('UTTT', [
  holz('#a88458', '#987650', '#7e6040'), // gesperrt: dunkles Holz
  holz('#e8c690', '#d9b47a', '#bf9660'), // spielbar: helles Holz
  holz('#fff2a0', '#f6dc70', '#e2c050'), // Cursor und Gewinnreihe
]);

// ---------------------------------------------------------------- Vier in einer Reihe
const vierFarben = (hell, mittel, dunkel) => ({
  1: hell, 2: mittel, 3: dunkel, 4: '#0e1c33', 12: '#081222',
  5: '#d8352a', 6: '#7e1812', 9: '#ff8a70', // Rot
  7: '#f2c522', 8: '#9a7408', 10: '#fff08a', // Gelb
});
farben('VIER', [
  vierFarben('#3f74d8', '#2f5fbe', '#22489a'),
  vierFarben('#6b9cf2', '#5689e4', '#4472c8'),
  vierFarben('#7fd26a', '#64bc52', '#4e9e40'),
]);
for (const s of [24, 16]) {
  const c = (s - 1) / 2;
  const r = s * 0.4;
  const loch = (art) => male(s, s, (x, y) => {
    const dx = x - c;
    const dy = y - c;
    if (art !== 'leer') {
      const f = stein(dx, dy, r, art === 'rot' ? A : B);
      if (f !== null) return f;
    }
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d <= r) return 12;
    if (d <= r + 1) return 3;
    return (x + y) % 9 === 0 ? 1 : 2;
  });
  const frei = (art) => male(s, s, (x, y) => stein(x - c, y - c, r, art === 'rot' ? A : B) ?? 0);
  karte(`VIER${s}_LEER`, loch('leer'));
  karte(`VIER${s}_ROT`, loch('rot'));
  karte(`VIER${s}_GELB`, loch('gelb'));
  karte(`VIER${s}_SCHWEBE_ROT`, frei('rot'));
  karte(`VIER${s}_SCHWEBE_GELB`, frei('gelb'));
}

// ---------------------------------------------------------------- Reversi: Felder 16 × 16
const gruen = (hell, mittel, dunkel) => ({
  1: hell, 2: mittel, 3: dunkel, 4: '#0c2a18', 11: '#e8cc6a',
  5: '#202020', 6: '#000000', 9: '#6a6a6a', // Schwarz
  7: '#e8e8e0', 8: '#9a9a90', 10: '#ffffff', // Weiß
});
farben('REVERSI', [gruen('#2f8a4e', '#277a44', '#1f6838'), gruen('#52b070', '#45a062', '#378a52'), gruen('#c9a83c', '#b89632', '#9a7c28')]);
{
  const s = 16;
  const c = 7.5;
  const feld = (art) => male(s, s, (x, y) => {
    if (x === s - 1 || y === s - 1) return 4;
    const dx = x - c + 0.5;
    const dy = y - c + 0.5;
    if (art === 'schwarz' || art === 'weiss') {
      const f = stein(dx, dy, 6.2, art === 'schwarz' ? A : B);
      if (f !== null) return f;
    }
    if (art === 'hinweis' && dx * dx + dy * dy < 4) return 11;
    return 2;
  });
  for (const art of ['leer', 'schwarz', 'weiss', 'hinweis']) karte(`REVERSI_${art.toUpperCase()}`, feld(art));
}

// ---------------------------------------------------------------- Gomoku: Schnittpunkte 8 × 8
farben('GOMOKU', [
  { ...gruen('#d8b070', '#cfa464', '#b88c50'), 4: '#3a2410' },
  { ...gruen('#fff0b0', '#f8e098', '#e8c880'), 4: '#3a2410' },
  { ...gruen('#a8e090', '#98d080', '#80b868'), 4: '#3a2410' },
]);
{
  // Art: Linien nach oben/unten/links/rechts und Sternpunkt; Inhalt: leer, schwarz, weiß.
  for (const [n, o, u, l, r, stern] of [
    ['MITTE', 1, 1, 1, 1, 0], ['STERN', 1, 1, 1, 1, 1], ['OBEN', 0, 1, 1, 1, 0], ['UNTEN', 1, 0, 1, 1, 0],
    ['LINKS', 1, 1, 0, 1, 0], ['RECHTS', 1, 1, 1, 0, 0], ['OL', 0, 1, 0, 1, 0], ['OR', 0, 1, 1, 0, 0],
    ['UL', 1, 0, 0, 1, 0], ['UR', 1, 0, 1, 0, 0],
  ]) {
    for (const inhalt of ['LEER', 'SCHWARZ', 'WEISS']) {
      karte(`GOMOKU_${n}_${inhalt}`, male(8, 8, (x, y) => {
        if (inhalt !== 'LEER') {
          const f = stein(x - 3.5, y - 3.5, 3.6, inhalt === 'SCHWARZ' ? A : B);
          if (f !== null) return f;
        }
        if (stern && Math.abs(x - 3.5) < 1.5 && Math.abs(y - 3.5) < 1.5) return 4;
        if (x === 3 && ((y <= 3 && o) || (y >= 3 && u))) return 4;
        if (y === 3 && ((x <= 3 && l) || (x >= 3 && r))) return 4;
        return holzfeld(x * 2, y * 2);
      }));
    }
  }
}

// ---------------------------------------------------------------- Mühle: Raster 7 × 7, je 24 × 24
farben('MUEHLE', [
  { ...holz('#dcb27a', '#c99c64', '#ad8049'), 5: '#efe6d2', 6: '#7a6a50', 9: '#ffffff', 7: '#2c2620', 8: '#000000', 10: '#6a6058' },
  { ...holz('#fff6c4', '#fbe79a', '#efd277'), 5: '#efe6d2', 6: '#7a6a50', 9: '#ffffff', 7: '#2c2620', 8: '#000000', 10: '#6a6058' },
  { ...holz('#9ee08a', '#86cc72', '#68b058'), 5: '#efe6d2', 6: '#7a6a50', 9: '#ffffff', 7: '#2c2620', 8: '#000000', 10: '#6a6058' },
]);
{
  // Punkte wie packages/games/mill/src/board.ts: Ring * 8 + j, j im Uhrzeigersinn ab links oben.
  const SCHRITTE = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [0, 1]];
  const punkte = [];
  for (let p = 0; p < 24; p++) {
    const ring = Math.floor(p / 8);
    const [px, py] = SCHRITTE[p % 8];
    punkte.push([ring + px * (3 - ring), ring + py * (3 - ring)]);
  }
  const nachbarn = punkte.map((_, p) => {
    const ring = Math.floor(p / 8);
    const j = p % 8;
    const n = [ring * 8 + ((j + 1) % 8), ring * 8 + ((j + 7) % 8)];
    if (j % 2 === 1) {
      if (ring > 0) n.push(p - 8);
      if (ring < 2) n.push(p + 8);
    }
    return n;
  });
  // Linienstücke im Raster: Für jede Verbindung alle Rasterzellen dazwischen markieren.
  const linien = Array.from({ length: 49 }, () => ({ o: 0, u: 0, l: 0, r: 0 }));
  nachbarn.forEach((ns, p) => {
    for (const q of ns) {
      const [x1, y1] = punkte[p];
      const [x2, y2] = punkte[q];
      const dx = Math.sign(x2 - x1);
      const dy = Math.sign(y2 - y1);
      for (let x = x1, y = y1; x !== x2 || y !== y2; x += dx, y += dy) {
        const z = linien[y * 7 + x];
        const w = linien[(y + dy) * 7 + x + dx];
        if (dx > 0) (z.r = 1), (w.l = 1);
        if (dx < 0) (z.l = 1), (w.r = 1);
        if (dy > 0) (z.u = 1), (w.o = 1);
        if (dy < 0) (z.o = 1), (w.u = 1);
      }
    }
  });
  const istPunkt = new Set(punkte.map(([x, y]) => y * 7 + x));
  // Karten zusammenhängend: (y * 7 + x) * 3 + Inhalt, Inhalt 0 leer, 1 weiß, 2 schwarz.
  let erste = null;
  for (let i = 0; i < 49; i++) {
    for (let inhalt = 0; inhalt < 3; inhalt++) {
      const { o, u, l, r } = linien[i];
      const punkt = istPunkt.has(i);
      const k = karte(null, male(24, 24, (x, y) => {
        const dx = x - 11.5;
        const dy = y - 11.5;
        if (punkt && inhalt > 0) {
          const f = stein(dx, dy, 9.5, inhalt === 1 ? A : B);
          if (f !== null) return f;
        }
        if (punkt && dx * dx + dy * dy < 9) return 4;
        const aufV = Math.abs(dx) < 1.5;
        const aufH = Math.abs(dy) < 1.5;
        if (aufV && ((dy < 0 && o) || (dy > 0 && u))) return 4;
        if (aufH && ((dx < 0 && l) || (dx > 0 && r))) return 4;
        return holzfeld(x, y);
      }));
      if (erste === null) erste = k.adresse;
    }
  }
  konstanten.push(['KARTE_MUEHLE', erste]);
}

// ---------------------------------------------------------------- Dame: Felder 16 × 16
const dameFarben = (hell, dunkel, dunkel2) => ({
  1: hell, 2: dunkel, 3: dunkel2, 4: '#2a1a0c', 11: '#f0c030',
  5: '#f2ead8', 6: '#8a7a5c', 9: '#ffffff', // Weiß
  7: '#3a2a22', 8: '#100806', 10: '#7a6458', // Schwarz
});
farben('DAME', [
  dameFarben('#ecd6a8', '#8a5a34', '#76492a'),
  dameFarben('#fff2c0', '#c89a54', '#b08444'),
  dameFarben('#bfe8a0', '#5e9a44', '#4c8236'),
]);
{
  const feld = (dunkel, art) => male(16, 16, (x, y) => {
    const dx = x - 7.5;
    const dy = y - 7.5;
    if (art !== 'leer') {
      const farbe = art.startsWith('weiss') ? A : B;
      const f = stein(dx, dy, 6.6, farbe);
      if (f !== null) {
        // Dame: Krone als goldener Ring in der Mitte.
        if (art.endsWith('dame') && Math.abs(Math.sqrt(dx * dx + dy * dy) - 3) < 1) return 11;
        return f;
      }
    }
    if (!dunkel) return 1;
    return (x * 3 + y * 7) % 11 === 0 ? 3 : 2;
  });
  karte('DAME_HELL', feld(false, 'leer'));
  for (const art of ['leer', 'weiss', 'schwarz', 'weiss-dame', 'schwarz-dame']) karte(`DAME_${art.toUpperCase().replace('-', '_')}`, feld(true, art));
}

// ---------------------------------------------------------------- Titel in doppelter Größe
function grosseSchrift(name, text) {
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
  const k = karte(name, umriss);
  konstanten.push([`${name}_B`, k.b], [`${name}_H`, k.h]);
}
grosseSchrift('TITEL', 'Brett & Blatt');
grosseSchrift('TITEL_16', '16');

// ---------------------------------------------------------------- Ausgabe
const anzahl = naechsteKachel;
function kachelBytes(von, bis) {
  const daten = Buffer.alloc(Math.max(0, bis - von) * 32);
  for (let n = von; n < bis; n++) {
    const k = kacheln[n] ?? leer();
    const o = (n - von) * 32;
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
      daten[o + y * 2] = p0;
      daten[o + y * 2 + 1] = p1;
      daten[o + 16 + y * 2] = p2;
      daten[o + 16 + y * 2 + 1] = p3;
    }
  }
  return daten;
}
const teilA = kachelBytes(0, Math.min(anzahl, 512));
// Der zweite Teil ist nie leer, damit die DMA-Länge nicht 0 ist (0 hieße 64 KB).
const teilB = anzahl > 512 ? kachelBytes(512, anzahl) : kachelBytes(512, 513);
writeFileSync(join(out, 'kacheln_a.bin'), teilA);
writeFileSync(join(out, 'kacheln_b.bin'), teilB);
writeFileSync(join(out, 'palette.bin'), palette);
const kartenDaten = Buffer.alloc(karten.length * 2);
karten.forEach((k, i) => kartenDaten.writeUInt16LE(k, i * 2));
writeFileSync(join(out, 'karten.bin'), kartenDaten);
const farbDaten = Buffer.alloc(spielfarben.length * 2);
spielfarben.forEach((f, i) => farbDaten.writeUInt16LE(f, i * 2));
writeFileSync(join(out, 'spielfarben.bin'), farbDaten);

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
console.log(`Grafik: ${anzahl} Kacheln, ${kartenDaten.length} Bytes Karten, ${spielfarben.length / 48} Farbsätze`);
