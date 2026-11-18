import { PIXEL_PIECES } from './pixelfiguren';
import type { Era } from './zeitreise';

/**
 * Figuren der Zeitmaschine (#512). Grundlage ist der klassische, kontrastreiche Satz (`figuren/classic-*.svg`):
 * 1455 mit Tinte gezeichnet, 1910 im Zeitungsraster, 1982 als ASCII-Zeichnung, 1989 als Pixelfigur. Die übrigen
 * Jahrgänge zeigen den klassischen Satz, Film, Band und Bildschirm färben ihn über CSS.
 * Alles liegt im Feld: Zeichenfläche 100 × 100, die Figur selbst bleibt innerhalb von etwa 10 bis 90.
 */
type PieceType = 'k' | 'q' | 'r' | 'b' | 'n' | 'p';

const CLASSIC = import.meta.glob<string>('./figuren/classic-*.svg', { eager: true, query: '?raw', import: 'default' });

/** Inneres einer klassischen Figur ohne Bodenschatten. */
function classicInner(type: PieceType, white: boolean): string {
  const raw = CLASSIC[`./figuren/classic-${type}-${white ? 'w' : 'b'}.svg`] ?? '';
  return raw
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/<ellipse[^>]*\/>/, '');
}

/** Farben der klassischen Figuren: Kontur, Körper, Schatten, (nur Schwarz) Glanzlinien. */
const WHITE_COLORS = ['#2e2c29', '#faf6ed', '#dfd6c5'] as const;
const BLACK_COLORS = ['#1b1a18', '#4a4744', '#2e2c2a', '#cfc8bc'] as const;

function recolor(svg: string, white: boolean, map: string[]): string {
  const from = white ? WHITE_COLORS : BLACK_COLORS;
  let out = svg;
  from.forEach((color, i) => {
    out = out.split(`"${color}"`).join(`"${map[i] ?? color}"`);
  });
  return out;
}

/** Tinte: Feder mit leicht zitterndem Strich, Schatten als Schraffur. */
const INK_DEFS =
  '<defs>' +
  '<filter id="ch-ink" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="2" seed="7"/><feDisplacementMap in="SourceGraphic" scale="2.6"/></filter>' +
  '<pattern id="ch-hatch" width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><rect width="3.2" height="3.2" fill="#f4ead2"/><line x1="0" y1="0" x2="0" y2="3.2" stroke="#1c1410" stroke-width="1.1"/></pattern>' +
  '</defs>';

/** Zeitungsdruck: Rasterpunkte statt Flächen. */
const PRINT_DEFS =
  '<defs>' +
  '<pattern id="ch-dots-light" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="#ece2c8"/><circle cx="2" cy="2" r="0.9" fill="#1f1b15"/></pattern>' +
  '<pattern id="ch-dots-dark" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="#ece2c8"/><circle cx="2" cy="2" r="1.85" fill="#1f1b15"/></pattern>' +
  '<filter id="ch-press"><feGaussianBlur stdDeviation="0.35"/></filter>' +
  '</defs>';

function inkPiece(type: PieceType, white: boolean): string {
  const inner = recolor(classicInner(type, white), white, white ? ['#1c1410', '#f4ead2', 'url(#ch-hatch)'] : ['#1c1410', '#1c1410', '#1c1410', '#efe3c4']);
  return `${INK_DEFS}<g filter="url(#ch-ink)">${inner}</g>`;
}

function printPiece(type: PieceType, white: boolean): string {
  const inner = recolor(classicInner(type, white), white, white ? ['#1f1b15', '#ece2c8', 'url(#ch-dots-light)'] : ['#1f1b15', 'url(#ch-dots-dark)', '#1f1b15', '#ece2c8']);
  return `${PRINT_DEFS}<g filter="url(#ch-press)">${inner}</g>`;
}

/** ASCII-Zeichnungen für das grüne Terminal, je fünf Zeilen zu sieben Zeichen. */
const ASCII: Record<PieceType, string[]> = {
  k: ['  _+_  ', '  \\ /  ', '  ( )  ', '  / \\  ', ' /___\\ '],
  q: [' \\^^^/ ', '  \\ /  ', '  ( )  ', '  / \\  ', ' /___\\ '],
  r: [' n_n_n ', ' \\   / ', '  | |  ', '  | |  ', ' /___\\ '],
  b: ['   o   ', '  (/)  ', '  ( )  ', '  / \\  ', ' /___\\ '],
  n: ['  ,^,  ', ' /  o\\ ', ' \\_  ) ', '  / \\  ', ' /___\\ '],
  p: ['       ', '   _   ', '  ( )  ', '  / \\  ', ' /___\\ '],
};

