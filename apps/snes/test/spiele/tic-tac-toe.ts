import { gameModule, type TicTacToeMove, type TicTacToeState } from '../../../../packages/games/tic-tac-toe/src/index';
import { KEIN, platz, type SpielAdapter } from './typen';

export const ticTacToe: SpielAdapter<TicTacToeState, TicTacToeMove> = {
  nr: 0,
  id: 'tic-tac-toe',
  modul: gameModule,
  varianten: [{ name: 'Standard', snes: [], optionen: {} }],
  zug: (_s, m) => [m.cell],
  stand: (s) => [...s.board.map(platz), s.turn, platz(s.winner), ...(s.winLine ?? [KEIN, KEIN, KEIN])],
  partien: 150,
  botBilder: [5, 5, 60],
  gegenZufall: [10, 8],
};
