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

export type SymbolSet = 'emoji' | 'animals' | 'bible' | 'math';

export const SYMBOL_SETS: { value: SymbolSet; label: string }[] = [
  { value: 'emoji', label: 'Bunte Emojis' },
  { value: 'animals', label: 'Tiere' },
  { value: 'bible', label: 'Bibel' },
  { value: 'math', label: 'Mathe (gleicher Wert)' },
];

const EMOJI = [...'🍎🚗⭐🌙🔥💧🎈🎁🔔🎵📚🏠🌳🌸🍕🍦⚽🚀🎨🔑💡🧲🎲🧩🪁🍄🌈☀❄⚡🍓🍌🍇🥕🌽🍪🎂🧸👑💎🪑🧦👓🎩🪴🚲🎻🥁🪄🔭⏰🧭🎯🛶🍩🥨🧀🍉🥝🍒⛺🧊'];
const ANIMALS = [...'🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🐔🐧🐦🦆🦉🦇🐺🐴🦄🐝🐛🦋🐌🐞🐜🐢🐍🦎🐙🦑🦀🐠🐟🐬🐳🦈🐊🐅🐆🦓🦒🐘🦏🐪🦘🦥🦔🦩🦜🦢🦚🐓🐇🐿'];
const BIBLE = [...'🚢🕊🌈🐟🍞👑⭐🐑🐍🍎🌳🔥🌊🌾🍇🫒📜🏺⚖🗡🛡🦁🐋🪙🥖🍷🌿🌙☀⛪🏠🚪🔑✝🎺🥁🎶👣🤲🧺🪔🏛🐫🦅🦂🐜🧱🌋💧🪨🐴🐕🌟🕯🍯🥚🪵🧂🧵'];

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

const SETS: Record<Exclude<SymbolSet, 'math'>, string[]> = { emoji: EMOJI, animals: ANIMALS, bible: BIBLE };

/** Wie ein Symbol auf einer bestimmten Karte aussieht (beim Mathe-Paket wechselt die Schreibweise je Karte). */
export function symbolText(set: SymbolSet, symbol: number, card: number): string {
  if (set === 'math') {
    const list = mathNotations(mathValue(symbol));
    return list[(card * 7 + symbol * 3) % list.length]!.text;
  }
  const list = SETS[set];
  return list[symbol % list.length]!;
}

export function setSize(set: SymbolSet): number {
  return set === 'math' ? 57 : SETS[set].length;
}
