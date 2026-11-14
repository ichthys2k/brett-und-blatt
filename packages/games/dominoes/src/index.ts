import { randomBot, type BotDefinition, type GameModule } from '@brett-und-blatt/engine';
import { dominoBot } from './bots';
import { meta } from './meta';
import { applyMove, currentPlayers, eventView, isLegal, legalMoves, playerView, result, sampleHidden, setup, type DominoMove, type DominoState } from './rules';
import { describeMove } from './describe';

export type { ChainStone, DominoDisplay, DominoEnd, DominoMove, DominoState, DominoVariant, RoundSummary, StoneId, TrainTarget } from './rules';
export { endSum, ends, FRACTION_POOL, halfLabel, isDouble, mexicanOpenTargets, pipsOf, playsFor, stoneCountForSet, stoneIdOf, STONES, teamSeats, TERM_POOL } from './rules';

export const gameModule: GameModule<DominoState, DominoMove> = {
  info: meta,
  options: [
    {
      id: 'variant',
      label: 'Variante',
      description: 'Block: wer nicht kann, passt. Ziehen: aus dem Vorrat ziehen. Fünfer: Punkte für Vielfache von 5 an den Enden. Mexican Train: Bahnhof in der Mitte mit eigenen und gemeinsamen Zügen.',
      choices: [
        { value: 'block', label: 'Block' },
        { value: 'draw', label: 'Ziehen' },
        { value: 'fives', label: 'Fünfer' },
        { value: 'mexican', label: 'Mexican Train' },
      ],
      default: 'draw',
    },
    {
      id: 'setSize',
      label: 'Dominosatz',
      description: 'Größe des Steinsatzes. Mexican Train spielt sich besonders gut mit Doppel-9 oder Doppel-12.',
      choices: [
        { value: '6', label: 'Doppel-6 (28 Steine)' },
        { value: '9', label: 'Doppel-9 (55 Steine)' },
        { value: '12', label: 'Doppel-12 (91 Steine)' },
      ],
      default: '6',
    },
    {
      id: 'teams',
      label: 'Mannschaften (2 gegen 2)',
      description: 'Zu viert bilden die gegenübersitzenden Plätze (1 & 3 gegen 2 & 4) ein gemeinsames Team.',
      when: { variant: ['block', 'draw', 'fives'] },
      choices: [
        { value: 'no', label: 'Jeder für sich' },
        { value: 'yes', label: 'Teams (2 gegen 2)' },
      ],
      default: 'no',
    },
    {
      id: 'display',
      label: 'Darstellung',
      description: 'Im Mathe-Modus stehen auf den Steinen Rechenterme oder Brüche für die Werte.',
      choices: [
        { value: 'pips', label: 'Augen' },
        { value: 'terms', label: 'Rechenterme (Kl. 5)' },
        { value: 'fractions', label: 'Brüche & Dezimal (Kl. 6)' },
      ],
      default: 'pips',
    },
    {
      id: 'target',
      label: 'Spielziel',
      choices: [
        { value: '50', label: '50 Punkte' },
        { value: '100', label: '100 Punkte' },
        { value: '150', label: '150 Punkte' },
        { value: '250', label: '250 Punkte' },
      ],
      default: '100',
    },
    {
      id: 'spinner',
      label: 'Spinner',
      description: 'Beim Fünfer-Domino wird der erste Pasch zum Spinner mit vier offenen Enden.',
      when: { variant: ['fives'] },
      choices: [
        { value: 'no', label: 'Nein' },
        { value: 'yes', label: 'Ja' },
      ],
      default: 'no',
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
  playerView,
  describeMove,
  result,
  sampleHidden,
  eventView,
  bots: [dominoBot, randomBot as unknown as BotDefinition<DominoState, DominoMove>],
};
