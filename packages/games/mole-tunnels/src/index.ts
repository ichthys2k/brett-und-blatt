import { generalBots, type GameModule, type OptionSpec } from '@brett-und-blatt/engine';
import { describeMove } from './describe';
import { meta } from './meta';
import { applyMove, currentPlayers, legalMoves, playerView, result, setup, timeoutMove, type MoleMove, type MoleState } from './rules';

export * from './rules';
export { describeMove } from './describe';
export { meta } from './meta';

const options: OptionSpec[] = [
  {
    id: 'size',
    label: 'Brettgröße',
    choices: [
      { value: '7', label: '7 × 7 (Standard)' },
      { value: '5', label: '5 × 5 (kurz, für kleine Bildschirme)' },
    ],
    default: '7',
  },
  {
    id: 'goal',
    label: 'Rüben zum Sieg',
    choices: [
      { value: '5', label: '5 Rüben (Standard)' },
      { value: '3', label: '3 Rüben (kurz)' },
      { value: '8', label: '8 Rüben (lang)' },
    ],
    default: '5',
  },
  {
    id: 'turnips',
    label: 'Rüben auf dem Brett',
    description: 'Auf dem kleinen 5 × 5-Brett liegen höchstens 6.',
    choices: [
      { value: '6', label: '6 Rüben (Standard)' },
      { value: '4', label: '4 Rüben' },
      { value: '8', label: '8 Rüben' },
    ],
    default: '6',
  },
  {
    id: 'mole',
    label: 'Gärtner Maulwurf',
    description: 'Der Maulwurf sperrt ein Teil, bis es weitergeschoben wird.',
    choices: [
      { value: 'on', label: 'mit Maulwurf (Standard)' },
      { value: 'off', label: 'ohne Maulwurf' },
    ],
    default: 'on',
  },
];

export const gameModule: GameModule<MoleState, MoleMove> = {
  info: meta,
  options,
  timePresets: {
    relaxed: { kind: 'none' },
    // Ein Zug umfasst beide Schritte: Schieben und Laufen.
    normal: { kind: 'perMove', moveMs: 45_000 },
    fast: { kind: 'perMove', moveMs: 20_000 },
  },
  setup,
  currentPlayers,
  legalMoves,
  applyMove,
  // Alles offen: die Sicht ist der Spielstand ohne Zufallszustand.
  playerView,
  result,
  timeoutMove,
  describeMove,
  // Eigener Bot „Wühlmaus“ folgt in M2; bis dahin die allgemeinen Bots.
  bots: generalBots<MoleState, MoleMove, MoleState>(),
};
