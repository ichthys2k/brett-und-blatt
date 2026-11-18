import { gameModule } from '../../../../packages/games/binokel/src/index';
import type { BinokelMove, BinokelState } from '../../../../packages/games/binokel/src/rules';
import type { CardId } from '../../../../packages/engine/src/types';
import { type SpielAdapter } from './typen';

const SUITS = ['C', 'S', 'H', 'D'];

function toCardIdx(card: CardId): number {
  const suit = SUITS.indexOf(card[0]!);
  const dot = card.indexOf('.');
  const rank = parseInt(dot === -1 ? card.slice(1) : card.slice(1, dot), 10);
  const copy = card.endsWith('.2') ? 1 : 0;
  return copy * 52 + suit * 13 + (rank - 1);
}

const PHASE_MAP: Record<string, number> = {
  bidding: 0,
  discard: 1,
  declare: 2,
  play: 3,
  roundOver: 4,
  finished: 5,
};

const binokelModul = {
  ...gameModule,
  legalMoves: (s: BinokelState, actor: any) => {
    if (s.phase === 'discard') {
      const hand = (s.hands[actor as number] || []).filter((c): c is CardId => c !== null);
      if (hand.length >= 4) {
        return [{ type: 'discard' as const, cards: hand.slice(-4) }];
      }
    }
    return gameModule.legalMoves(s, actor);
  },
};

export const binokel: SpielAdapter<BinokelState, BinokelMove> = {
  nr: 28,
  id: 'binokel',
  modul: binokelModul,
  varianten: [
    {
      name: '3 Spieler, 40 Karten',
      snes: [0],
      optionen: { deckSize: '40' },
      plaetze: 3,
      siege: 2,
    },
  ],
  zug: (_s, m) => {
    if (m.type === 'bid') {
      return [0, m.value & 0xff, (m.value >> 8) & 0xff];
    }
    if (m.type === 'pass') {
      return [1];
    }
    if (m.type === 'discard') {
      return [2, ...m.cards.map(toCardIdx)];
    }
    if (m.type === 'declareTrump') {
      return [3, SUITS.indexOf(m.suit)];
    }
    if (m.type === 'declareDurch') {
      return [4];
    }
    if (m.type === 'fold') {
      return [5];
    }
    if (m.type === 'play') {
      return [6, toCardIdx(m.card)];
    }
    if (m.type === 'nextGame') {
      return [7];
    }
    return [0];
  },
  stand: (s) => {
    const bytes: number[] = [];
    bytes.push(s.seats ?? 3);
    bytes.push(12); // total_games
    bytes.push(s.gameNumber);
    bytes.push(s.dealer);
    bytes.push(s.deckSize);
    bytes.push(PHASE_MAP[s.phase] ?? 0);
    bytes.push(s.speaker);
    bytes.push((s.bid ?? 0) & 0xff);
    bytes.push(((s.bid ?? 0) >> 8) & 0xff);
    bytes.push(s.bidder ?? 0xff);
    bytes.push(s.declarer ?? 0xff);
    bytes.push(s.trump ? SUITS.indexOf(s.trump) : 0xff);
    bytes.push(s.durch ? 1 : 0);

    const d = s.dabb.filter((c): c is CardId => c !== null);
    bytes.push(d.length);
    for (const c of d) bytes.push(toCardIdx(c));

    const pr = s.pressed.filter((c): c is CardId => c !== null);
    bytes.push(pr.length);
    for (const c of pr) bytes.push(toCardIdx(c));

    for (let seat = 0; seat < (s.seats ?? 3); seat++) {
      const hand = (s.hands[seat] || []).filter((c): c is CardId => c !== null);
      bytes.push(hand.length);
      for (const c of hand) bytes.push(toCardIdx(c));
    }

    bytes.push(s.leader);
    bytes.push(s.currentTrick.length);
    for (const pc of s.currentTrick) {
      bytes.push(pc.player);
      bytes.push(toCardIdx(pc.card));
    }

    for (let i = 0; i < 4; i++) {
      const v = s.dealRng[i] ?? 0;
      bytes.push(v & 0xff);
      bytes.push((v >> 8) & 0xff);
      bytes.push((v >> 16) & 0xff);
      bytes.push((v >> 24) & 0xff);
    }

    return bytes;
  },
  partien: 10,
  botBilder: [15, 30, 60],
  gegenZufall: [6, 4],
};
