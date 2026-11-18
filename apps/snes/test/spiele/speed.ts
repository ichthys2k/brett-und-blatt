import { gameModule } from '../../../../packages/games/speed/src/index';
import type { CardId, SpeedMove, SpeedState } from '../../../../packages/games/speed/src/rules';
import { type SpielAdapter } from './typen';

const SUITS = ['C', 'D', 'H', 'S'];

function toCardIdx(card: CardId): number {
  const suit = SUITS.indexOf(card[0]!);
  const rank = parseInt(card.slice(1, card.indexOf('.')), 10);
  return suit * 13 + (rank - 1);
}

export const speed: SpielAdapter<SpeedState, SpeedMove> = {
  nr: 22,
  id: 'speed',
  modul: gameModule,
  varianten: [
    {
      name: 'Speed 1 Runde, auto, Ass rund',
      snes: [0, 0, 0],
      optionen: { goal: 'r1', drawMode: 'auto', wrap: 'on' },
      plaetze: 2,
      siege: 2,
    },
    {
      name: 'Speed Best of 3, auto, Ass rund',
      snes: [1, 0, 0],
      optionen: { goal: 'b3', drawMode: 'auto', wrap: 'on' },
      plaetze: 2,
      siege: 2,
    },
    {
      name: 'Speed 1 Runde, manual, Ass nicht rund',
      snes: [0, 1, 1],
      optionen: { goal: 'r1', drawMode: 'manual', wrap: 'off' },
      plaetze: 2,
      siege: 2,
    },
  ],
  zug: (_s, m) => {
    if (m.type === 'play') {
      return [0, toCardIdx(m.card), m.pile];
    }
    if (m.type === 'stuck') {
      return [1, 0];
    }
    if (m.type === 'draw') {
      return [2, 0];
    }
    if (m.type === 'ready') {
      return [3, 0];
    }
    return [0, 0];
  },
  stand: (s) => {
    const bytes: number[] = [];
    const phaseMap: Record<string, number> = { play: 0, roundEnd: 1, gameEnd: 2 };
    bytes.push(phaseMap[s.phase] ?? 0);
    bytes.push(s.round);
    bytes.push(s.players[0]!.wins);
    bytes.push(s.players[1]!.wins);
    bytes.push(s.players[0]!.stuck ? 1 : 0);
    bytes.push(s.players[1]!.stuck ? 1 : 0);
    bytes.push(s.players[0]!.ready ? 1 : 0);
    bytes.push(s.players[1]!.ready ? 1 : 0);

    for (let i = 0; i < 2; i++) {
      const pile = s.piles[i]!;
      bytes.push(pile.length);
      for (const c of pile) bytes.push(toCardIdx(c));
    }

    for (let i = 0; i < 2; i++) {
      const side = s.sides[i]!;
      bytes.push(side.length);
      for (const c of side) bytes.push(toCardIdx(c));
    }

    for (let i = 0; i < 2; i++) {
      const p = s.players[i]!;
      bytes.push(p.hand.length);
      for (const c of p.hand) bytes.push(toCardIdx(c));
      bytes.push(p.draw.length);
      for (const c of p.draw) bytes.push(toCardIdx(c));
    }

    for (let i = 0; i < 4; i++) {
      const v = s.rng[i] ?? 0;
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
