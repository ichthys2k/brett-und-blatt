import { generalBots, type GameModule } from '@brett-und-blatt/engine';
import { checkersBot } from './bots';
import { meta } from './meta';
import {
  applyMove,
  countPieces,
  currentPlayers,
  evaluate,
  legalMoves,
  result,
  setup,
  type CheckersMove,
  type CheckersPiece,
  type CheckersState,
  type CheckersVariant,
} from './rules';

export type { CheckersMove, CheckersPiece, CheckersState, CheckersVariant } from './rules';
export { countPieces, isDarkSquare, squareIndex, squareName } from './rules';

/**
 * Das Spielmodul: Hier kommt alles zusammen, was die Plattform von einem Spiel
 * braucht. Die Plattform findet es automatisch über den Export `gameModule`.
 */
export const gameModule: GameModule<CheckersState, CheckersMove> = {
  info: meta,
  options: [
    {
      id: 'variant',
      label: 'Regelvariante',
      description: 'Klassisch Deutsch: fliegende Dame, Steine schlagen nur vorwärts, freie Schlagwahl. International: Steine schlagen vor- und rückwärts, Mehrheitszwang.',
      choices: [
        {
          value: 'german',
          label: 'Klassisch Deutsch',
        },
        {
          value: 'international',
          label: 'International',
        },
        {
          value: 'english',
          label: 'Checkers (Englisch)',
        },
      ],
      default: 'german',
    },
    {
      id: 'size',
      label: 'Brettgröße',
      choices: [
        { value: '8', label: '8 × 8 (12 Steine)' },
        { value: '10', label: '10 × 10 (20 Steine)' },
      ],
      default: '8',
    },
    {
      id: 'board',
      label: 'Brett drehen',
      description: 'Wichtig bei Hot-Seat am selben Gerät: Soll sich das Brett nach jedem Zug zur Farbe am Zug drehen?',
      choices: [
        { value: 'turn', label: 'Zum Spieler am Zug' },
        { value: 'fixed', label: 'Fest' },
      ],
      default: 'turn',
    },
  ],
  timePresets: {
    relaxed: { kind: 'none' },
    normal: { kind: 'perMove', moveMs: 20_000 },
    fast: { kind: 'chessClock', baseMs: 180_000, incrementMs: 2_000 },
  },
  setup,
  currentPlayers,
  legalMoves,
  applyMove,
  playerView: (state) => state,
  result,
  evaluate,
  bots: [checkersBot, ...generalBots<CheckersState, CheckersMove, CheckersState>()],
};
