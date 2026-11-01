import { generalBots, type GameModule, type OptionSpec } from '@brett-und-blatt/engine';
import { chineseCheckersBot } from './bots';
import { meta } from './meta';
import {
  applyMove,
  currentPlayers,
  evaluate,
  legalMoves,
  resignMove,
  result,
  setup,
  timeoutMove,
  type ChineseCheckersMove,
  type ChineseCheckersState,
} from './rules';

export * from './rules';
export * from './bots';
export { meta } from './meta';

const options: OptionSpec[] = [
  {
    id: 'pieces',
    label: 'Steine je Spieler',
    description: 'Mit 6 Steinen ist eine Partie etwa halb so lang – gut für Kinder und zum Kennenlernen.',
    choices: [
      { value: '10', label: '10 Steine (ganze Zacke)' },
      { value: '6', label: '6 Steine (kurze Partie)' },
    ],
    default: '10',
  },
];

export const gameModule: GameModule<ChineseCheckersState, ChineseCheckersMove> = {
  info: meta,
  options,
  timePresets: {
    relaxed: { kind: 'none' },
    normal: { kind: 'perMove', moveMs: 30_000 },
    fast: { kind: 'perMove', moveMs: 12_000 },
  },
  setup,
  currentPlayers,
  legalMoves,
  applyMove,
  // Offenes Spiel: Jeder darf alles sehen.
  playerView: (state) => state,
  result,
  resignMove,
  timeoutMove,
  evaluate,
  bots: [chineseCheckersBot, ...generalBots<ChineseCheckersState, ChineseCheckersMove, ChineseCheckersState>()],
};
