import { gameModule } from '../../../../packages/games/chess/src/index';
import type { ChessMove, ChessState } from '../../../../packages/games/chess/src/rules';
import { type SpielAdapter } from './typen';

function toSquare(an: string): number {
  const f = an.charCodeAt(0) - 97;
  const r = parseInt(an[1]!, 10) - 1;
  return (r << 4) | f;
}

export const chess: SpielAdapter<ChessState, ChessMove> = {
  nr: 29,
  id: 'chess',
  modul: gameModule,
  varianten: [
    {
      name: 'Klassisches Schach',
      snes: [],
      optionen: {},
      plaetze: 2,
      siege: 1,
    },
  ],
  zug: (_s, m) => {
    if (m.type === 'move') {
      const from = toSquare(m.from);
      const to = toSquare(m.to);
      const pr = m.promotion === 'q' ? 1 : m.promotion === 'r' ? 2 : m.promotion === 'b' ? 3 : m.promotion === 'n' ? 4 : 0;
      return [from, to, pr];
    }
    return [0, 0, 0];
  },
  stand: (s) => {
    const bytes: number[] = [];
    const fen = s.fen;
    const parts = fen.split(' ');
    const boardStr = parts[0]!;
    const turnStr = parts[1]!;
    const castlingStr = parts[2]!;
    const epStr = parts[3]!;
    const halfStr = parts[4]!;
    const fullStr = parts[5]!;

    const board: number[] = new Array(64).fill(0);
    const rows = boardStr.split('/');
    for (let r = 0; r < 8; r++) {
      let f = 0;
      const row = rows[7 - r]!;
      for (let i = 0; i < row.length; i++) {
        const ch = row[i]!;
        if (ch >= '1' && ch <= '8') {
          f += parseInt(ch, 10);
        } else {
          let p = 0;
          if (ch === 'P') p = 1;
          else if (ch === 'N') p = 2;
          else if (ch === 'B') p = 3;
          else if (ch === 'R') p = 4;
          else if (ch === 'Q') p = 5;
          else if (ch === 'K') p = 6;
          else if (ch === 'p') p = 7;
          else if (ch === 'n') p = 8;
          else if (ch === 'b') p = 9;
          else if (ch === 'r') p = 10;
          else if (ch === 'q') p = 11;
          else if (ch === 'k') p = 12;
          board[r * 8 + f] = p;
          f++;
        }
      }
    }

    for (let i = 0; i < 64; i++) bytes.push(board[i]!);
    bytes.push(turnStr === 'w' ? 0 : 1);

    let castling = 0;
    if (castlingStr.includes('K')) castling |= 1;
    if (castlingStr.includes('Q')) castling |= 2;
    if (castlingStr.includes('k')) castling |= 4;
    if (castlingStr.includes('q')) castling |= 8;
    bytes.push(castling);

    bytes.push(epStr === '-' ? 0xff : toSquare(epStr));
    bytes.push(parseInt(halfStr ?? '0', 10));
    const full = parseInt(fullStr ?? '1', 10);
    bytes.push(full & 0xff);
    bytes.push((full >> 8) & 0xff);
    bytes.push(s.inCheck ? 1 : 0);

    let end = 0;
    if (s.end === 'checkmate') end = 1;
    else if (s.end === 'stalemate') end = 2;
    else if (s.end !== null) end = 3;
    bytes.push(end);
    bytes.push(s.winner ?? 0xff);

    return bytes;
  },
  partien: 5,
  botBilder: [60, 90, 120],
  gegenZufall: [6, 2],
};
