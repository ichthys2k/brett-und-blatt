/* Alle Spiele im ROM mit ihrem Adapter, in der Reihenfolge von `spiele[]` in src/main.c. */
import { ticTacToe } from './tic-tac-toe';
import { dame } from './dame';
import { gomoku } from './gomoku';
import { kniffel } from './kniffel';
import { maexle } from './maexle';
import { paare } from './paare';
import { ludo } from './ludo';
import { domino } from './domino';
import { mauer } from './mauer';
import { muehle } from './muehle';
import { reversi } from './reversi';
import { teiler } from './teiler';
import { uttt } from './uttt';
import { vier } from './vier';
import { zielzahl } from './zielzahl';
import { elevens } from './elevens';
import { solitaire } from './solitaire';
import { mauMau } from './mau-mau';
import { uno } from './uno';
import { peter } from './peter';
import { quartett } from './quartett';
import { president } from './president';
import { speed } from './speed';
import { ligretto } from './ligretto';
import { poker } from './poker';
import { skat } from './skat';
import { schafkopf } from './schafkopf';
import { doppelkopf } from './doppelkopf';
import { binokel } from './binokel';
import { chess } from './chess';
import { go } from './go';
import type { SpielAdapter } from './typen';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ALLE: SpielAdapter<any, any>[] = [
  ticTacToe, vier, reversi, gomoku, uttt, muehle, dame, teiler, kniffel, maexle,
  paare, ludo, domino, mauer, zielzahl, elevens, solitaire, mauMau, uno, peter,
  quartett, president, speed, ligretto, poker, skat, schafkopf, doppelkopf,
  binokel, chess, go
];
