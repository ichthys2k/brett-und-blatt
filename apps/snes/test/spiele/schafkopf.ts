import { gameModule } from '../../../../packages/games/schafkopf/src/index';
import type { CardId, SchafkopfMove, SchafkopfState } from '../../../../packages/games/schafkopf/src/rules';
import { type SpielAdapter } from './typen';

const SUITS = ['C', 'D', 'H', 'S'];

function toCardIdx(card: CardId): number {
  const suit = SUITS.indexOf(card[0]!);
  const dot = card.indexOf('.');
  const rank = parseInt(dot === -1 ? card.slice(1) : card.slice(1, dot), 10);
  return suit * 13 + (rank - 1);
}

const CONTRACT_TYPE_MAP: Record<string, number> = {
  sauspiel: 0,
  wenz: 1,
  solo: 2,
  geier: 3,
  farbwenz: 4,
  bettel: 5,
  ramsch: 6,
};

const PHASE_MAP: Record<string, number> = {
  bidding: 0,
  declare: 1,
  doubling: 2,
  play: 3,
  roundOver: 4,
  passedOut: 5,
};

export const schafkopf: SpielAdapter<SchafkopfState, SchafkopfMove> = {
  nr: 26,
  id: 'schafkopf',
  modul: gameModule,
  varianten: [
    {
      name: 'Langes Blatt, 4 Runden',
      snes: [0, 0],
      optionen: { sheet: 'long', rounds: '4', doubling: 'false' },
      plaetze: 4,
      siege: 2,
    },
    {
      name: 'Kurzes Blatt, 8 Runden',
      snes: [1, 1],
      optionen: { sheet: 'short', rounds: '8', doubling: 'false' },
      plaetze: 4,
      siege: 2,
    },
  ],
  zug: (_s, m) => {
    if (m.type === 'pass') {
      return [0];
    }
    if (m.type === 'wantToPlay') {
      return [1, CONTRACT_TYPE_MAP[m.contractType] ?? 0];
    }
    if (m.type === 'declare') {
      const typ = CONTRACT_TYPE_MAP[m.contract.gameType] ?? 0;
      const called = m.contract.calledSuit ? SUITS.indexOf(m.contract.calledSuit) : 0;
      const trump = m.contract.trumpSuit ? SUITS.indexOf(m.contract.trumpSuit) : 2;
      const tout = m.contract.tout ? 1 : 0;
      return [2, typ, called, trump, tout];
    }
    if (m.type === 'play') {
      return [5, toCardIdx(m.card)];
    }
    if (m.type === 'nextGame') {
      return [6];
    }
    return [0];
  },
  stand: (s) => {
    const bytes: number[] = [];
    bytes.push(s.playerCount);
    bytes.push(s.totalGames);
    bytes.push(s.gameNumber);
    bytes.push(s.dealerSeat);
    bytes.push(s.sheet === 'short' ? 1 : 0);
    bytes.push(PHASE_MAP[s.phase] ?? 0);
    bytes.push(s.biddingTurn);
    bytes.push(s.declarerSeat ?? 0xff);
    bytes.push(s.partnerSeat ?? 0xff);
    bytes.push(s.partnerRevealed ? 1 : 0);
    bytes.push(s.contract ? 1 : 0);
    bytes.push(s.contract ? CONTRACT_TYPE_MAP[s.contract.gameType] ?? 0 : 0);
    bytes.push(s.contract?.calledSuit ? SUITS.indexOf(s.contract.calledSuit) : 0);
    bytes.push(s.contract?.trumpSuit ? SUITS.indexOf(s.contract.trumpSuit) : 2);
    bytes.push(s.multiplier);

    for (let seat = 0; seat < 4; seat++) {
      const hand = s.hands[seat] || [];
      bytes.push(hand.length);
      for (const c of hand) bytes.push(toCardIdx(c));
    }

    bytes.push(s.leaderSeat);
    bytes.push(s.currentTrick.length);
    for (const pc of s.currentTrick) {
      bytes.push(pc.player);
      bytes.push(toCardIdx(pc.card));
    }

    bytes.push(s.declarerEyes);
    bytes.push(s.opponentEyes);

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
