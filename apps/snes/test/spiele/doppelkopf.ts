import { gameModule } from '../../../../packages/games/doppelkopf/src/index';
import type { CardId, DokoMove, DokoState } from '../../../../packages/games/doppelkopf/src/rules';
import { type SpielAdapter } from './typen';

const SUITS = ['C', 'D', 'H', 'S'];

function toCardIdx(card: CardId): number {
  const suit = SUITS.indexOf(card[0]!);
  const dot = card.indexOf('.');
  const rank = parseInt(dot === -1 ? card.slice(1) : card.slice(1, dot), 10);
  const copy = card.endsWith('.2') ? 1 : 0;
  return copy * 52 + suit * 13 + (rank - 1);
}

const CONTRACT_TYPE_MAP: Record<string, number> = {
  normal: 0,
  hochzeit: 1,
  damensolo: 2,
  bubensolo: 3,
  farbsolo: 4,
  fleischlos: 5,
};

const PHASE_MAP: Record<string, number> = {
  reservations: 0,
  chooseSolo: 1,
  play: 2,
  roundOver: 3,
};

const dokoModul = {
  ...gameModule,
  legalMoves(state: DokoState, actor: any): DokoMove[] {
    return gameModule.legalMoves(state, actor).filter((m) => m.type !== 'announce');
  },
};

export const doppelkopf: SpielAdapter<DokoState, DokoMove> = {
  nr: 27,
  id: 'doppelkopf',
  modul: dokoModul,
  varianten: [
    {
      name: 'Standard zu viert, 8 Runden',
      snes: [1],
      optionen: { rounds: '8' },
      plaetze: 4,
      siege: 2,
    },
    {
      name: 'Standard zu viert, 4 Runden',
      snes: [0],
      optionen: { rounds: '4' },
      plaetze: 4,
      siege: 1,
    },
  ],
  zug: (_s, m) => {
    if (m.type === 'healthy') {
      return [0];
    }
    if (m.type === 'reservation') {
      return [1];
    }
    if (m.type === 'chooseContract') {
      const typ = CONTRACT_TYPE_MAP[m.contract.type] ?? 0;
      const trump = m.contract.trumpSuit ? SUITS.indexOf(m.contract.trumpSuit) : 1;
      return [2, typ, trump];
    }
    if (m.type === 'play') {
      return [4, toCardIdx(m.card)];
    }
    if (m.type === 'nextGame') {
      return [5];
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
    bytes.push(s.reservationTurn);
    bytes.push(CONTRACT_TYPE_MAP[s.contract.type] ?? 0);
    bytes.push(s.contract.trumpSuit ? SUITS.indexOf(s.contract.trumpSuit) : 1);
    bytes.push(s.contract.soloist ?? 0xff);

    bytes.push(s.reTeam.length);
    for (const r of s.reTeam) bytes.push(r);

    for (let seat = 0; seat < s.playerCount; seat++) {
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

    bytes.push(s.reEyes);
    bytes.push(s.kontraEyes);

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
