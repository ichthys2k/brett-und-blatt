import { gameModule, type KlondikeState, type SolitaireMove, type SolitaireState } from '../../../../packages/games/solitaire/src/index';
import { applyKlondike, klondikeMoves } from '../../../../packages/games/solitaire/src/klondike';
import { isWon } from '../../../../packages/games/solitaire/src/rules';
import { type SpielAdapter } from './typen';

const SUITS = ['C', 'D', 'H', 'S'];

function cardIndex(card: string | null): number {
  if (card === null) return 0xff;
  const suit = SUITS.indexOf(card[0]!);
  const dot = card.indexOf('.');
  const rank = Number(card.slice(1, dot));
  return suit * 13 + (rank - 1);
}

const solitaireModul = {
  ...gameModule,
  currentPlayers: (s: SolitaireState) => (gameModule.result(s) ? [] : [0]),
  legalMoves: (s: SolitaireState) => (gameModule.result(s) ? [] : klondikeMoves(s as KlondikeState)),
  applyMove: (s: SolitaireState, _actor: any, m: SolitaireMove) => {
    const next = applyKlondike(s as KlondikeState, m);
    const done: SolitaireState = { ...next.state, moveCount: s.moveCount + 1, lastMove: m };
    const events = isWon(done) ? [...next.events, { type: 'won' }] : next.events;
    return { state: done, events };
  },
};

export const solitaire: SpielAdapter<SolitaireState, SolitaireMove> = {
  nr: 16,
  id: 'solitaire',
  modul: solitaireModul,
  varianten: [
    { name: 'Klondike 1 Karte', snes: [0], optionen: { variant: 'klondike', draw: '1', solvable: 'no' }, plaetze: 1, siege: 0 },
    { name: 'Klondike 3 Karten', snes: [1], optionen: { variant: 'klondike', draw: '3', solvable: 'no' }, plaetze: 1, siege: 0 },
  ],
  zug: (_s, m) => {
    if (m.type === 'draw') return [1, 0, 0, 0];
    if (m.type === 'recycle') return [2, 0, 0, 0];
    if (m.type === 'move') {
      const von = m.from.kind === 'tableau' ? m.from.index : m.from.kind === 'foundation' ? 10 + m.from.index : 20;
      const nach = m.to.kind === 'tableau' ? m.to.index : 10 + m.to.index;
      return [0, von, nach, m.count];
    }
    return [0, 0, 0, 0];
  },
  stand: (s) => {
    const k = s as KlondikeState;
    const bytes: number[] = [];
    bytes.push(k.draw);
    bytes.push(k.moveCount & 0xff);
    bytes.push(k.moveCount >> 8);

    for (let c = 0; c < 7; c++) {
      const pile = k.tableau[c]!;
      bytes.push(pile.down.length);
      for (const card of pile.down) bytes.push(cardIndex(card));
      bytes.push(pile.up.length);
      for (const card of pile.up) bytes.push(cardIndex(card));
    }

    for (let f = 0; f < 4; f++) {
      bytes.push(k.foundations[f]!.length);
    }

    bytes.push(k.stock.length);
    for (const card of k.stock) bytes.push(cardIndex(card));

    bytes.push(k.waste.length);
    for (const card of k.waste) bytes.push(cardIndex(card));

    if (k.lastMove === null) {
      bytes.push(0xff, 0, 0, 0);
    } else if (k.lastMove.type === 'draw') {
      bytes.push(1, 0, 0, 0);
    } else if (k.lastMove.type === 'recycle') {
      bytes.push(2, 0, 0, 0);
    } else if (k.lastMove.type === 'move') {
      const von = k.lastMove.from.kind === 'tableau' ? k.lastMove.from.index : k.lastMove.from.kind === 'foundation' ? 10 + k.lastMove.from.index : 20;
      const nach = k.lastMove.to.kind === 'tableau' ? k.lastMove.to.index : 10 + k.lastMove.to.index;
      bytes.push(0, von, nach, k.lastMove.count);
    }
    return bytes;
  },
  partien: 2,
  botBilder: [10, 20, 40],
  gegenZufall: [2, 0],
};
