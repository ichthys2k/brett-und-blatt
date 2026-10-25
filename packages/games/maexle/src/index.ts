import { generalBots, type GameModule } from '@brett-und-blatt/engine';
import { maexleBot } from './bots';
import { meta } from './meta';
import { applyMove, currentPlayers, legalMoves, playerView, result, sampleHidden, setup, type MaexleMove, type MaexleState } from './rules';

export type { Announcement, MaexleMove, MaexleState, MaexleValue, Phase, Reveal } from './rules';
export { MAEXLE, RANKING, isDouble, isIn, lastAnnouncement, rankOf, valueOf, valuesAbove } from './rules';
export { PROBABILITY, chanceAtLeast } from './bots';

export const gameModule: GameModule<MaexleState, MaexleMove> = {
  info: meta,
  options: [
    {
      id: 'lives',
      label: 'Leben',
      choices: ['1', '2', '3', '4', '5', '6'].map((value) => ({ value, label: value })),
      default: '3',
    },
    {
      id: 'maexleCost',
      label: 'Echtes Mäxle anzweifeln',
      choices: [
        { value: '2', label: 'kostet 2 Leben' },
        { value: '1', label: 'kostet 1 Leben' },
      ],
      default: '2',
    },
    {
      id: 'blind',
      label: 'Blind weitergeben',
      description: 'Glauben und ohne zu würfeln eine höhere Zahl ansagen.',
      choices: [
        { value: 'off', label: 'aus' },
        { value: 'on', label: 'an' },
      ],
      default: 'off',
    },
    {
      id: 'scoring',
      label: 'Wertung',
      description: 'Bei Strafpunkten scheidet niemand aus: Sobald jemand so viele Strafpunkte hat, wie Leben eingestellt sind, gewinnt, wer die wenigsten hat.',
      choices: [
        { value: 'lives', label: 'Leben (Ausscheiden)' },
        { value: 'points', label: 'Strafpunkte' },
      ],
      default: 'lives',
    },
    {
      id: 'shake',
      label: 'Würfeln',
      choices: [
        { value: 'on', label: 'Schütteln, wo verfügbar' },
        { value: 'off', label: 'nur Knopf' },
      ],
      default: 'on',
    },
  ],
  timePresets: {
    relaxed: { kind: 'none' },
    normal: { kind: 'perMove', moveMs: 12_000 },
    fast: { kind: 'perMove', moveMs: 6_000 },
  },
  setup,
  currentPlayers,
  legalMoves,
  applyMove,
  playerView,
  result,
  sampleHidden,
  bots: [maexleBot, ...generalBots<MaexleState, MaexleMove, MaexleState>()],
};
