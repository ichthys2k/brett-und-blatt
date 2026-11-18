import { gameModule } from '../../../../packages/games/go/src/index';
import type { GoMove, GoState } from '../../../../packages/games/go/src/rules';
import { type SpielAdapter } from './typen';

let lastBoard: number[] | null = null;
let lastCaptures: [number, number] | null = null;

export const go: SpielAdapter<GoState, GoMove> = {
  nr: 30,
  id: 'go',
  modul: gameModule,
  varianten: [
    {
      name: 'Go 9×9',
      snes: [],
      optionen: { size: '9' },
      plaetze: 2,
      siege: 1,
    },
  ],
  zug: (_s, m) => {
    if (m.type === 'place') {
      return [0, m.point];
    }
    if (m.type === 'pass') {
      return [1, 0];
    }
    if (m.type === 'acceptScore') {
      return [2];
    }
    if (m.type === 'resume') {
      return [3];
    }
    return [0, 0];
  },
  stand: (s) => {
    if (s.record.length === 0) {
      lastBoard = null;
      lastCaptures = null;
    }
    if (s.phase === 'scoring') {
      lastBoard = [...s.board];
      lastCaptures = [...s.captures];
    }
    const board = (s.phase === 'over' && lastBoard) ? lastBoard : s.board;
    const captures = (s.phase === 'over' && lastCaptures) ? lastCaptures : s.captures;

    const bytes: number[] = [];
    for (let i = 0; i < 81; i++) bytes.push(board[i] ?? 0);
    bytes.push(s.turn);
    bytes.push(s.passes);
    bytes.push(captures[0]);
    bytes.push(captures[1]);
    bytes.push(s.ko ?? 0xff);
    let ph = 0;
    if (s.phase === 'scoring') ph = 1;
    else if (s.phase === 'over') ph = 2;
    bytes.push(ph);
    let w = 0xff;
    if (s.end?.winner !== undefined && s.end?.winner !== null) w = s.end.winner;
    bytes.push(w);

    return bytes;
  },
  partien: 5,
  botBilder: [80, 160, 180],
  gegenZufall: [6, 4],
};
