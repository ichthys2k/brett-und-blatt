import { gameModule, type FourInARowMove, type FourInARowState } from '../../../../packages/games/four-in-a-row/src/index';
import { platz, type SpielAdapter } from './typen';

const REMIS: Record<string, number> = { full: 1, repetition: 2, moveLimit: 3, stuck: 4 };

export const vier: SpielAdapter<FourInARowState, FourInARowMove> = {
  nr: 1,
  id: 'four-in-a-row',
  modul: gameModule,
  varianten: [
    { name: '7×6', snes: [1, 0], optionen: { size: '7x6', popOut: 'off' } },
    { name: '6×5', snes: [0, 0], optionen: { size: '6x5', popOut: 'off' } },
    { name: '9×7', snes: [3, 0], optionen: { size: '9x7', popOut: 'off' } },
    { name: '7×6 PopOut', snes: [1, 1], optionen: { size: '7x6', popOut: 'on' } },
    { name: '8×7 PopOut', snes: [2, 1], optionen: { size: '8x7', popOut: 'on' } },
  ],
  zug: (_s, m) => [m.type === 'drop' ? 0 : 1, m.column],
  stand: (s) => [
    s.cols,
    s.rows,
    ...s.cells.map(platz),
    s.turn,
    s.popOut ? 1 : 0,
    platz(s.winner),
    s.draw ? REMIS[s.draw]! : 0,
    s.moveCount & 0xff,
    s.moveCount >> 8,
    s.winLines.length,
    ...s.winLines.flat(),
  ],
  partien: 40,
  botBilder: [60, 100, 160],
  gegenZufall: [6, 5],
};
