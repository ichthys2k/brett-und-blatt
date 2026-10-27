import type { GameModule } from '@brett-und-blatt/engine';
import { duckRallyBot } from './bots';
import { meta } from './meta';
import {
  applyMove,
  currentPlayers,
  generateMathProblem,
  isLegal,
  isPrimeNumber,
  legalMoves,
  playerView,
  rankRacers,
  result,
  setup,
  solveMathProblem,
  type DuckRallyMove,
  type DuckRallyState,
  type MathProblem,
  type ProblemKind,
  type RacerState,
  type RallyDifficulty,
  type RallyTopic,
} from './rules';

export {
  applyMove,
  currentPlayers,
  duckRallyBot,
  generateMathProblem,
  isLegal,
  isPrimeNumber,
  legalMoves,
  playerView,
  rankRacers,
  result,
  setup,
  solveMathProblem,
  type DuckRallyMove,
  type DuckRallyState,
  type MathProblem,
  type ProblemKind,
  type RacerState,
  type RallyDifficulty,
  type RallyTopic,
};

export const gameModule: GameModule<DuckRallyState, DuckRallyMove> = {
  info: meta,
  options: [
    {
      id: 'topic',
      label: 'Aufgabenart',
      description: 'Welche Mathe-Themen auf der Rennstrecke vorkommen.',
      choices: [
        { value: 'basic', label: 'Grundrechenarten (+, −, ·, :)' },
        { value: 'addSub', label: 'Nur Plus & Minus (+, −)' },
        { value: 'mulDiv', label: 'Einmaleins & Teilen (·, :)' },
        { value: 'algebra', label: 'Gleichungen (x bestimmen)' },
        { value: 'percentPrime', label: 'Prozente & Primzahlen' },
        { value: 'mix', label: 'Bunter Mix (alle Themen)' },
      ],
      default: 'basic',
    },
    {
      id: 'difficulty',
      label: 'Schwierigkeit',
      choices: [
        { value: 'easy', label: 'Leicht (kleine Zahlen)' },
        { value: 'medium', label: 'Mittel (Klasse 5/6 Standard)' },
        { value: 'hard', label: 'Schwer (Kopfrechen-Profis)' },
      ],
      default: 'medium',
    },
    {
      id: 'target',
      label: 'Streckenlänge',
      choices: [
        { value: '10', label: 'Sprint (10 Aufgaben)' },
        { value: '15', label: 'Standard (15 Aufgaben)' },
        { value: '25', label: 'Langstrecke (25 Aufgaben)' },
      ],
      default: '15',
    },
  ],
  // Da alle Enten im Wettrennen gleichzeitig um die Wette schwimmen, braucht es keine Zug-Uhr.
  timePresets: {
    relaxed: { kind: 'none' },
    normal: { kind: 'none' },
    fast: { kind: 'none' },
  },
  setup,
  currentPlayers,
  legalMoves,
  isLegal,
  applyMove,
  playerView,
  result,
  bots: [duckRallyBot],
};
