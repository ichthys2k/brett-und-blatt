import { randomBot, type BotDefinition, type GameModule } from '@brett-und-blatt/engine';
import { dominoBot } from './bots';
import { meta } from './meta';
import { applyMove, currentPlayers, eventView, isLegal, legalMoves, playerView, result, sampleHidden, setup, type DominoMove, type DominoState } from './rules';

export type { ChainStone, DominoDisplay, DominoMove, DominoState, DominoVariant, RoundSummary, StoneId } from './rules';
export { endSum, ends, FRACTION_POOL, halfLabel, isDouble, pipsOf, playsFor, STONES, TERM_POOL } from './rules';

export const gameModule: GameModule<DominoState, DominoMove> = {
  info: meta,
  options: [
    {
      id: 'variant',
      label: 'Variante',
      description: 'Block: wer nicht kann, passt. Ziehen: aus dem Vorrat ziehen. Fünfer: dazu Punkte für Vielfache von 5 an den Enden.',
      choices: [
        { value: 'block', label: 'Block' },
        { value: 'draw', label: 'Ziehen' },
        { value: 'fives', label: 'Fünfer' },
      ],
      default: 'draw',
    },
    {
      id: 'display',
      label: 'Darstellung',
      description: 'Im Mathe-Modus stehen auf den Steinen Rechenterme oder Brüche für die Werte 0 bis 6.',
      choices: [
        { value: 'pips', label: 'Augen (0–6)' },
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
  result,
  sampleHidden,
  eventView,
  bots: [dominoBot, randomBot as unknown as BotDefinition<DominoState, DominoMove>],
};
