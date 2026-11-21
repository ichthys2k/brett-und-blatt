import { getActiveFace } from './rules';
import { DARK_COLORS, LIGHT_COLORS, type UnoCard, type UnoCardType, type UnoColor } from './types';

/** Wie die eigene Hand angezeigt wird: nach Farbe, nach Zahl oder in selbst gewählter Reihenfolge. */
export type HandSort = 'color' | 'number' | 'manual';

export const HAND_SORTS: readonly HandSort[] = ['color', 'number', 'manual'];

/** Reihenfolge der Kartenwerte: erst Zahlen 0–9, dann Aktionskarten, Joker zuletzt. */
const TYPE_ORDER: readonly UnoCardType[] = [
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'skip', 'reverse', 'draw1', 'draw2', 'flip', 'skipAll', 'draw6', 'draw10', 'flipDraw5', 'roulette',
  'wild', 'wildDraw4', 'wildDraw6', 'wildDraw10', 'wildReverseDraw4', 'wildDrawColor',
  'wildSkip', 'wildSkipAll', 'wildTargetDraw2', 'wildSwap',
];

const typeRank = (type: UnoCardType): number => {
  const i = TYPE_ORDER.indexOf(type);
  return i === -1 ? TYPE_ORDER.length : i;
};

const colorRank = (color: UnoColor, side: 'light' | 'dark'): number => {
  if (color === 'wild') return 99;
  const order: readonly UnoColor[] = side === 'dark' ? DARK_COLORS : LIGHT_COLORS;
  const i = order.indexOf(color);
  return i === -1 ? 98 : i;
};

/**
 * Sortiert die Hand nach Farbe (dann Wert) oder nach Wert (dann Farbe). Es zählt die Seite, die gerade
 * oben liegt (Wenden). Gleiche Karten behalten ihre Reihenfolge über die Kartennummer.
 */
export function sortHand(hand: readonly UnoCard[], mode: 'color' | 'number', side: 'light' | 'dark'): UnoCard[] {
  const key = (card: UnoCard) => {
    const face = getActiveFace(card, side);
    const c = colorRank(face.color, side);
    const t = typeRank(face.type);
    return mode === 'color' ? [c, t] : [t, c];
  };
  return [...hand].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    return ka[0]! - kb[0]! || ka[1]! - kb[1]! || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  });
}

/**
 * Eigene Reihenfolge anwenden: Karten aus `order` stehen an ihrer Stelle, neu gezogene kommen hinten dazu,
 * abgelegte fallen weg.
 */
export function applyManualOrder(hand: readonly UnoCard[], order: readonly string[]): UnoCard[] {
  const byId = new Map(hand.map((card) => [card.id, card]));
  const kept = order.flatMap((id) => {
    const card = byId.get(id);
    return card ? [card] : [];
  });
  const known = new Set(order);
  return [...kept, ...hand.filter((card) => !known.has(card.id))];
}

/** Zieht die Karte `moving` vor die Karte `before` (oder ans Ende, wenn `before` fehlt). */
export function moveBefore(ids: readonly string[], moving: string, before: string | null): string[] {
  const rest = ids.filter((id) => id !== moving);
  const at = before === null ? -1 : rest.indexOf(before);
  if (at === -1) return [...rest, moving];
  return [...rest.slice(0, at), moving, ...rest.slice(at)];
}
