import { describe, expect, it } from 'vitest';
import { applyManualOrder, moveBefore, sortHand } from '../src/handOrder';
import type { UnoCard, UnoCardType, UnoColor } from '../src/types';

const card = (id: string, color: UnoColor, type: UnoCardType): UnoCard => ({ id, front: { color, type } });

const hand = [
  card('a', 'blue', '5'),
  card('b', 'wild', 'wild'),
  card('c', 'red', 'skip'),
  card('d', 'red', '9'),
  card('e', 'blue', '2'),
  card('f', 'green', '5'),
];

describe('Eins! Handsortierung', () => {
  it('nach Farbe: Farben der Reihe nach, darin nach Wert, Joker zuletzt', () => {
    expect(sortHand(hand, 'color', 'light').map((c) => c.id)).toEqual(['d', 'c', 'f', 'e', 'a', 'b']);
  });

  it('nach Zahl: gleiche Werte nebeneinander, Aktionen und Joker hinten', () => {
    expect(sortHand(hand, 'number', 'light').map((c) => c.id)).toEqual(['e', 'f', 'a', 'd', 'c', 'b']);
  });

  it('eigene Reihenfolge: neue Karten hinten, abgelegte fallen weg', () => {
    expect(applyManualOrder(hand, ['f', 'zzz', 'a']).map((c) => c.id)).toEqual(['f', 'a', 'b', 'c', 'd', 'e']);
  });

  it('Karte vor eine andere oder ans Ende ziehen', () => {
    expect(moveBefore(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b']);
    expect(moveBefore(['a', 'b', 'c'], 'a', null)).toEqual(['b', 'c', 'a']);
  });
});
