import { COLORS, type Card, type Color, type HandType, type Rank } from './types';

export const COLOR_INFO: Record<Color, { name: string; emoji: string; shape: string }> = {
  h: { name: 'Herz', emoji: '♥️', shape: '♥' },
  s: { name: 'Pik', emoji: '♠️', shape: '♠' },
  d: { name: 'Karo', emoji: '♦️', shape: '♦' },
  c: { name: 'Kreuz', emoji: '♣️', shape: '♣' },
};

const RANK_NAME = ['', '', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Bube', 'Dame', 'König', 'Ass'];

export const JACK = 11;
export const QUEEN = 12;
export const KING = 13;
export const ACE = 14;

export function rankName(rank: Rank): string {
  return RANK_NAME[rank] ?? '?';
}

/** Kurzzeichen für die Kartenecke: 2–10, B, D, K, A. */
export function rankShort(rank: Rank): string {
  return rank > 10 ? rankName(rank).slice(0, 1) : rankName(rank);
}

/** Bildkarten: Bube, Dame, König. Das Ass zählt nicht dazu. */
export function isFace(rank: Rank): boolean {
  return rank >= JACK && rank <= KING;
}

/** Witz einer Karte: ihr Rang (2–10, Bube 11, Dame 12, König 13, Ass 14). */
export function rankChips(rank: Rank): number {
  return rank;
}

export function cardLabel(card: Card): string {
  if (card.enh === 'granite') return 'Granit-Karte';
  return `${COLOR_INFO[card.color].name}-${rankName(card.rank)}`;
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

/** Eigene Werte (Narrenhof, 29.10.2026); die Karten bringen dafür ihren vollen Rang als Chips. */
export const HANDS: Record<HandType, HandInfo> = {
  high: { name: 'Hohe Karte', chips: 8, mult: 1, chipsPerLevel: 8, multPerLevel: 1 },
  pair: { name: 'Paar', chips: 12, mult: 2, chipsPerLevel: 12, multPerLevel: 1 },
  twoPair: { name: 'Zwei Paare', chips: 24, mult: 2, chipsPerLevel: 16, multPerLevel: 1 },
  three: { name: 'Drilling', chips: 25, mult: 3, chipsPerLevel: 20, multPerLevel: 2 },
  straight: { name: 'Straße', chips: 35, mult: 4, chipsPerLevel: 25, multPerLevel: 2 },
  flush: { name: 'Farbe', chips: 40, mult: 4, chipsPerLevel: 18, multPerLevel: 2 },
  fullHouse: { name: 'Full House', chips: 45, mult: 4, chipsPerLevel: 25, multPerLevel: 2 },
  four: { name: 'Vierling', chips: 60, mult: 6, chipsPerLevel: 30, multPerLevel: 3 },
  straightFlush: { name: 'Farbstraße', chips: 90, mult: 9, chipsPerLevel: 40, multPerLevel: 3 },
  five: { name: 'Fünfling', chips: 110, mult: 11, chipsPerLevel: 35, multPerLevel: 3, secret: true },
  flushHouse: { name: 'Full House in Farbe', chips: 130, mult: 13, chipsPerLevel: 40, multPerLevel: 4, secret: true },
  flushFive: { name: 'Farb-Fünfling', chips: 150, mult: 15, chipsPerLevel: 50, multPerLevel: 4, secret: true },
};

/** Name der gespielten Kombi; eine Farbstraße von der 10 bis zum Ass heißt „Königsstraße“. */
export function handLabel(type: HandType, cards: Card[]): string {
  if (type === 'straightFlush' && cards.some((c) => c.rank === ACE) && cards.some((c) => c.rank === 10)) return 'Königsstraße';
  return HANDS[type].name;
}

/** Welche Kombis eine Kombi „enthält“ (für Mods wie „+8 Mult, wenn ein Paar dabei ist“). */
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

  const flush = normal.length === 5 && COLORS.some((c) => normal.every((i) => hasColor(played[i]!, c)));
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

/** Das Standarddeck: 52 Karten, 2 bis Ass in vier Farben. */
export function standardDeck(): Omit<Card, 'id'>[] {
  const cards: Omit<Card, 'id'>[] = [];
  for (const color of COLORS) for (let rank = 2; rank <= ACE; rank++) cards.push({ rank, color });
  return cards;
}
