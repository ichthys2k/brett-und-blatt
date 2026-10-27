import type { GameModule } from '@brett-und-blatt/engine';
import { quizBot } from './bots';
import { meta } from './meta';
import {
  applyMove,
  currentPlayers,
  isLegal,
  legalMoves,
  options,
  playerView,
  result,
  sampleHidden,
  setup,
  timePresets,
  timeoutMove,
  type BibleQuizMove,
  type BibleQuizState,
} from './rules';

export { meta } from './meta';
export * from './questions';
export * from './rules';
export { quizBot } from './bots';

export const gameModule: GameModule<BibleQuizState, BibleQuizMove> = {
  info: meta,
  options,
  timePresets,
  setup,
  currentPlayers,
  legalMoves,
  isLegal,
  applyMove,
  playerView,
  sampleHidden,
  timeoutMove,
  result,
  bots: [quizBot],
};
