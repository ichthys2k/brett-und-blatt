export const BOARD_SIZE = 15;
export const CENTER = 7;
export const CENTER_CELL = CENTER * BOARD_SIZE + CENTER;

export type SquareType = 'normal' | 'dl' | 'tl' | 'dw' | 'tw' | 'star';

export const BOARD_SQUARES: SquareType[] = Array(BOARD_SIZE * BOARD_SIZE).fill('normal');

// Premium squares as per standard Scrabble
function setSquares(cells: Array<[number, number, SquareType]>) {
  for (const [r, c, t] of cells) {
    BOARD_SQUARES[r * BOARD_SIZE + c] = t;
  }
}

// Triple Word
setSquares([
  [0, 0, 'tw'],
  [0, 7, 'tw'],
  [0, 14, 'tw'],
  [7, 0, 'tw'],
  [7, 14, 'tw'],
  [14, 0, 'tw'],
  [14, 7, 'tw'],
  [14, 14, 'tw'],
]);
// Double Word
setSquares([
  [1, 1, 'dw'],
  [2, 2, 'dw'],
  [3, 3, 'dw'],
  [4, 4, 'dw'],
  [1, 13, 'dw'],
  [2, 12, 'dw'],
  [3, 11, 'dw'],
  [4, 10, 'dw'],
  [13, 1, 'dw'],
  [12, 2, 'dw'],
  [11, 3, 'dw'],
  [10, 4, 'dw'],
  [13, 13, 'dw'],
  [12, 12, 'dw'],
  [11, 11, 'dw'],
  [10, 10, 'dw'],
  [7, 7, 'star'],
]);
// Triple Letter
setSquares([
  [1, 5, 'tl'],
  [1, 9, 'tl'],
  [5, 1, 'tl'],
  [5, 5, 'tl'],
  [5, 9, 'tl'],
  [5, 13, 'tl'],
  [9, 1, 'tl'],
  [9, 5, 'tl'],
  [9, 9, 'tl'],
  [9, 13, 'tl'],
  [13, 5, 'tl'],
  [13, 9, 'tl'],
]);
// Double Letter
setSquares([
  [0, 3, 'dl'],
  [0, 11, 'dl'],
  [2, 6, 'dl'],
  [2, 8, 'dl'],
  [3, 0, 'dl'],
  [3, 7, 'dl'],
  [3, 14, 'dl'],
  [6, 2, 'dl'],
  [6, 6, 'dl'],
  [6, 8, 'dl'],
  [6, 12, 'dl'],
  [7, 3, 'dl'],
  [7, 11, 'dl'],
  [8, 2, 'dl'],
  [8, 6, 'dl'],
  [8, 8, 'dl'],
  [8, 12, 'dl'],
  [11, 0, 'dl'],
  [11, 7, 'dl'],
  [11, 14, 'dl'],
  [12, 6, 'dl'],
  [12, 8, 'dl'],
  [14, 3, 'dl'],
  [14, 11, 'dl'],
]);

export function squareTypeOf(index: number): SquareType {
  return BOARD_SQUARES[index] ?? 'normal';
}

export function squareTypeAt(row: number, col: number): SquareType {
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return 'normal';
  return BOARD_SQUARES[row * BOARD_SIZE + col];
}

export function indexOf(row: number, col: number): number {
  return row * BOARD_SIZE + col;
}

export function rowColOf(index: number): [number, number] {
  return [Math.floor(index / BOARD_SIZE), index % BOARD_SIZE];
}
