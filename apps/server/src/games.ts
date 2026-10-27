import type { AnyGameModule } from '@brett-und-blatt/engine';
import { gameModule as battleship } from '@brett-und-blatt/game-battleship';
import { gameModule as bingo } from '@brett-und-blatt/game-bingo';
import { gameModule as blackPeter } from '@brett-und-blatt/game-black-peter';
import { gameModule as checkers } from '@brett-und-blatt/game-checkers';
import { gameModule as chess } from '@brett-und-blatt/game-chess';
import { gameModule as colorAndShape } from '@brett-und-blatt/game-color-and-shape';
import { gameModule as colorSorter } from '@brett-und-blatt/game-color-sorter';
import { gameModule as dominoes } from '@brett-und-blatt/game-dominoes';
import { gameModule as doppelkopf } from '@brett-und-blatt/game-doppelkopf';
import { gameModule as drachenspiel } from '@brett-und-blatt/game-drachenspiel';
import { gameModule as fourInARow } from '@brett-und-blatt/game-four-in-a-row';
import { gameModule as fourPlayerChess } from '@brett-und-blatt/game-four-player-chess';
import { gameModule as go } from '@brett-und-blatt/game-go';
import { gameModule as maexle } from '@brett-und-blatt/game-maexle';
import { gameModule as mill } from '@brett-und-blatt/game-mill';
import { gameModule as pairs } from '@brett-und-blatt/game-pairs';
import { gameModule as poker } from '@brett-und-blatt/game-poker';
import { gameModule as quartett } from '@brett-und-blatt/game-quartett';
import { gameModule as reversi } from '@brett-und-blatt/game-reversi';
import { gameModule as schafkopf } from '@brett-und-blatt/game-schafkopf';
import { gameModule as skat } from '@brett-und-blatt/game-skat';
import { gameModule as ticTacToe } from '@brett-und-blatt/game-tic-tac-toe';
import { gameModule as ultimateTicTacToe } from '@brett-und-blatt/game-ultimate-tic-tac-toe';
import { gameModule as uno } from '@brett-und-blatt/game-uno';

/**
 * Die Spiele, die online angeboten werden: alle für mehrere Personen. Ein neues
 * Mehrspieler-Spiel muss hier (und in package.json) eingetragen werden – ein Test
 * im Server-Paket erinnert daran.
 */
export const onlineGames: AnyGameModule[] = [battleship, bingo, blackPeter, checkers, chess, colorAndShape, colorSorter, dominoes, doppelkopf, drachenspiel, fourInARow, fourPlayerChess, go, maexle, mill, pairs, poker, quartett, reversi, schafkopf, skat, ticTacToe, ultimateTicTacToe, uno];
