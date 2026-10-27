import type { UnoCard } from '../types';

/** Erzeugt das Nur-Joker-Deck (All Wild) mit 112 Sonderkarten. */
export function buildAllWildDeck(): UnoCard[] {
  const cards: UnoCard[] = [];
  let idCounter = 1;

  // Klassische Wild
  for (let i = 0; i < 32; i++) {
    cards.push({ id: `aw_${idCounter++}`, front: { color: 'wild', type: 'wild' } });
  }
  // Wild +2
  for (let i = 0; i < 24; i++) {
    cards.push({ id: `aw_${idCounter++}`, front: { color: 'wild', type: 'draw2' } });
  }
  // Wild +4
  for (let i = 0; i < 14; i++) {
    cards.push({ id: `aw_${idCounter++}`, front: { color: 'wild', type: 'wildDraw4' } });
  }
  // Wild Skip
  for (let i = 0; i < 12; i++) {
    cards.push({ id: `aw_${idCounter++}`, front: { color: 'wild', type: 'skip' } });
  }
  // Wild Skip All
  for (let i = 0; i < 8; i++) {
    cards.push({ id: `aw_${idCounter++}`, front: { color: 'wild', type: 'skipAll' } });
  }
  // Wild Reverse
  for (let i = 0; i < 10; i++) {
    cards.push({ id: `aw_${idCounter++}`, front: { color: 'wild', type: 'reverse' } });
  }
  // Wild Targeted +2
  for (let i = 0; i < 6; i++) {
    cards.push({ id: `aw_${idCounter++}`, front: { color: 'wild', type: 'wildTargetDraw2' } });
  }
  // Wild Swap Hands
  for (let i = 0; i < 6; i++) {
    cards.push({ id: `aw_${idCounter++}`, front: { color: 'wild', type: 'wildSwap' } });
  }

  return cards;
}
