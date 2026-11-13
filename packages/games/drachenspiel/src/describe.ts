/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import { DECK_THEMES } from './decks';
import { cardDefOf } from './rules';
import type { DrachenspielMove, DrachenspielView as DrachenspielState, Minion, SpellTarget } from './types';

function minionName(view: DrachenspielState, id: string): string {
  for (const p of view.players) {
    const index = (p.board as Minion[]).findIndex((m) => m.id === id);
    if (index >= 0) return `${(p.board as Minion[])[index]!.name} (${p.seat === view.activeSeat ? 'eigenes' : 'Gegner'}, Feld ${index + 1})`;
  }
  return 'Tier';
}

function targetText(view: DrachenspielState, target: SpellTarget): string {
  return target.kind === 'hero' ? 'gegnerischen Helden' : minionName(view, target.id);
}

function handName(view: DrachenspielState, index: number): string {
  const card = view.players[view.activeSeat]?.hand?.[index];
  return card ? (cardDefOf(view, card.defId)?.name ?? `Karte ${index + 1}`) : `Karte ${index + 1}`;
}

export function describeMove(view: DrachenspielState, move: DrachenspielMove): string {
  switch (move.type) {
    case 'chooseDeck':
      return `Deck ${DECK_THEMES[move.deck]?.name ?? move.deck}${move.code ? ' (eigenes)' : ''} wählen`;
    case 'mulligan':
      return move.discardIndices.length === 0 ? 'Alle Karten behalten' : `Karten ${move.discardIndices.map((i) => i + 1).join(', ')} tauschen`;
    case 'playCard':
      return `${handName(view, move.handIndex)} (Karte ${move.handIndex + 1}) ausspielen${move.target ? ` auf ${targetText(view, move.target)}` : ''}`;
    case 'attack':
      return `${minionName(view, move.attackerId)} greift ${targetText(view, move.target)} an`;
    case 'tradeCard':
      return `${handName(view, move.handIndex)} (Karte ${move.handIndex + 1}) eintauschen`;
    case 'choose':
      return `Wahl ${move.index + 1}`;
    case 'heroPower':
      return 'Heldenkraft einsetzen';
    case 'useBuilding':
      return `${minionName(view, move.minionId)} benutzen`;
    case 'heroAttack':
      return `Held greift ${targetText(view, move.target)} an`;
    case 'endTurn':
      return 'Zug beenden';
  }
}
