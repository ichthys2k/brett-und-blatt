import { CREST_COLOR_SETS } from './crest-colors';

/*
 * Spielerwappen (Vorhaben #135, Schritt #147): Das Wappen eines Passes besteht aus Schildform, Teilung, Farben,
 * Wappentier und Zier. Es wird als kurzer Text gespeichert und übertragen, z. B.
 * `schild:klassisch;teilung:quer;farben:rot-gold;tier:🦊;zier:krone,rahmen;raum:1`. Die Farben sind eine Kennung aus
 * `crest-colors.ts` (2 bis 4 Farben, auch Städte, Länder, Vereine).
 *
 * Dieses Modul ist rein und ohne Browser: Die Oberfläche (`packages/ui`), die Web-App und der Raum auf dem Server prüfen
 * damit dieselbe Beschreibung. Was nicht erlaubt ist, wird beim Lesen verworfen – nie wird fremder Text ausgeführt oder
 * gezeichnet.
 */

export const CREST_SHIELDS = ['klassisch', 'rund', 'spitz', 'rolle'] as const;
export const CREST_DIVISIONS = ['einfarbig', 'quer', 'geteilt', 'schraeg'] as const;
export const CREST_COLORS: readonly string[] = CREST_COLOR_SETS.map((set) => set.id);
export const CREST_ORNAMENTS = ['rahmen', 'krone', 'lorbeer', 'band'] as const;

export type CrestShield = (typeof CREST_SHIELDS)[number];
export type CrestDivision = (typeof CREST_DIVISIONS)[number];
/** Kennung einer Farbkombination aus `CREST_COLOR_SETS` (z. B. `rot-gold`, `land-de`). */
export type CrestColors = string;
export type CrestOrnament = (typeof CREST_ORNAMENTS)[number];

export interface CrestSpec {
  shield: CrestShield;
  division: CrestDivision;
  colors: CrestColors;
  /** Das Wappentier: ein einzelnes Emoji (meist das Bild des Passes). */
  animal: string;
  ornaments: CrestOrnament[];
  /** Soll das Wappen im Raum neben dem Namen erscheinen? */
  inRoom: boolean;
}

export const DEFAULT_CREST: CrestSpec = { shield: 'klassisch', division: 'quer', colors: 'rot-gold', animal: '🎲', ornaments: [], inRoom: true };

/** Farben je Kombination (2 bis 4, Hex), nach Kennung. */
export const CREST_PALETTE: Readonly<Record<CrestColors, readonly string[]>> = Object.fromEntries(CREST_COLOR_SETS.map((set) => [set.id, set.colors]));

export const CREST_LABELS = {
  shield: { klassisch: 'Klassisch', rund: 'Rund', spitz: 'Spitz', rolle: 'Wappenrolle' },
  division: { einfarbig: 'Einfarbig', quer: 'Quer', geteilt: 'Geteilt', schraeg: 'Schräg' },
  colors: Object.fromEntries(CREST_COLOR_SETS.map((set) => [set.id, set.name])) as Readonly<Record<CrestColors, string>>,
  ornament: { rahmen: 'Rahmen', krone: 'Krone', lorbeer: 'Lorbeer', band: 'Band' },
} as const;

/** Hinweis für die Oberfläche: Städte, Länder und Vereine liefern nur Farben. */
export const CREST_COLORS_NOTICE = 'Nur Farben, keine offiziellen Zeichen der Städte, Länder oder Vereine.';

const MAX_TEXT = 120;
/** Genau ein Emoji: ein Piktogramm mit Varianten- und Hautton-Zeichen, auch mehrere durch Verbinder zu einem verbunden (👩‍🚀). */
const ANIMAL_PATTERN = /^\p{Extended_Pictographic}[\ufe0f\u{1F3FB}-\u{1F3FF}]?(?:\u200d\p{Extended_Pictographic}[\ufe0f\u{1F3FB}-\u{1F3FF}]?)*$/u;

const oneOf = <T extends string>(list: readonly T[], value: unknown): T | null => (typeof value === 'string' && (list as readonly string[]).includes(value) ? (value as T) : null);
const COLOR_IDS: ReadonlySet<string> = new Set(CREST_COLORS);

