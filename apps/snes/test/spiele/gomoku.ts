import { gameModule } from '../../../../packages/games/gomoku/src/index';
import type { GomokuMove, GomokuState } from '../../../../packages/games/gomoku/src/types';
import { KEIN, platz, type SpielAdapter } from './typen';

export const gomoku: SpielAdapter<GomokuState, GomokuMove> = {
  nr: 3,
  id: 'gomoku',
  modul: gameModule,
  varianten: [{ name: '15×15', snes: [], optionen: {} }],
  zug: (_s, m) => [m.cell],
  stand: (s) => [...s.board.map(platz), s.turn, platz(s.winner), ...(s.winLine ?? [KEIN, KEIN, KEIN, KEIN, KEIN])],
  partien: 15,
  botBilder: [70, 70, 70],
  gegenZufall: [6, 6],
};
