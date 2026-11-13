import { generalBots, type GameModule, type OptionSpec } from '@brett-und-blatt/engine';
import { grafschaftBot } from './bots';
import { meta } from './meta';
import {
  applyMove,
  checkQuestCondition,
  currentPlayers,
  evaluate,
  getNeighbors,
  hexDistance,
  hexKey,
  isLegal,
  legalMoves,
  parseHexKey,
  playerView,
  result,
  sampleHidden,
  setup,
  type GrafschaftMove,
  type GrafschaftState,
} from './rules';
import { describeMove } from './describe';

export type { GrafschaftMove, GrafschaftState, Landscape, PlacedTile, QuestDef, Tile } from './rules';
export { checkQuestCondition, getNeighbors, hexDistance, hexKey, parseHexKey };

export const options: OptionSpec[] = [
  {
    id: 'deckSize',
    label: 'Plättchenzahl',
    description: 'Umfang des Landschaftsstapels.',
    default: '60',
    choices: [
      { value: '60', label: '60 Plättchen (Standard, ca. 15 Min.)' },
      { value: '40', label: '40 Plättchen (Kurzpartie)' },
    ],
  },
  {
    id: 'quests',
    label: 'Hofaufträge',
    description: 'Geheime Aufträge auf der Hand oder offene Auslage für alle.',
    default: 'geheim',
    choices: [
      { value: 'geheim', label: 'Geheim (3 eigene Aufträge)' },
      { value: 'offen', label: 'Offen (für alle sichtbar)' },
    ],
  },
];

export const gameModule: GameModule<GrafschaftState, GrafschaftMove> = {
  info: meta,
  options,
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
  sampleHidden,
  result,
  evaluate,
  bots: [grafschaftBot, ...generalBots<GrafschaftState, GrafschaftMove, GrafschaftState>()],
};
