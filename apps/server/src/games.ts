import type { AnyGameModule } from '@brett-und-blatt/engine';
import { gameModule as battleship } from '@brett-und-blatt/game-battleship';
import { gameModule as bibleQuiz } from '@brett-und-blatt/game-bible-quiz';
import { gameModule as bingo } from '@brett-und-blatt/game-bingo';
import { gameModule as blackPeter } from '@brett-und-blatt/game-black-peter';
import { gameModule as checkers } from '@brett-und-blatt/game-checkers';
import { gameModule as chess } from '@brett-und-blatt/game-chess';
import { gameModule as colorAndShape } from '@brett-und-blatt/game-color-and-shape';
import { gameModule as colorSorter } from '@brett-und-blatt/game-color-sorter';
import { gameModule as dominoes } from '@brett-und-blatt/game-dominoes';
import { gameModule as doppelkopf } from '@brett-und-blatt/game-doppelkopf';
import { gameModule as drachenspiel } from '@brett-und-blatt/game-drachenspiel';
import { gameModule as duckRally } from '@brett-und-blatt/game-duck-rally';
import { gameModule as factorGrid } from '@brett-und-blatt/game-factor-grid';
import { gameModule as fourInARow } from '@brett-und-blatt/game-four-in-a-row';
import { gameModule as fourPlayerChess } from '@brett-und-blatt/game-four-player-chess';
import { gameModule as go } from '@brett-und-blatt/game-go';
import { gameModule as gomoku } from '@brett-und-blatt/game-gomoku';
import { gameModule as hangman } from '@brett-und-blatt/game-hangman';
import { gameModule as ludo } from '@brett-und-blatt/game-ludo';
import { gameModule as maexle } from '@brett-und-blatt/game-maexle';
import { gameModule as mill } from '@brett-und-blatt/game-mill';
import { gameModule as numberWall } from '@brett-und-blatt/game-number-wall';
import { gameModule as pairs } from '@brett-und-blatt/game-pairs';
import { gameModule as poker } from '@brett-und-blatt/game-poker';
import { gameModule as quartett } from '@brett-und-blatt/game-quartett';
import { gameModule as reversi } from '@brett-und-blatt/game-reversi';
import { gameModule as schafkopf } from '@brett-und-blatt/game-schafkopf';
import { gameModule as skat } from '@brett-und-blatt/game-skat';
import { gameModule as binokel } from '@brett-und-blatt/game-binokel';
import { gameModule as targetNumber } from '@brett-und-blatt/game-target-number';
import { gameModule as ticTacToe } from '@brett-und-blatt/game-tic-tac-toe';
import { gameModule as ultimateTicTacToe } from '@brett-und-blatt/game-ultimate-tic-tac-toe';
import { gameModule as uno } from '@brett-und-blatt/game-uno';
import { gameModule as kniffel } from '@brett-und-blatt/game-kniffel';
import { gameModule as wordSalad } from '@brett-und-blatt/game-word-salad';
import { gameModule as scrabble } from '@brett-und-blatt/game-scrabble';
import { gameModule as ligretto } from '@brett-und-blatt/game-ligretto';

/**
 * Die Spiele, die online angeboten werden: alle für mehrere Personen. Ein neues
 * Mehrspieler-Spiel muss hier (und in package.json) eingetragen werden – ein Test
 * im Server-Paket erinnert daran.
 */
export const onlineGames: AnyGameModule[] = [battleship, bibleQuiz, bingo, blackPeter, checkers, chess, colorAndShape, colorSorter, dominoes, doppelkopf, drachenspiel, duckRally, factorGrid, fourInARow, fourPlayerChess, go, gomoku, hangman, ludo, ligretto, maexle, mill, numberWall, pairs, poker, quartett, reversi, schafkopf, skat, binokel, scrabble, targetNumber, ticTacToe, ultimateTicTacToe, uno, wordSalad, kniffel];
