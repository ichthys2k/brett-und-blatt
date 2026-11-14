import { CARDS_DB } from '../cards';
import { cardDefOf, type CustomCard } from '../carddefs';
import type { CardDefinition } from '../types';

/**
 * Karten der laufenden Partie für die Oberfläche (#270): Grundkarten mit Anki-Werten und neue
 * Begleiter aus einem Kartenset. Das Brett setzt die Karten der Sicht bei jedem Zeichnen; im
 * Browser läuft immer nur eine Partie, die Regeln selbst nutzen `cardDefOf(state, id)`.
 */
let current: Record<string, CustomCard> | undefined;

export function setPartyCards(cards: Record<string, CustomCard> | undefined): void {
  current = cards;
}

export function partyCards(): Record<string, CustomCard> | undefined {
  return current;
}

export function uiCard(id: string): CardDefinition | undefined {
  return current ? cardDefOf({ customCards: current }, id) : CARDS_DB[id];
}
