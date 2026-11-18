/* Alle Spiele im ROM mit ihrem Adapter, in der Reihenfolge von `spiele[]` in src/main.c. */
import { ticTacToe } from './tic-tac-toe';
import { reversi } from './reversi';
import { vier } from './vier';
import type { SpielAdapter } from './typen';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ALLE: SpielAdapter<any, any>[] = [ticTacToe, vier, reversi];
