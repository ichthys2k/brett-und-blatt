import { deckStyleOption, type GameModule } from '@brett-und-blatt/engine';
import { speedBot } from './bots';
import { meta } from './meta';
import { GOALS, applyMove, currentPlayers, isLegal, legalMoves, playerView, result, sampleHidden, setup, type DrawMode, type SpeedMove, type SpeedState, type SpeedVariant, type SpeedView } from './rules';
import { describeMove } from './describe';

export type { DrawMode, SpeedMove, SpeedState, SpeedVariant, SpeedView } from './rules';

export const gameModule: GameModule<SpeedState, SpeedMove, SpeedView> = {
  info: meta,
  options: [
    {
      id: 'variant',
      label: 'Variante',
      description: 'Speed: fünf Handkarten und Nachziehstapel. Spit: fünf Auslagestapel (1–5 Karten, oberste offen) und Spit-Vorrat.',
      choices: [
        { value: 'speed', label: 'Speed (Klassisch)' },
        { value: 'spit', label: 'Spit (Auslagestapel)' },
      ],
      default: 'speed',
    },
    {
      id: 'drawMode',
      label: 'Nachziehen',
      description: 'Automatisch nach jedem Ablegen oder aktiv durch Antippen des eigenen Nachziehstapels.',
      when: { variant: ['speed'] },
      choices: [
        { value: 'auto', label: 'Automatisch' },
        { value: 'manual', label: 'Von Hand antippen' },
      ],
      default: 'auto',
    },
    { id: 'goal', label: 'Spieldauer', choices: GOALS, default: 'b3' },
    {
      id: 'wrap',
      label: 'Ass rund',
      description: 'Auf den König passt ein Ass, auf das Ass ein König.',
      choices: [
        { value: 'on', label: 'Ja (K–A–2)' },
        { value: 'off', label: 'Nein' },
      ],
      default: 'on',
    },
    deckStyleOption('deck'),
  ],
  // Echtzeit: Die Uhr misst nur, wie lange jemand gar nichts tut – dann hilft der Bot aus.
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
  describeMove,
  result,
  sampleHidden,
  bots: [speedBot],
};
