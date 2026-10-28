import type { GameModule } from '@brett-und-blatt/engine';
import { ligrettoBot } from './bots';
import { meta } from './meta';
import { GOALS, applyMove, currentPlayers, isLegal, legalMoves, playerView, result, sampleHidden, setup, type LigrettoMove, type LigrettoState, type LigrettoView } from './rules';

export type { LigrettoMove, LigrettoState, LigrettoView } from './rules';

export const gameModule: GameModule<LigrettoState, LigrettoMove, LigrettoView> = {
  info: meta,
  options: [
    {
      id: 'goal',
      label: 'Spieldauer',
      choices: GOALS,
      default: 'r3',
    },
    {
      id: 'flip',
      label: 'Handkarten umblättern',
      description: 'Klassisch je drei auf einmal; einzeln ist leichter.',
      choices: [
        { value: 'three', label: 'Je drei (klassisch)' },
        { value: 'one', label: 'Einzeln (leichter)' },
      ],
      default: 'three',
    },
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
  bots: [ligrettoBot],
};
