import { LIGHT_COLORS, type CardFace, type LightColor, type UnoCard } from '../types';

/** Erzeugt das klassische Uno-Deck mit 108 Karten. */
export function buildClassicDeck(): UnoCard[] {
  const cards: UnoCard[] = [];
  let idCounter = 1;

  for (const color of LIGHT_COLORS) {
    // Genau eine 0 je Farbe
    cards.push({
      id: `c_${idCounter++}`,
      front: { color, type: '0' },
    });

    // Je zwei 1 bis 9
    for (let num = 1; num <= 9; num++) {
      cards.push({ id: `c_${idCounter++}`, front: { color, type: String(num) as CardFace['type'] } });
      cards.push({ id: `c_${idCounter++}`, front: { color, type: String(num) as CardFace['type'] } });
    }

    // Je zwei Aussetzen, Richtungswechsel, +2
    cards.push({ id: `c_${idCounter++}`, front: { color, type: 'skip' } });
    cards.push({ id: `c_${idCounter++}`, front: { color, type: 'skip' } });

    cards.push({ id: `c_${idCounter++}`, front: { color, type: 'reverse' } });
    cards.push({ id: `c_${idCounter++}`, front: { color, type: 'reverse' } });

    cards.push({ id: `c_${idCounter++}`, front: { color, type: 'draw2' } });
    cards.push({ id: `c_${idCounter++}`, front: { color, type: 'draw2' } });
  }

  // 4 Farbwahl (Wild)
  for (let i = 0; i < 4; i++) {
    cards.push({ id: `c_${idCounter++}`, front: { color: 'wild', type: 'wild' } });
  }

  // 4 Farbwahl +4 (Wild Draw 4)
  for (let i = 0; i < 4; i++) {
    cards.push({ id: `c_${idCounter++}`, front: { color: 'wild', type: 'wildDraw4' } });
  }

  return cards;
}
