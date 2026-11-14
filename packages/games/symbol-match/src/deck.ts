/**
 * Der Kartensatz von „Fix gefunden!“: eine endliche projektive Ebene der Ordnung n (n eine
 * Primzahl). Sie liefert n² + n + 1 Karten mit je n + 1 Symbolen aus n² + n + 1 Symbolen; je
 * zwei Karten haben genau ein Symbol gemeinsam.
 */

export type Order = 3 | 5 | 7;

export const ORDERS: Order[] = [3, 5, 7];

/** Zahl der Karten (und der Symbole) einer Ordnung. */
export function deckSize(order: Order): number {
  return order * order + order + 1;
}

const cache = new Map<Order, number[][]>();

/**
 * Alle Karten einer Ordnung, jede als Liste ihrer Symbol-Nummern.
 * Punkte (x, y) sind Symbol x·n + y, die Fernpunkte der Steigungen a sind n² + a, der Fernpunkt
 * der senkrechten Geraden ist n² + n. Jede Karte ist eine Gerade.
 */
export function buildCards(order: Order): number[][] {
  const hit = cache.get(order);
  if (hit) return hit;
  const n = order;
  const cards: number[][] = [];
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) {
      const card: number[] = [];
      for (let x = 0; x < n; x++) card.push(x * n + ((a * x + b) % n));
      card.push(n * n + a);
      cards.push(card);
    }
  }
  for (let b = 0; b < n; b++) {
    const card: number[] = [];
    for (let y = 0; y < n; y++) card.push(b * n + y);
    card.push(n * n + n);
    cards.push(card);
  }
  cards.push(Array.from({ length: n + 1 }, (_, i) => n * n + i));
  cache.set(order, cards);
  return cards;
}

/** Das eine gemeinsame Symbol zweier Karten. */
export function shared(order: Order, a: number, b: number): number {
  const cards = buildCards(order);
  const other = new Set(cards[b]!);
  return cards[a]!.find((s) => other.has(s)) ?? -1;
}

// ── Symbolpakete ─────────────────────────────────────────────────────────────

export type SymbolSet = 'emoji' | 'animals' | 'bible' | 'math' | 'fractions';

export const SYMBOL_SETS: { value: SymbolSet; label: string }[] = [
  { value: 'emoji', label: 'Bunte Emojis' },
  { value: 'animals', label: 'Tiere' },
  { value: 'bible', label: 'Bibel' },
  { value: 'math', label: 'Mathe (gleicher Wert)' },
  { value: 'fractions', label: 'Brüche & Einheiten' },
];

const EMOJI = [...'🍎🚗⭐🌙🔥💧🎈🎁🔔🎵📚🏠🌳🌸🍕🍦⚽🚀🎨🔑💡🧲🎲🧩🪁🍄🌈☀❄⚡🍓🍌🍇🥕🌽🍪🎂🧸👑💎🪑🧦👓🎩🪴🚲🎻🥁🪄🔭⏰🧭🎯🛶🍩🥨🧀🍉🥝🍒⛺🧊'];
const ANIMALS = [...'🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🐔🐧🐦🦆🦉🦇🐺🐴🦄🐝🐛🦋🐌🐞🐜🐢🐍🦎🐙🦑🦀🐠🐟🐬🐳🦈🐊🐅🐆🦓🦒🐘🦏🐪🦘🦥🦔🦩🦜🦢🦚🐓🐇🐿'];

/** Kuratierte biblische Symbole (57 eindeutige Zeichen). */
const BIBLE: string[] = [
  '🚢', '🕊️', '🌈', '🐟', '🍞', '🍷', '👑', '⭐', '🐑', '🐍',
  '🌳', '🍎', '🔥', '🌊', '🌾', '🍇', '🫒', '📜', '🏺', '⚖️',
  '🗡️', '🛡️', '🦁', '🐋', '🪙', '🌴', '🌙', '☀️', '⛪', '🚪',
  '🔑', '✝️', '🎺', '🎶', '🪔', '🧺', '🐫', '🦅', '🪨', '🫏',
  '🕯️', '🍯', '⛺', '💧', '⛰️', '⚓', '❤️', '🙏', '🏛️', '🪵',
  '💍', '☁️', '⚡', '📖', '👶', '🪽', '👣',
];

/** Mathe-Paket: Symbol v ist der Wert v + 2, gezeigt in wechselnden Schreibweisen. */
export interface Notation {
  text: string;
  value: number;
}

export function mathNotations(value: number): Notation[] {
  const out: Notation[] = [{ text: String(value), value }];
  for (let a = 2; a * a <= value; a++) if (value % a === 0) out.push({ text: `${a}·${value / a}`, value });
  const root = Math.round(Math.sqrt(value));
  if (root * root === value && root > 1) out.push({ text: `${root}²`, value });
  out.push({ text: `${value + 3} − 3`, value }, { text: `${value + 7} − 7`, value }, { text: `${value - 1} + 1`, value });
  if (value > 5) out.push({ text: `${value - 5} + 5`, value });
  out.push({ text: `${value * 2} : 2`, value }, { text: `${value * 3} : 3`, value });
  const seen = new Set<string>();
  return out.filter((n) => !seen.has(n.text) && !!seen.add(n.text));
}

