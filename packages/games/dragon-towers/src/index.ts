import { generalBots, type GameModule } from '@brett-und-blatt/engine';
import { dragonTowersBot } from './bots';
import { describeMove } from './describe';
import { meta } from './meta';
import { applyMove, currentPlayers, evaluate, isLegal, legalMoves, result, setup, type DragonTowersMove, type DragonTowersState } from './rules';

export type { ColorIndex, DragonTowersMove, DragonTowersState, Tower } from './rules';
export { BOARD_COLORS, COLOR_NAMES, SIZE, movableSquares, squareName, towerSquare, towerTargets } from './rules';

/**
 * Das Spielmodul: Hier kommt alles zusammen, was die Plattform von einem Spiel
 * braucht. Die Plattform findet es automatisch über den Export `gameModule`.
 */
export const gameModule: GameModule<DragonTowersState, DragonTowersMove> = {
  info: meta,
  options: [
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
    normal: { kind: 'perMove', moveMs: 30_000 },
    fast: { kind: 'chessClock', baseMs: 180_000, incrementMs: 2_000 },
  },
  setup,
  currentPlayers,
  legalMoves,
  isLegal,
  applyMove,
  // Offenes Spiel: Die Sicht ist der Spielstand selbst.
  playerView: (state) => state,
  result,
  evaluate,
  // Kurzer Text je Zug für fremde Clients und den Bildschirmleser (#335).
  describeMove,
  bots: [dragonTowersBot, ...generalBots<DragonTowersState, DragonTowersMove, DragonTowersState>()],
};
