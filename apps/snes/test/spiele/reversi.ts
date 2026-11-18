import { gameModule, type ReversiMove, type ReversiState } from '../../../../packages/games/reversi/src/index';
import { platz, type SpielAdapter } from './typen';

export const reversi: SpielAdapter<ReversiState, ReversiMove> = {
  nr: 2,
  id: 'reversi',
  modul: gameModule,
  varianten: [
    { name: '8×8', snes: [1, 0], optionen: { size: '8', opening: 'cross' } },
    { name: '6×6', snes: [0, 0], optionen: { size: '6', opening: 'cross' } },
    { name: '10×10 frei', snes: [2, 1], optionen: { size: '10', opening: 'free' } },
    { name: '6×6 frei', snes: [0, 1], optionen: { size: '6', opening: 'free' } },
  ],
  zug: (_s, m) => [m.cell],
  stand: (s) => [s.size, ...s.cells.map(platz), s.turn, s.freeOpening ? 1 : 0, s.over ? 1 : 0, platz(s.lastMove), s.flipped.length, ...s.flipped],
  partien: 25,
  botBilder: [70, 110, 160],
  gegenZufall: [6, 5],
};