/** Liest eine Beschreibung. Fehlendes und Ungültiges fällt auf die Vorgabe zurück; `null`, wenn gar nichts Brauchbares da ist. */
export function parseCrest(text: unknown): CrestSpec | null {
  if (typeof text !== 'string' || text.length === 0 || text.length > MAX_TEXT) return null;
  const parts = new Map<string, string>();
  for (const piece of text.split(';')) {
    const at = piece.indexOf(':');
    if (at > 0) parts.set(piece.slice(0, at), piece.slice(at + 1));
  }
  const animal = parts.get('tier') ?? '';
  const ornaments = (parts.get('zier') ?? '')
    .split(',')
    .map((item) => oneOf(CREST_ORNAMENTS, item))
    .filter((item): item is CrestOrnament => item !== null);
  const spec: CrestSpec = {
    shield: oneOf(CREST_SHIELDS, parts.get('schild')) ?? DEFAULT_CREST.shield,
    division: oneOf(CREST_DIVISIONS, parts.get('teilung')) ?? DEFAULT_CREST.division,
    colors: COLOR_IDS.has(parts.get('farben') ?? '') ? parts.get('farben')! : DEFAULT_CREST.colors,
    animal: ANIMAL_PATTERN.test(animal) ? animal : DEFAULT_CREST.animal,
    ornaments: [...new Set(ornaments)],
    inRoom: parts.get('raum') !== '0',
  };
  return parts.size > 0 ? spec : null;
}

/** Die kurze Beschreibung zu einem Wappen (immer gültig und in fester Reihenfolge). */
export function serializeCrest(spec: CrestSpec): string {
  const ornaments = CREST_ORNAMENTS.filter((item) => spec.ornaments.includes(item));
  return `schild:${spec.shield};teilung:${spec.division};farben:${spec.colors};tier:${ANIMAL_PATTERN.test(spec.animal) ? spec.animal : DEFAULT_CREST.animal}${ornaments.length > 0 ? `;zier:${ornaments.join(',')}` : ''};raum:${spec.inRoom ? 1 : 0}`;
}

/** Für den Raum und für Ausweise: eine gültige Beschreibung in Normalform, sonst `undefined`. */
export function cleanCrest(text: unknown): string | undefined {
  const spec = parseCrest(text);
  return spec ? serializeCrest(spec) : undefined;
}

// ---------------------------------------------------------------- Freischalten

/** Was ein Pass bisher erreicht hat; daraus ergibt sich, welche Teile frei sind. */
export interface CrestProgress {
  stamps: number;
  /** Pokale = Siege. */
  trophies: number;
  wins: number;
  played: number;
  tournamentWins: number;
  /** In wie vielen Rubriken wurde jedes Spiel mindestens einmal gespielt? */
  categoriesComplete: number;
}

export interface Unlock {
  /** Ist das Teil frei? */
  ok: boolean;
  /** Was fehlt, z. B. „10 Stempel (du hast 5)“; leer, wenn frei. */
  hint: string;
}

type Need = { stat: keyof CrestProgress; min: number; text: string };

const NEED: Readonly<Record<string, Need | undefined>> = {
  'shield:rund': { stat: 'stamps', min: 5, text: 'Stempel' },
  'shield:spitz': { stat: 'stamps', min: 10, text: 'Stempel' },
  'shield:rolle': { stat: 'stamps', min: 20, text: 'Stempel' },
  'division:geteilt': { stat: 'stamps', min: 3, text: 'Stempel' },
  'division:schraeg': { stat: 'stamps', min: 5, text: 'Stempel' },
  'colors:schwarz-gold': { stat: 'wins', min: 10, text: 'Siege' },
  'colors:purpur-silber': { stat: 'categoriesComplete', min: 1, text: 'komplette Rubrik' },
  'colors:orange-blau': { stat: 'played', min: 25, text: 'Partien' },
  'ornament:rahmen': { stat: 'trophies', min: 3, text: 'Pokale' },
  'ornament:krone': { stat: 'trophies', min: 5, text: 'Pokale' },
  'ornament:lorbeer': { stat: 'tournamentWins', min: 1, text: 'Turniersieg' },
  'ornament:band': { stat: 'categoriesComplete', min: 1, text: 'komplette Rubrik' },
};

/** Ist ein Teil frei? `kind`: schild, teilung (division), farben (colors) oder zier (ornament). */
export function unlockOf(kind: 'shield' | 'division' | 'colors' | 'ornament', value: string, progress: CrestProgress): Unlock {
  const need = NEED[`${kind}:${value}`];
  if (!need) return { ok: true, hint: '' };
  const have = progress[need.stat];
  if (have >= need.min) return { ok: true, hint: '' };
  return { ok: false, hint: `${need.min} ${need.text} (du hast ${have})` };
}

/** Wirft alle noch nicht freigeschalteten Teile aus einem Wappen (Vorgabe statt Teil). */
export function clampCrest(spec: CrestSpec, progress: CrestProgress): CrestSpec {
  return {
    ...spec,
    shield: unlockOf('shield', spec.shield, progress).ok ? spec.shield : DEFAULT_CREST.shield,
    division: unlockOf('division', spec.division, progress).ok ? spec.division : DEFAULT_CREST.division,
    colors: unlockOf('colors', spec.colors, progress).ok ? spec.colors : DEFAULT_CREST.colors,
    ornaments: spec.ornaments.filter((item) => unlockOf('ornament', item, progress).ok),
  };
}
