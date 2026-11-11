import { mathCardLabel } from './rules';
import type { CardFace, UnoCard, UnoOptions, UnoState } from './types';

export type UnoStateLike = {
  options?: Partial<UnoOptions>;
  side?: 'light' | 'dark';
};

/**
 * Liefert eine dynamische Funktionsbeschreibung für eine Eins!-Karte
 * unter Berücksichtigung von Hausregeln (wie 7-0 Handtausch, Mathe-Karten etc.).
 */
export function unoCardDescription(
  cardOrFace: UnoCard | CardFace | string,
  state?: UnoStateLike,
): string {
  const options = state?.options ?? {};
  const side = state?.side ?? 'light';

  let face: CardFace;
  let cardId: string | undefined;

  if (typeof cardOrFace === 'string') {
    face = { color: 'wild', type: cardOrFace as CardFace['type'] };
  } else if ('front' in cardOrFace) {
    cardId = cardOrFace.id;
    face = side === 'dark' && cardOrFace.back ? cardOrFace.back : cardOrFace.front;
  } else {
    face = cardOrFace;
  }

  const { type } = face;

  // Sonderregeln nach Typ
  switch (type) {
    case 'skip':
      return 'Aussetzen: Nächster Spieler setzt aus';
    case 'skipAll':
      return 'Alle aussetzen: Alle anderen Spieler setzen aus';
    case 'reverse':
      return 'Richtungswechsel: Spielrichtung dreht sich um';
    case 'draw1':
      return 'Zieh 1: Nächster Spieler zieht 1 Karte';
    case 'draw2':
      return 'Zieh 2: Nächster Spieler zieht 2 Karten';
    case 'wildDraw4':
      return 'Farbwahl & Zieh 4: Farbe wünschen, nächster zieht 4 Karten';
    case 'wildReverseDraw4':
      return 'Farbwahl & Richtungswechsel: Nächster zieht 4 Karten';
    case 'flipDraw5':
      return 'Farbwahl & Zieh 5: Auf dunkle Seite drehen & nächster zieht 5 Karten';
    case 'draw6':
      return 'Zieh 6: Nächster Spieler zieht 6 Karten';
    case 'wildDraw6':
      return 'Farbwahl & Zieh 6: Farbe wünschen, nächster zieht 6 Karten';
    case 'draw10':
      return 'Zieh 10: Nächster Spieler zieht 10 Karten';
    case 'wildDraw10':
      return 'Farbwahl & Zieh 10: Farbe wünschen, nächster zieht 10 Karten';
    case 'flip':
      return 'Flip: Alle Karten auf die andere Seite drehen';
    case 'roulette':
      return 'Roulette: Nächster zieht bis zur gezogenen Farbe';
    case 'wildSwap':
      return 'Farbwahl & Handtausch: Farbe wünschen & Handkarten mit einem Spieler tauschen';
    case 'wildTargetDraw2':
      return 'Farbwahl & Zielspieler: Gewählter Spieler zieht 2 Karten';
    case 'wild':
      return 'Farbe frei wählen';
    case '7':
      if (options.sevenZero === 'on') {
        return '7: Handkarten mit einem beliebigen Mitspieler tauschen';
      }
      break;
    case '0':
      if (options.sevenZero === 'on') {
        return '0: Alle Spieler geben ihre Handkarten in Spielrichtung weiter';
      }
      break;
  }

  // Zahlenkarten (inkl. Mathe-Modus falls aktiv)
  if (options.mathLabels === 'on' && cardId) {
    const expr = mathCardLabel(type, cardId);
    if (expr) {
      return `Zahlenkarte ${type} (Aufgabe: ${expr})`;
    }
  }

  return `Zahlenkarte ${type}`;
}
