import { LIGHT_COLORS, type CardFace, type UnoCard } from '../types';

export const JUNIOR_ANIMALS: Record<number, string> = {
  1: '🐻', // Bär
  2: '🦁', // Löwe
  3: '🐘', // Elefant
  4: '🐵', // Affe
  5: '🐧', // Pinguin
  6: '🦊', // Fuchs
  7: '🐨', // Koala
  8: '🐸', // Frosch
  9: '🐼', // Panda
};

/** Erzeugt das Junior-Deck mit kindgerechten Tiermotiven (84 Karten). */
export function buildJuniorDeck(): UnoCard[] {
  const cards: UnoCard[] = [];
  let idCounter = 1;

  for (const color of LIGHT_COLORS) {
    // 1 bis 9 je Farbe doppelt mit Tier
    for (let num = 1; num <= 9; num++) {
      cards.push({
        id: `jr_${idCounter++}`,
        front: { color, type: String(num) as CardFace['type'], animal: JUNIOR_ANIMALS[num] },
      });
      cards.push({
        id: `jr_${idCounter++}`,
        front: { color, type: String(num) as CardFace['type'], animal: JUNIOR_ANIMALS[num] },
      });
    }

    // Leichtere Aktionen: Skip & Draw1
    cards.push({ id: `jr_${idCounter++}`, front: { color, type: 'skip' } });
    cards.push({ id: `jr_${idCounter++}`, front: { color, type: 'draw1' } });
  }

  // 4 Wild-Karten
  for (let i = 0; i < 4; i++) {
    cards.push({ id: `jr_${idCounter++}`, front: { color: 'wild', type: 'wild' } });
  }

  return cards;
}
