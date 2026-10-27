import { DARK_COLORS, LIGHT_COLORS, type CardFace, type UnoCard } from '../types';

/** Erzeugt das Wenden-Deck (Flip) mit 112 beidseitigen Karten. */
export function buildFlipDeck(): UnoCard[] {
  const cards: UnoCard[] = [];
  let idCounter = 1;

  for (let idx = 0; idx < LIGHT_COLORS.length; idx++) {
    const lColor = LIGHT_COLORS[idx];
    const dColor = DARK_COLORS[idx];

    // 1 bis 9
    for (let num = 1; num <= 9; num++) {
      cards.push({
        id: `fl_${idCounter++}`,
        front: { color: lColor, type: String(num) as CardFace['type'] },
        back: { color: dColor, type: String(num) as CardFace['type'] },
      });
      cards.push({
        id: `fl_${idCounter++}`,
        front: { color: lColor, type: String(num) as CardFace['type'] },
        back: { color: dColor, type: String(num) as CardFace['type'] },
      });
    }

    // Aktionen:
    // Hell: +1, Skip, Reverse, Flip
    // Dunkel: +5, Skip All, Reverse, Flip
    for (let i = 0; i < 2; i++) {
      cards.push({
        id: `fl_${idCounter++}`,
        front: { color: lColor, type: 'draw1' },
        back: { color: dColor, type: 'flipDraw5' },
      });
      cards.push({
        id: `fl_${idCounter++}`,
        front: { color: lColor, type: 'skip' },
        back: { color: dColor, type: 'skipAll' },
      });
      cards.push({
        id: `fl_${idCounter++}`,
        front: { color: lColor, type: 'reverse' },
        back: { color: dColor, type: 'reverse' },
      });
      cards.push({
        id: `fl_${idCounter++}`,
        front: { color: lColor, type: 'flip' },
        back: { color: dColor, type: 'flip' },
      });
    }
  }

  // Joker:
  // Hell: Wild, Wild +2
  // Dunkel: Wild, Wild Draw Color
  for (let i = 0; i < 4; i++) {
    cards.push({
      id: `fl_${idCounter++}`,
      front: { color: 'wild', type: 'wild' },
      back: { color: 'wild', type: 'wild' },
    });
    cards.push({
      id: `fl_${idCounter++}`,
      front: { color: 'wild', type: 'draw2' },
      back: { color: 'wild', type: 'wildDrawColor' },
    });
  }

  return cards;
}
