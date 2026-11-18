import { gameModule } from '../../../../packages/games/poker/src/index';
import { cardCode } from '../../../../packages/games/poker/src/eval';
import { currentPlayers, type PokerMove, type PokerState } from '../../../../packages/games/poker/src/rules';
import { type SpielAdapter } from './typen';

export const poker: SpielAdapter<PokerState, PokerMove> = {
  nr: 24,
  id: 'poker',
  modul: gameModule,
  varianten: [
    {
      name: 'Poker No Limit, 20 Hände, 2 Plätze',
      snes: [0, 1, 1, 1, 1],
      optionen: { structure: 'nl', mode: 'hands20', stack: '100', speed: 'normal', ante: 'level4' },
      plaetze: 2,
      siege: 2,
    },
    {
      name: 'Poker Fixed Limit, 20 Hände, 2 Plätze',
      snes: [2, 1, 1, 1, 1],
      optionen: { structure: 'fl', mode: 'hands20', stack: '100', speed: 'normal', ante: 'level4' },
      plaetze: 2,
      siege: 2,
    },
    {
      name: 'Poker Pot Limit, 20 Hände, 2 Plätze',
      snes: [1, 1, 1, 1, 1],
      optionen: { structure: 'pl', mode: 'hands20', stack: '100', speed: 'normal', ante: 'level4' },
      plaetze: 2,
      siege: 2,
    },
    {
      name: 'Poker Turnier, No Limit, 3 Plätze',
      snes: [0, 0, 1, 1, 1],
      optionen: { structure: 'nl', mode: 'tournament', stack: '100', speed: 'normal', ante: 'level4' },
      plaetze: 3,
      siege: 2,
    },
  ],
  zug: (s, m) => {
    const actor = (currentPlayers(s)[0] as number | undefined) ?? 0;
    let type = 0;
    let amount = 0;
    if (m.type === 'fold') {
      type = 0;
    } else if (m.type === 'check') {
      type = 1;
    } else if (m.type === 'call') {
      type = 2;
    } else if (m.type === 'bet') {
      type = 3;
      amount = m.amount;
    } else if (m.type === 'raise') {
      type = 4;
      amount = m.to;
    } else if (m.type === 'allIn') {
      type = 5;
    }
    return [actor, type, amount & 0xff, (amount >> 8) & 0xff];
  },
  stand: (s) => {
    const bytes: number[] = [];
    const streetMap: Record<string, number> = { preflop: 0, flop: 1, turn: 2, river: 3, complete: 4 };
    bytes.push(streetMap[s.street] ?? 0);
    bytes.push(s.handNumber & 0xff);
    bytes.push((s.handNumber >> 8) & 0xff);
    bytes.push(s.levelIndex);
    bytes.push(s.button);
    bytes.push(s.actor === null ? 0xff : s.actor);

    bytes.push(s.currentBet & 0xff);
    bytes.push((s.currentBet >> 8) & 0xff);
    bytes.push(s.minRaise & 0xff);
    bytes.push((s.minRaise >> 8) & 0xff);
    bytes.push(s.raisesInStreet);

    bytes.push(s.board.length);
    for (const c of s.board) bytes.push(cardCode(c));

    bytes.push(s.deck.length);
    for (const c of s.deck) bytes.push(cardCode(c));

    const statusMap: Record<string, number> = { active: 0, waiting: 1, eliminated: 2, empty: 3 };
    for (const seat of s.seats) {
      bytes.push(statusMap[seat.status] ?? 0);
      bytes.push(seat.chips & 0xff);
      bytes.push((seat.chips >> 8) & 0xff);
      bytes.push(seat.inHand ? 1 : 0);
      bytes.push(seat.folded ? 1 : 0);
      bytes.push(seat.allIn ? 1 : 0);
      bytes.push(seat.streetBet & 0xff);
      bytes.push((seat.streetBet >> 8) & 0xff);
      bytes.push(seat.totalCommitted & 0xff);
      bytes.push((seat.totalCommitted >> 8) & 0xff);
      bytes.push(seat.acted ? 1 : 0);
      bytes.push(seat.holeCards.length);
      for (const c of seat.holeCards) bytes.push(cardCode(c));
    }

    for (let i = 0; i < 4; i++) {
      const v = s.rngState[i] ?? 0;
      bytes.push(v & 0xff);
      bytes.push((v >> 8) & 0xff);
      bytes.push((v >> 16) & 0xff);
      bytes.push((v >> 24) & 0xff);
    }

    return bytes;
  },
  partien: 20,
  botBilder: [5, 10, 20],
  gegenZufall: [6, 2],
};
