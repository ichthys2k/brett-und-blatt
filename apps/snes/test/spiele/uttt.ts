import { gameModule, type UltimateMove, type UltimateState } from '../../../../packages/games/ultimate-tic-tac-toe/src/index';
import { KEIN, platz, type SpielAdapter } from './typen';

export const uttt: SpielAdapter<UltimateState, UltimateMove> = {
  nr: 4,
  id: 'ultimate-tic-tac-toe',
  modul: gameModule,
  varianten: [
    { name: 'Standard', snes: [0, 0], optionen: { decided: 'locked', drawBoard: 'none' } },
    { name: 'bespielbar, Remis für beide', snes: [1, 1], optionen: { decided: 'playable', drawBoard: 'both' } },
    { name: 'gesperrt, Remis für beide', snes: [0, 1], optionen: { decided: 'locked', drawBoard: 'both' } },
  ],
  zug: (_s, m) => [m.board, m.cell],
  stand: (s) => [
    ...s.cells.map(platz),
    ...s.boards.map((b) => (b === 'draw' ? 2 : platz(b))),
    platz(s.forced),
    s.turn,
    platz(s.winner),
    ...(s.winLine ?? [KEIN, KEIN, KEIN]),
    s.draw ? 1 : 0,
    platz(s.lastMove?.board),
    platz(s.lastMove?.cell),
    s.playableWhenDecided ? 1 : 0,
    s.drawCountsForBoth ? 1 : 0,
  ],
  partien: 30,
  botBilder: [60, 90, 140],
  gegenZufall: [6, 5],
};
