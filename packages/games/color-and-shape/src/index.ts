import { randomBot, type BotDefinition, type GameModule } from '@brett-und-blatt/engine';
import { colorShapeBot } from './bots';
import { meta } from './meta';
import { applyMove, currentPlayers, eventView, isLegal, legalMoves, playerView, result, sampleHidden, setup, type ColorShapeMove, type ColorShapeState } from './rules';

export type { ColorShapeMove, ColorShapeState, Placed, PlacementCheck, TileId } from './rules';
export { checkPlacement, colorOf, HAND_SIZE, placements, shapeOf, validLine } from './rules';

export const gameModule: GameModule<ColorShapeState, ColorShapeMove> = {
  info: meta,
  options: [],
  timePresets: {
    relaxed: { kind: 'none' },
    normal: { kind: 'perMove', moveMs: 60_000 },
    fast: { kind: 'perMove', moveMs: 30_000 },
  },
  setup,
  currentPlayers,
  legalMoves,
  isLegal,
  applyMove,
  playerView,
  result,
  sampleHidden,
  eventView,
  bots: [colorShapeBot, randomBot as unknown as BotDefinition<ColorShapeState, ColorShapeMove>],
};
