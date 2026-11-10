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
    description: 'Mit 6 Steinen für eine kurze Partie; 15 oder 19 Steine für tiefere Duelle (bei 2–3 Spielern).',
    choices: [
      { value: '10', label: '10 Steine (ganze Zacke)' },
      { value: '6', label: '6 Steine (kurze Partie)' },
      { value: '15', label: '15 Steine (2–3 Spieler, tiefere Partie)' },
      { value: '19', label: '19 Steine (2–3 Spieler, Halma-Klassiker)' },
    ],
    default: '10',
  },
  {
    id: 'rotateBoard',
    label: 'Brett drehen im Hot-Seat',
    description: 'Dreht das Brett nach jedem Zug zum aktiven Spieler. Ausschalten für eine feste Ausrichtung am Tisch.',
    choices: [
      { value: 'true', label: 'Automatisch drehen' },
      { value: 'false', label: 'Fest ausrichten (nicht drehen)' },
    ],
    default: 'true',
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