/** Der Wert, der beim Mathe-Paket zu einer Symbol-Nummer gehört. */
export function mathValue(symbol: number): number {
  return symbol + 2;
}

/**
 * Brüche & Einheiten (Mathe Klasse 5/6): 57 eindeutige Werte mit jeweils mehreren Schreibweisen.
 * Jeder Eintrag gehört zu genau einem Symbol (0..56), damit keine Verwechslung entsteht.
 */
export const FRACTION_GROUPS: readonly (readonly string[])[] = [
  // Brüche, Dezimalzahlen, Prozente (30)
  ['½', '0,5', '50 %', '2/4'],
  ['¼', '0,25', '25 %', '2/8'],
  ['¾', '0,75', '75 %', '6/8'],
  ['⅕', '0,2', '20 %', '2/10'],
  ['⅖', '0,4', '40 %', '4/10'],
  ['⅗', '0,6', '60 %', '6/10'],
  ['⅘', '0,8', '80 %', '8/10'],
  ['⅒', '0,1', '10 %', '1/10'],
  ['3/10', '0,3', '30 %', '6/20'],
  ['7/10', '0,7', '70 %', '14/20'],
  ['9/10', '0,9', '90 %', '18/20'],
  ['⅛', '0,125', '12,5 %', '1/8'],
  ['⅜', '0,375', '37,5 %', '3/8'],
  ['⅝', '0,625', '62,5 %', '5/8'],
  ['⅞', '0,875', '87,5 %', '7/8'],
  ['⅓', '2/6', '3/9', '4/12'],
  ['⅔', '4/6', '6/9', '8/12'],
  ['⅙', '2/12', '3/18', '1/6'],
  ['⅚', '10/12', '15/18', '5/6'],
  ['1/20', '0,05', '5 %', '2/40'],
  ['3/20', '0,15', '15 %', '6/40'],
  ['7/20', '0,35', '35 %', '14/40'],
  ['9/20', '0,45', '45 %', '18/40'],
  ['11/20', '0,55', '55 %', '22/40'],
  ['1/25', '0,04', '4 %', '2/50'],
  ['1/50', '0,02', '2 %', '2/100'],
  ['1/100', '0,01', '1 %'],
  ['1', '100 %', '2/2', '4/4'],
  ['1½', '1,5', '150 %', '3/2'],
  ['2', '200 %', '4/2', '6/3'],
  // Längen (10)
  ['1 cm', '10 mm', '0,1 dm'],
  ['5 cm', '50 mm', '0,5 dm'],
  ['1 dm', '10 cm', '100 mm'],
  ['5 dm', '50 cm', '0,5 m'],
  ['1 m', '100 cm', '10 dm'],
  ['2 m', '200 cm', '20 dm'],
  ['5 m', '500 cm', '50 dm'],
  ['1 km', '1000 m', '2·500 m'],
  ['0,5 km', '500 m', '½ km'],
  ['0,25 km', '250 m', '¼ km'],
  // Gewichte (6)
  ['1 kg', '1000 g', '2·500 g'],
  ['0,5 kg', '500 g', '½ kg'],
  ['0,25 kg', '250 g', '¼ kg'],
  ['0,1 kg', '100 g', '1/10 kg'],
  ['1 t', '1000 kg', '2·500 kg'],
  ['0,5 t', '500 kg', '½ t'],
  // Zeit (6)
  ['1 min', '60 s', '2·30 s'],
  ['2 min', '120 s', '2·60 s'],
  ['0,5 min', '30 s', '½ min'],
  ['1 h', '60 min', '3600 s'],
  ['0,5 h', '30 min', '½ h'],
  ['0,25 h', '15 min', '¼ h'],
  // Geld & Hohlmaße (5)
  ['1 €', '100 ct', '2·50 ct'],
  ['0,50 €', '50 ct', '½ €'],
  ['1 l', '1000 ml', '2·500 ml'],
  ['0,5 l', '500 ml', '½ l'],
  ['0,25 l', '250 ml', '¼ l'],
];

const SETS: Record<Exclude<SymbolSet, 'math' | 'fractions'>, string[]> = { emoji: EMOJI, animals: ANIMALS, bible: BIBLE };

/** Wie ein Symbol auf einer bestimmten Karte aussieht (bei Mathe & Brüche/Einheiten wechselt die Schreibweise je Karte). */
export function symbolText(set: SymbolSet, symbol: number, card: number): string {
  if (set === 'math') {
    const list = mathNotations(mathValue(symbol));
    return list[(card * 7 + symbol * 3) % list.length]!.text;
  }
  if (set === 'fractions') {
    const list = FRACTION_GROUPS[symbol % FRACTION_GROUPS.length]!;
    return list[(card * 7 + symbol * 3) % list.length]!;
  }
  const list = SETS[set];
  return list[symbol % list.length]!;
}

export function setSize(set: SymbolSet): number {
  if (set === 'math') return 57;
  if (set === 'fractions') return FRACTION_GROUPS.length;
  return SETS[set].length;
}
