/** Zugtexte (#335): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser. */
import { getActiveFace, isIdenticalCard, mathCardLabel } from './rules';
import type { CardFace, UnoCard, UnoCardType, UnoColor, UnoMove, UnoState } from './types';

export const UNO_COLOR_NAMES: Record<UnoColor, string> = {
  red: 'Rot',
  yellow: 'Gelb',
  green: 'Grün',
  blue: 'Blau',
  orange: 'Orange',
  teal: 'Petrol',
  purple: 'Lila',
  pink: 'Rosa',
  wild: 'Bunt',
};

const TYPE_NAMES: Partial<Record<UnoCardType, string>> = {
  skip: 'Aussetzen',
  reverse: 'Richtungswechsel',
  draw2: 'Zieh 2',
  wild: 'Farbwahl',
  wildDraw4: 'Farbwahl Zieh 4',
  draw6: 'Zieh 6',
  draw10: 'Zieh 10',
  skipAll: 'Alle aussetzen',
  roulette: 'Farbroulette',
  wildDraw6: 'Farbwahl Zieh 6',
  wildDraw10: 'Farbwahl Zieh 10',
  wildReverseDraw4: 'Farbwahl Richtungswechsel Zieh 4',
  flip: 'Wenden',
  draw1: 'Zieh 1',
  flipDraw5: 'Wenden Zieh 5',
  wildDrawColor: 'Farbwahl Ziehen bis Farbe',
  wildSkip: 'Joker Aussetzen',
  wildSkipAll: 'Joker Alle aussetzen',
  wildTargetDraw2: 'Joker Zieh 2 gezielt',
  wildSwap: 'Joker Handtausch',
};

/** Name einer Kartenseite für Menschen, etwa „Rot 5“, „Blau Zieh 2“ oder „Farbwahl Zieh 4“. */
export function unoFaceName(face: CardFace, mathLabel: string | null = null): string {
  const value = mathLabel ?? TYPE_NAMES[face.type] ?? face.type;
  return face.color === 'wild' ? value : `${UNO_COLOR_NAMES[face.color]} ${value}`;
}

export function unoCardName(card: UnoCard, view: Pick<UnoState, 'activeSide' | 'options'>): string {
  const face = getActiveFace(card, view.activeSide);
  return unoFaceName(face, view.options.mathLabels === 'on' ? mathCardLabel(face.type, card.id) : null);
}

/**
 * Die Karte mit Nummer, wenn man gleiche Karten mehrfach auf der Hand hat („Rot 5 (2.)“) –
 * sonst wären die Zugtexte nicht eindeutig. Nur die eigene Hand ist in der Sicht offen.
 */
function ownCardName(view: UnoState, cardId: string): string {
  const hand = view.hands.find((h) => h.some((c) => c.id === cardId));
  const card = hand?.find((c) => c.id === cardId);
  if (!hand || !card) return 'Karte';
  const name = unoCardName(card, view);
  const same = hand.filter((c) => isIdenticalCard(c, card, view.activeSide) && unoCardName(c, view) === name);
  const position = same.findIndex((c) => c.id === cardId) + 1;
  return same.length > 1 ? `${name} (${position}.)` : name;
}

/**
 * Etwa „Rot 5 spielen“, „Farbwahl Zieh 4 spielen, Blau wünschen“, „Blau 7 spielen, mit Platz 3
 * tauschen“, „Grün 2 reinwerfen“ oder „4 Karten ziehen“.
 */
export function describeMove(view: UnoState, move: UnoMove): string {
  switch (move.type) {
    case 'play':
    case 'jumpIn': {
      let text = `${ownCardName(view, move.cardId)} ${move.type === 'play' ? 'spielen' : 'reinwerfen'}`;
      if (move.chosenColor) text += `, ${UNO_COLOR_NAMES[move.chosenColor]} wünschen`;
      if (move.type === 'play' && move.targetPlayer !== undefined) text += `, Ziel Platz ${move.targetPlayer + 1}`;
      if (move.callUno) text += ' und „Eins!“ rufen';
      return text;
    }
    case 'draw':
      return view.pendingDraw > 0 ? `${view.pendingDraw} Karten ziehen` : 'Karte ziehen';
    case 'pass':
      return 'Passen';
    case 'catchUno':
      return `Platz ${move.target + 1} erwischen (kein „Eins!“)`;
    case 'callUno':
      return '„Eins!“ rufen';
  }
}
