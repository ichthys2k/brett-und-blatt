/* Alle Spiele im ROM mit ihrem Adapter, in der Reihenfolge von `spiele[]` in src/main.c. */
import { ticTacToe } from './tic-tac-toe';
import { dame } from './dame';
import { gomoku } from './gomoku';
import { kniffel } from './kniffel';
import { maexle } from './maexle';
import { muehle } from './muehle';
import { reversi } from './reversi';
import { teiler } from './teiler';
import { uttt } from './uttt';
import { vier } from './vier';
import type { SpielAdapter } from './typen';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ALLE: SpielAdapter<any, any>[] = [ticTacToe, vier, reversi, gomoku, uttt, muehle, dame, teiler, kniffel, maexle];
