import { generalBots, type GameModule, type OptionSpec } from '@brett-und-blatt/engine';
import { ludoBot } from './bots';
import { meta } from './meta';
import {
  applyMove,
  currentPlayers,
  legalMoves,
  playerView,
  result,
  setup,
  timeoutMove,
  type LudoMove,
  type LudoState,
} from './rules';

export * from './rules';
export * from './bots';
export { meta } from './meta';

const options: OptionSpec[] = [
  {
    id: 'board',
    label: 'Spielbrett',
    description: 'Das Sechser-Brett hat sechs Arme und 54 Felder. Ab fünf Spielern wird immer darauf gespielt.',
    choices: [
      { value: 'classic', label: 'Kreuz für bis zu 4 (Standard)' },
      { value: 'six', label: 'Stern für bis zu 6' },
    ],
    default: 'classic',
  },
  {
    id: 'capture',
    label: 'Schlagpflicht',
    description: 'Schlagbare Züge haben Vorrang vor normalen Zügen.',
    choices: [
      { value: 'off', label: 'Schlagen freiwillig (Standard)' },
      { value: 'on', label: 'Schlagpflicht an' },
    ],
    default: 'off',
  },
  {
    id: 'threeRolls',
    label: 'Drei Würfelversuche',
    description: 'Bis zu 3 Versuche, um eine 6 zum Herauskommen zu erzielen.',
    choices: [
      { value: 'empty_track', label: 'Nur wenn keine Figur auf der Strecke' },
      { value: 'never', label: 'Immer nur 1 Wurf' },
    ],
    default: 'empty_track',
  },
  {
    id: 'enterRule',
    label: 'Herauskommen',
    description: 'Welche Würfelzahl eine Figur aus dem Haus auf das Startfeld bringt.',
    choices: [
      { value: 'six', label: 'Nur bei 6 (Klassisch)' },
      { value: 'six_or_one', label: 'Bei 6 oder 1 (Flotte Runde)' },
    ],
    default: 'six',
  },
  {
    id: 'exactGoal',
    label: 'Einzug ins Ziel',
    description: 'Zielfelder müssen passend getroffen werden.',
    choices: [
      { value: 'on', label: 'Genaues Treffen (ohne Überspringen)' },
      { value: 'off', label: 'Flexibles Einrücken' },
    ],
    default: 'on',
  },
];

export const gameModule: GameModule<LudoState, LudoMove> = {
  info: meta,
  options,
  timePresets: {
    relaxed: { kind: 'none' },
    normal: { kind: 'perMove', moveMs: 25_000 },
    fast: { kind: 'perMove', moveMs: 12_000 },
  },
  setup,
  currentPlayers,
  legalMoves,
  applyMove,
  playerView,
  result,
  timeoutMove,
  bots: [ludoBot, ...generalBots<LudoState, LudoMove, LudoState>()],
};