// Leerzeichen als geschützte Leerzeichen, sonst schluckt der HTML-Parser sie und die Zeichnung verrutscht.
const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/ /g, '\u00a0');

/** Weiß leuchtet grün, Schwarz steht in Umkehrdarstellung (dunkle Zeichen auf grünem Block). */
function asciiPiece(type: PieceType, white: boolean): string {
  const lines = ASCII[type]
    .map((line, i) => `<text x="50" y="${25 + i * 15}" textLength="76" lengthAdjust="spacingAndGlyphs">${escapeXml(line)}</text>`)
    .join('');
  const block = white ? '' : '<rect x="12" y="12" width="76" height="78" rx="4" fill="#3dff7a" opacity="0.8"/>';
  return `${block}<g font-family="ui-monospace, 'Cascadia Mono', 'Courier New', monospace" font-size="15" font-weight="700" text-anchor="middle" fill="${white ? '#3dff7a' : '#041409'}">${lines}</g>`;
}

/** Vier Stufen der Flüssigkristall-Anzeige, hell bis dunkel; Schwarz eine Stufe dunkler. */
const LCD = ['#dbe6bd', '#8c9a6c', '#4c5a37', '#28321d'];

function pixelPiece(type: PieceType, white: boolean): string {
  const rows = PIXEL_PIECES[`${type}${white ? 'w' : 'b'}`] ?? [];
  const cell = 100 / 16;
  let rects = '';
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      const level = Math.min(3, Number(ch) + (white ? 0 : 1));
      rects += `<rect x="${(x * cell).toFixed(2)}" y="${(y * cell).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}" fill="${LCD[level]}"/>`;
    });
  });
  return `<g shape-rendering="crispEdges">${rects}</g>`;
}

/**
 * Pixelschlacht (1988): Dieselben Pixelfiguren werden zu kleinen Kriegern mit Augen. Beide Armeen nutzen die
 * Form der weißen Figur; die Farben unterscheiden sie: Silber mit dunklen Augen gegen Schwarz mit glühenden Augen.
 */
const ARMY_WHITE = ['#f7f4ec', '#c6cddc', '#7c87a2', '#1b1f2e'];
const ARMY_BLACK = ['#6d7284', '#4a4e5c', '#2c2f38', '#0b0c10'];
const EYES: Record<PieceType, [number, number][]> = {
  k: [[7, 7], [9, 7]],
  q: [[7, 8], [9, 8]],
  r: [[7, 8], [9, 8]],
  b: [[7, 8]],
  n: [[7, 5]],
  p: [[7, 5], [9, 5]],
};

export function battleSpriteMarkup(type: PieceType, white: boolean): string {
  const rows = PIXEL_PIECES[`${type}w`] ?? [];
  const palette = white ? ARMY_WHITE : ARMY_BLACK;
  const cell = 100 / 16;
  const px = (x: number, y: number, fill: string) =>
    `<rect x="${(x * cell).toFixed(2)}" y="${(y * cell).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}" fill="${fill}"/>`;
  let rects = '';
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch !== '.') rects += px(x, y, palette[Number(ch)] ?? palette[3]!);
    });
  });
  const eyes = EYES[type].map(([x, y]) => px(x, y, white ? '#1b1f2e' : '#ff4a3d')).join('');
  return `<g shape-rendering="crispEdges">${rects}<g class="ch-battle-eyes">${eyes}</g></g>`;
}

const DRAWN: Partial<Record<Era, (type: PieceType, white: boolean) => string>> = {
  '1988': battleSpriteMarkup,
  '1455': inkPiece,
  '1910': printPiece,
  '1982': asciiPiece,
  '1989': pixelPiece,
};

const cache = new Map<string, string>();

/** Gezeichnete Figur des Jahrgangs als SVG-Inhalt – oder `null`, dann gilt der klassische Satz. */
export function eraPieceMarkup(era: Era, type: PieceType, white: boolean): string | null {
  const draw = DRAWN[era];
  if (!draw) return null;
  const key = `${era}${type}${white ? 'w' : 'b'}`;
  let markup = cache.get(key);
  if (markup === undefined) {
    markup = draw(type, white);
    cache.set(key, markup);
  }
  return markup;
}

export function EraPiece({ era, type, white }: { era: Era; type: PieceType; white: boolean }) {
  const markup = eraPieceMarkup(era, type, white);
  if (markup === null) return null;
  // Eigene, feste Zeichnungen aus dem Repo – keine Eingaben von außen.
  return <svg className="ch-piece-img ch-era-piece" viewBox="0 0 100 100" aria-hidden="true" dangerouslySetInnerHTML={{ __html: markup }} />;
}
