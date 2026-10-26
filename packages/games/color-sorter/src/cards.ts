import type { Card, Color, HandType, Rank } from './types';

export const COLOR_INFO: Record<Color, { name: string; emoji: string; shape: string }> = {
  r: { name: 'Rot', emoji: '🔴', shape: '●' },
  y: { name: 'Gelb', emoji: '🟡', shape: '▲' },
  b: { name: 'Blau', emoji: '🔵', shape: '■' },
  g: { name: 'Grün', emoji: '🟢', shape: '◆' },
};

const RANK_EMOJI = ['', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '👶🏻', '👧🏻', '👦🏻', '🎅🏻'];
const RANK_NAME = ['', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'Baby', 'Mädchen', 'Junge', 'Santa'];

export const SANTA = 13;

export function rankEmoji(rank: Rank): string {
  return RANK_EMOJI[rank] ?? '?';
}

export function rankName(rank: Rank): string {
  return RANK_NAME[rank] ?? '?';
}

/** Bildkarten: Baby, Mädchen, Junge. Santa zählt wie das Ass nicht dazu. */
export function isFace(rank: Rank): boolean {
  return rank >= 10 && rank <= 12;
}

/** Chips einer Karte: Zahl = Wert, Bilder 10, Santa 11. */
export function rankChips(rank: Rank): number {
  if (rank === SANTA) return 11;
  return isFace(rank) ? 10 : rank;
}

export function cardLabel(card: Card): string {
  if (card.enh === 'granite') return 'Granit-Karte';
  return `${COLOR_INFO[card.color].name} ${rankName(card.rank)}`;
}

export interface HandInfo {
  name: string;
  chips: number;
  mult: number;
  chipsPerLevel: number;
  multPerLevel: number;
  /** Versteckte Kombis erscheinen in Übersichten erst, wenn man sie einmal gespielt hat. */
  secret?: boolean;
}

/** Reihenfolge von schwach nach stark. */
export const HAND_TYPES: HandType[] = ['high', 'pair', 'twoPair', 'three', 'straight', 'flush', 'fullHouse', 'four', 'straightFlush', 'five', 'flushHouse', 'flushFive'];

export const HANDS: Record<HandType, HandInfo> = {
  high: {
    name: 'Einzel-Wert',
    chips: 5,
    mult: 1,
    chipsPerLevel: 10,
    multPerLevel: 1,
  },
  pair: { name: 'Duo', chips: 10, mult: 2, chipsPerLevel: 15, multPerLevel: 1 },
  twoPair: {
    name: 'Doppel-Duo',
    chips: 20,
    mult: 2,
    chipsPerLevel: 20,
    multPerLevel: 1,
  },
  three: {
    name: 'Triple',
    chips: 30,
    mult: 3,
    chipsPerLevel: 20,
    multPerLevel: 2,
  },
  straight: {
    name: 'Zahlen-Lauf',
    chips: 30,
    mult: 4,
    chipsPerLevel: 30,
    multPerLevel: 3,
  },
  flush: {
    name: 'Farben-Satz',
    chips: 35,
    mult: 4,
    chipsPerLevel: 15,
    multPerLevel: 2,
  },
  fullHouse: {
    name: 'Kombi-Satz',
    chips: 40,
    mult: 4,
    chipsPerLevel: 25,
    multPerLevel: 2,
  },
  four: {
    name: 'Quartett',
    chips: 60,
    mult: 7,
    chipsPerLevel: 30,
    multPerLevel: 3,
  },
  straightFlush: {
    name: 'Farb-Kombination',
    chips: 100,
    mult: 8,
    chipsPerLevel: 40,
    multPerLevel: 4,
  },
  five: {
    name: 'Quintett',
    chips: 120,
    mult: 12,
    chipsPerLevel: 35,
    multPerLevel: 3,
    secret: true,
  },
  flushHouse: {
    name: 'Farb-Kombi-Satz',
    chips: 140,
    mult: 14,
    chipsPerLevel: 40,
    multPerLevel: 4,
    secret: true,
  },
  flushFive: {
    name: 'Farb-Quintett',
    chips: 160,
    mult: 16,
    chipsPerLevel: 50,
    multPerLevel: 3,
    secret: true,
  },
};

/** Name der gespielten Kombi; ein Lauf 9 bis Santa in einer Farbe heißt „FarbenLauf Deluxe“. */
export function handLabel(type: HandType, cards: Card[]): string {
  if (type === 'straightFlush' && cards.some((c) => c.rank === SANTA) && cards.some((c) => c.rank === 9)) return 'FarbenLauf Deluxe';
  return HANDS[type].name;
}

