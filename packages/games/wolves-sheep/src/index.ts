import type { GameModule } from '@brett-und-blatt/engine';
import { wolvesSheepBot } from './bots';
import { meta } from './meta';
import {
  applyMove,
  currentPlayers,
  isLegal,
  legalMoves,
  playerView,
  resignMove,
  result,
  sampleHidden,
  setup,
  systemDelayMs,
  timeoutMove,
  type WolvesSheepMove,
  type WolvesSheepState,
} from './rules';

export type { Departure, DepartureCause, ElectionRecord, Examination, PendingAction, Phase, Role, RolesInPlay, VoteRecord, WolvesSheepMove, WolvesSheepState } from './rules';
export { buildDeck, livingSeats, nightTargets, partnerOf, speakerOf, wolfCount } from './rules';

export const gameModule: GameModule<WolvesSheepState, WolvesSheepMove> = {
  info: meta,
  options: [
    {
      id: 'shepherd',
      label: 'Hirte',
      description: 'Sieht das Opfer der Nacht, kann einmal retten und einmal jemanden ausweisen.',
      choices: [
        { value: 'off', label: 'aus' },
        { value: 'on', label: 'an' },
      ],
      default: 'off',
    },
    {
      id: 'hound',
      label: 'Hütehund',
      description: 'Nimmt beim Ausscheiden noch jemanden mit.',
      choices: [
        { value: 'off', label: 'aus' },
        { value: 'on', label: 'an' },
      ],
      default: 'off',
    },
    {
      id: 'binder',
      label: 'Bandstifter',
      description: 'Verbindet in der ersten Nacht zwei Personen, die nur zusammen bleiben.',
      choices: [
        { value: 'off', label: 'aus' },
        { value: 'on', label: 'an' },
      ],
      default: 'off',
    },
    {
      id: 'lamb',
      label: 'Neugieriges Lamm',
      description: 'Darf nachts bei den Wölfen linsen und kann dabei erwischt werden.',
      choices: [
        { value: 'off', label: 'aus' },
        { value: 'on', label: 'an' },
      ],
      default: 'off',
    },
    {
      id: 'stray',
      label: 'Zugelaufenes Schaf',
      description: 'Darf zu Beginn gegen eine der zwei übrigen Karten tauschen.',
      choices: [
        { value: 'off', label: 'aus' },
        { value: 'on', label: 'an' },
      ],
      default: 'off',
    },
    {
      id: 'leader',
      label: 'Leithammel',
      description: 'Wird am ersten Morgen gewählt. Die Stimme zählt doppelt.',
      choices: [
        { value: 'off', label: 'aus' },
        { value: 'on', label: 'an' },
      ],
      default: 'off',
    },
    {
      id: 'debate',
      label: 'Beratung',
      description: '„Bis zum Knopf“: Der Leithammel oder die erste Person im Kreis eröffnet den Herdenrat, wenn alle so weit sind.',
      choices: [
        { value: '120', label: '2 Minuten' },
        { value: '180', label: '3 Minuten' },
        { value: '300', label: '5 Minuten' },
        { value: '0', label: 'bis zum Knopf' },
      ],
      default: '180',
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
  result,
  resignMove,
  systemDelayMs,
  timeoutMove,
  sampleHidden,
  bots: [wolvesSheepBot],
};
