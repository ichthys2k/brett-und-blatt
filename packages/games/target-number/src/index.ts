import type { GameModule } from '@brett-und-blatt/engine';
import { targetNumberBot } from './bots';
import { meta } from './meta';
import {
  allowedOpList,
  applyMove,
  applySingleStep,
  currentPlayers,
  findCandidateMoves,
  isLegal,
  legalMoves,
  playerView,
  result,
  sampleHidden,
  scoreSubmission,
  setup,
  simulateSteps,
  type AllowedOps,
  type CalcStep,
  type EvalItem,
  type MathOp,
  type RoundSummary,
  type TargetMode,
  type TargetNumberMove,
  type TargetNumberState,
} from './rules';

export type { AllowedOps, CalcStep, EvalItem, MathOp, RoundSummary, TargetMode, TargetNumberMove, TargetNumberState };
export { allowedOpList, applySingleStep, findCandidateMoves, scoreSubmission, simulateSteps };

export const gameModule: GameModule<TargetNumberState, TargetNumberMove> = {
  info: meta,
  options: [
    {
      id: 'mode',
      label: 'Modus',
      description: 'Klassisch 24 mit 4 Zahlenkarten oder wechselnde Zielzahlen aus 5 bzw. 6 Karten.',
      choices: [
        { value: 'classic24', label: 'Klassisch 24 (4 Karten)' },
        { value: 'target100', label: 'Zielzahl bis 100 (5 Karten)' },
        { value: 'target500', label: 'Große Zielzahl bis 500 (6 Karten)' },
      ],
      default: 'classic24',
    },
    {
      id: 'ops',
      label: 'Rechenarten',
      description: 'Grundrechenarten mit oder ohne Division.',
      choices: [
        { value: 'all', label: '+, −, · und :' },
        { value: 'addSubMul', label: 'Nur +, − und ·' },
      ],
      default: 'all',
    },
    {
      id: 'rounds',
      label: 'Runden',
      choices: [
        { value: '3', label: '3 Runden (kurz)' },
        { value: '5', label: '5 Runden' },
        { value: '8', label: '8 Runden' },
        { value: '10', label: '10 Runden' },
      ],
      default: '5',
    },
  ],
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
  sampleHidden,
  result,
  bots: [targetNumberBot],
};
