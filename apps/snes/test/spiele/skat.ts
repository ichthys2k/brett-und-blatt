import { gameModule } from '../../../../packages/games/skat/src/index';
import type { CardId, SkatMove, SkatState } from '../../../../packages/games/skat/src/rules';
import { type SpielAdapter } from './typen';

const SUITS = ['C', 'D', 'H', 'S'];

function toCardIdx(card: CardId): number {
  const suit = SUITS.indexOf(card[0]!);
  const dot = card.indexOf('.');
  const rank = parseInt(dot === -1 ? card.slice(1) : card.slice(1, dot), 10);
  return suit * 13 + (rank - 1);
}

const GAME_TYPE_MAP: Record<string, number> = {
  C: 0,
  S: 1,
  H: 2,
  D: 3,
  grand: 4,
  null: 5,
};

const PHASE_MAP: Record<string, number> = {
  bidding: 0,
  skatDecision: 1,
  discard: 2,
  declare: 3,
  play: 4,
  roundOver: 5,
  passedOut: 6,
};

const STAGE_MAP: Record<string, number> = {
  mh_vh: 0,
  hh_winner: 1,
  done: 2,
};

export const skat: SpielAdapter<SkatState, SkatMove> = {
  nr: 25,
  id: 'skat',
  modul: gameModule,
  varianten: [
    {
      name: '3 Spieler, 12 Runden',
      snes: [2],
      optionen: { table: '3', rounds: '12' },
      plaetze: 3,
      siege: 2,
    },
    {
      name: '3 Spieler, 3 Runden',
      snes: [0],
      optionen: { table: '3', rounds: '3' },
      plaetze: 3,
      siege: 2,
    },
  ],
  zug: (_s, m) => {
    if (m.type === 'bid') {
      return [0, m.value & 0xff, (m.value >> 8) & 0xff];
    }
    if (m.type === 'hold') {
      return [1];
    }
    if (m.type === 'pass') {
      return [2];
    }
    if (m.type === 'takeSkat') {
      return [3];
    }
    if (m.type === 'playHand') {
      return [4];
    }
    if (m.type === 'discard') {
      return [5, toCardIdx(m.cards[0]), toCardIdx(m.cards[1])];
    }
    if (m.type === 'declare') {
      const g = GAME_TYPE_MAP[m.declaration.gameType] ?? 4;
      let flags = 0;
      if (m.declaration.hand) flags |= 1;
      if (m.declaration.schneider) flags |= 2;
      if (m.declaration.schwarz) flags |= 4;
      if (m.declaration.ouvert) flags |= 8;
      return [6, g, flags];
    }
    if (m.type === 'play') {
      return [7, toCardIdx(m.card)];
    }
    if (m.type === 'nextGame') {
      return [8];
    }
    return [0];
  },
  stand: (s) => {
    const bytes: number[] = [];
    bytes.push(s.playerCount);
    bytes.push(s.totalGames);
    bytes.push(s.gameNumber);
    bytes.push(s.dealerSeat);
    bytes.push(PHASE_MAP[s.phase] ?? 0);
    bytes.push(s.declarerSeat ?? 0xff);
    bytes.push(s.highestBid & 0xff);
    bytes.push((s.highestBid >> 8) & 0xff);
    bytes.push(s.currentBidValue & 0xff);
    bytes.push((s.currentBidValue >> 8) & 0xff);
    bytes.push(STAGE_MAP[s.biddingStage] ?? 0);
    bytes.push(s.biddingSpeaker);
    bytes.push(s.biddingListener);
    bytes.push(s.biddingAwaitingAnswer ? 1 : 0);
    bytes.push(s.passedSeats.length);

    for (let i = 0; i < 3; i++) bytes.push(s.activeSeats[i]);
    bytes.push(s.skat.length);
    for (const c of s.skat) bytes.push(toCardIdx(c));
    bytes.push(s.discardedCards.length);
    for (const c of s.discardedCards) bytes.push(toCardIdx(c));

    for (let seat = 0; seat < s.playerCount; seat++) {
      const hand = s.hands[seat] || [];
      bytes.push(hand.length);
      for (const c of hand) bytes.push(toCardIdx(c));
    }

    bytes.push(s.declaration ? 1 : 0);
    bytes.push(s.declaration ? GAME_TYPE_MAP[s.declaration.gameType] ?? 0 : 0);
    let flags = 0;
    if (s.declaration?.hand) flags |= 1;
    if (s.declaration?.schneider) flags |= 2;
    if (s.declaration?.schwarz) flags |= 4;
    if (s.declaration?.ouvert) flags |= 8;
    bytes.push(flags);

    bytes.push(s.leaderSeat);
    bytes.push(s.currentTrick.length);
    for (const pc of s.currentTrick) {
      bytes.push(pc.player);
      bytes.push(toCardIdx(pc.card));
    }

    bytes.push(s.declarerTricksCount);
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
