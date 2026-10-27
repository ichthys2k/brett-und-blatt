import { LIGHT_COLORS, type CardFace, type UnoCard } from '../types';

/** Erzeugt das Keine-Gnade-Deck (No Mercy) mit 168 Karten. */
export function buildNoMercyDeck(): UnoCard[] {
  const cards: UnoCard[] = [];
  let idCounter = 1;

  for (const color of LIGHT_COLORS) {
    // 0 bis 9 (je 2 Stück)
    for (let num = 0; num <= 9; num++) {
      cards.push({ id: `nm_${idCounter++}`, front: { color, type: String(num) as CardFace['type'] } });
      cards.push({ id: `nm_${idCounter++}`, front: { color, type: String(num) as CardFace['type'] } });
    }

    // Klassische Aktionen je 3 Stück
    for (let i = 0; i < 3; i++) {
      cards.push({ id: `nm_${idCounter++}`, front: { color, type: 'skip' } });
      cards.push({ id: `nm_${idCounter++}`, front: { color, type: 'reverse' } });
      cards.push({ id: `nm_${idCounter++}`, front: { color, type: 'draw2' } });
      cards.push({ id: `nm_${idCounter++}`, front: { color, type: 'skipAll' } });
    }

    // Keine Gnade Spezial: +4 und +6 in Farben
    for (let i = 0; i < 2; i++) {
      cards.push({ id: `nm_${idCounter++}`, front: { color, type: 'draw6' } });
    }
  }

  // Joker / Wild-Karten
  for (let i = 0; i < 8; i++) {
    cards.push({ id: `nm_${idCounter++}`, front: { color: 'wild', type: 'wild' } });
  }
  for (let i = 0; i < 8; i++) {
    cards.push({ id: `nm_${idCounter++}`, front: { color: 'wild', type: 'wildDraw4' } });
  }
  for (let i = 0; i < 6; i++) {
    cards.push({ id: `nm_${idCounter++}`, front: { color: 'wild', type: 'wildDraw6' } });
  }
  for (let i = 0; i < 4; i++) {
    cards.push({ id: `nm_${idCounter++}`, front: { color: 'wild', type: 'wildDraw10' } });
  }
  for (let i = 0; i < 4; i++) {
    cards.push({ id: `nm_${idCounter++}`, front: { color: 'wild', type: 'wildReverseDraw4' } });
  }
  for (let i = 0; i < 4; i++) {
    cards.push({ id: `nm_${idCounter++}`, front: { color: 'wild', type: 'roulette' } });
  }

  return cards;
}