/** Welche Kombis eine Kombi „enthält“ (für Mods wie „+8 Mult, wenn ein Duo dabei ist“). */
export const CONTAINS: Record<HandType, HandType[]> = {
  high: ['high'],
  pair: ['pair'],
  twoPair: ['twoPair', 'pair'],
  three: ['three', 'pair'],
  straight: ['straight'],
  flush: ['flush'],
  fullHouse: ['fullHouse', 'three', 'pair', 'twoPair'],
  four: ['four', 'three', 'pair', 'twoPair'],
  straightFlush: ['straightFlush', 'straight', 'flush'],
  five: ['five', 'four', 'three', 'pair', 'twoPair'],
  flushHouse: ['flushHouse', 'fullHouse', 'flush', 'three', 'pair', 'twoPair'],
  flushFive: ['flushFive', 'five', 'flush', 'four', 'three', 'pair', 'twoPair'],
};

export interface Detected {
  type: HandType;
  /** Indizes (in der gespielten Auswahl) der Karten, die gewertet werden. */
  scoring: number[];
}

/** Hat die Karte diese Farbe? Ombré zählt als jede Farbe, Granit als keine. */
export function hasColor(card: Card, color: Color): boolean {
  if (card.enh === 'granite') return false;
  return card.enh === 'ombre' || card.color === color;
}

/** Erkennt die Kombi der gespielten Karten. Granit-Karten zählen nicht mit, werden aber immer gewertet. */
export function detectHand(played: Card[]): Detected {
  const idx = played.map((_, i) => i);
  const normal = idx.filter((i) => played[i]!.enh !== 'granite');
  const granite = idx.filter((i) => played[i]!.enh === 'granite');
  const withGranite = (scoring: number[]): Detected['scoring'] => [...scoring, ...granite].sort((a, b) => a - b);

  if (normal.length === 0) return { type: 'high', scoring: withGranite([]) };

  const byRank = new Map<Rank, number[]>();
  for (const i of normal) byRank.set(played[i]!.rank, [...(byRank.get(played[i]!.rank) ?? []), i]);
  const groups = [...byRank.values()].sort((a, b) => b.length - a.length || played[b[0]!]!.rank - played[a[0]!]!.rank);
  const sizes = groups.map((g) => g.length);

  const flush = normal.length === 5 && (['r', 'y', 'b', 'g'] as Color[]).some((c) => normal.every((i) => hasColor(played[i]!, c)));
  const ranks = normal.map((i) => played[i]!.rank).sort((a, b) => a - b);
  const straight = normal.length === 5 && new Set(ranks).size === 5 && ranks[4]! - ranks[0]! === 4;
  const all = withGranite(normal);

  if (sizes[0] === 5) return { type: flush ? 'flushFive' : 'five', scoring: all };
  if (sizes[0] === 3 && sizes[1] === 2 && flush) return { type: 'flushHouse', scoring: all };
  if (straight && flush) return { type: 'straightFlush', scoring: all };
  if (sizes[0] === 4) return { type: 'four', scoring: withGranite(groups[0]!) };
  if (sizes[0] === 3 && sizes[1] === 2) return { type: 'fullHouse', scoring: all };
  if (flush) return { type: 'flush', scoring: all };
  if (straight) return { type: 'straight', scoring: all };
  if (sizes[0] === 3) return { type: 'three', scoring: withGranite(groups[0]!) };
  if (sizes[0] === 2 && sizes[1] === 2)
    return {
      type: 'twoPair',
      scoring: withGranite([...groups[0]!, ...groups[1]!]),
    };
  if (sizes[0] === 2) return { type: 'pair', scoring: withGranite(groups[0]!) };
  return { type: 'high', scoring: withGranite([groups[0]![0]!]) };
}

/** Grundwerte einer Kombi auf ihrem Level. */
export function handBase(type: HandType, level: number): { chips: number; mult: number } {
  const info = HANDS[type];
  const up = Math.max(0, level - 1);
  return {
    chips: info.chips + info.chipsPerLevel * up,
    mult: Math.max(1, info.mult + info.multPerLevel * up),
  };
}

/** Das Standarddeck: 13 Ränge × 4 Farben. */
export function standardDeck(): Omit<Card, 'id'>[] {
  const cards: Omit<Card, 'id'>[] = [];
  for (const color of ['r', 'y', 'b', 'g'] as Color[]) for (let rank = 1; rank <= 13; rank++) cards.push({ rank, color });
  return cards;
}
