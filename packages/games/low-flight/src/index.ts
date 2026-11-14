import type { GameModule } from '@brett-und-blatt/engine';
import { lowFlightBot } from './bots';
import { meta } from './meta';
import { GOALS, applyMove, currentPlayers, eventView, isLegal, legalMoves, playerView, result, sampleHidden, setup, type LowFlightMove, type LowFlightState, type LowFlightView } from './rules';
import { describeMove } from './describe';

export type { LowFlightMove, LowFlightState, LowFlightView } from './rules';

export const gameModule: GameModule<LowFlightState, LowFlightMove, LowFlightView> = {
  info: meta,
  options: [
    {
      id: 'variant',
      label: 'Spielart',
      description: 'Junior: Obstkarten 1 bis 5 statt Zahlen, Raster 3 × 3, nur eine Karte zu Beginn aufdecken.',
      choices: [
        { value: 'classic', label: 'Klassisch' },
        { value: 'junior', label: 'Junior (Obst)' },
      ],
      default: 'classic',
    },
    { id: 'goal', label: 'Spieldauer', choices: GOALS, default: 'p100', when: { variant: ['classic'] } },
    {
      id: 'juniorGoal',
      label: 'Spieldauer',
      choices: GOALS.filter((g) => g.value === 'r3' || g.value === 'r1'),
      default: 'r3',
      when: { variant: ['junior'] },
    },
    {
      id: 'doubling',
      label: 'Verdopplung',
      description: 'Wer die Runde beendet, aber nicht allein die niedrigste Summe hat, zahlt doppelt.',
      choices: [
        { value: 'on', label: 'An' },
        { value: 'off', label: 'Aus' },
      ],
      default: 'on',
      when: { variant: ['classic'] },
    },
    {
      id: 'rows',
      label: 'Zeilen abräumen',
      description: 'Auch eine ganze Zeile gleicher Karten wird abgeräumt.',
      choices: [
        { value: 'off', label: 'Aus' },
        { value: 'on', label: 'An' },
      ],
      default: 'off',
    },
    {
      id: 'diagonals',
      label: 'Diagonalen abräumen',
      description: 'Auch eine ganze Diagonale gleicher Karten (Länge 3) wird abgeräumt.',
      choices: [
        { value: 'off', label: 'Aus' },
        { value: 'on', label: 'An' },
      ],
      default: 'off',
    },
    {
      id: 'actionCards',
      label: 'Aktionskarten',
      description: 'Kartenwerte 7 bis 10 lösen beim Abwerfen Aktionen aus (Spähen, Tauschen, Doppelzug, Doppel-Aufdecken).',
      choices: [
        { value: 'off', label: 'Aus' },
        { value: 'on', label: 'An' },
      ],
      default: 'off',
      when: { variant: ['classic'] },
    },
    {
      id: 'memoryMode',
      label: 'Gedächtnis-Modus',
      description: 'Einmal angesehene verdeckte Karten dürfen während der Partie nicht erneut aufgedeckt eingesehen werden (keine Spickzettel-Notizen).',
      choices: [
        { value: 'off', label: 'Aus' },
        { value: 'on', label: 'An' },
      ],
      default: 'off',
    },
  ],
  timePresets: {
    relaxed: { kind: 'none' },
    normal: { kind: 'perMove', moveMs: 30_000 },
    fast: { kind: 'perMove', moveMs: 15_000 },
  },
  setup,
  currentPlayers,
  legalMoves,
  isLegal,
  applyMove,
  eventView,
  playerView,
  describeMove,
  result,
  sampleHidden,
  bots: [lowFlightBot],
};
