import { generalBots, type GameModule } from '@brett-und-blatt/engine';
import { ticTacToeBot } from './bots';
import { meta } from './meta';
import { applyMove, currentPlayers, evaluate, legalMoves, result, setup, type TicTacToeMove, type TicTacToeState } from './rules';

export type { TicTacToeMove, TicTacToeState } from './rules';

/**
 * Das Spielmodul: Hier kommt alles zusammen, was die Plattform von einem Spiel
 * braucht. Die Plattform findet es automatisch über den Export `gameModule`.
 */
export const gameModule: GameModule<TicTacToeState, TicTacToeMove> = {
  info: meta,
  // Varianten und Hausregeln erscheinen als Auswahl in der Lobby. Tic-Tac-Toe hat keine.
  options: [],
  timePresets: {
    relaxed: { kind: 'none' },
    normal: { kind: 'perMove', moveMs: 10_000 },
    fast: { kind: 'perMove', moveMs: 5_000 },
  },
  setup,
  currentPlayers,
  legalMoves,
  applyMove,
  // Offenes Spiel: Jeder darf alles sehen, die Sicht ist der Spielstand selbst.
  playerView: (state) => state,
  result,
  evaluate,
  // Der erste Bot ist der Standard in der Lobby; dahinter die allgemeinen Bots.
  bots: [ticTacToeBot, ...generalBots<TicTacToeState, TicTacToeMove, TicTacToeState>()],
};
