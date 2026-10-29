import { deckStyleOption, type GameModule } from '@brett-und-blatt/engine';
import { speedBot } from './bots';
import { meta } from './meta';
import { GOALS, applyMove, currentPlayers, isLegal, legalMoves, playerView, result, sampleHidden, setup, type SpeedMove, type SpeedState, type SpeedView } from './rules';

export type { SpeedMove, SpeedState, SpeedView } from './rules';

export const gameModule: GameModule<SpeedState, SpeedMove, SpeedView> = {
  info: meta,
  options: [
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
  result,
  sampleHidden,
  bots: [speedBot],
};
