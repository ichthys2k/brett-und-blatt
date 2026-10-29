import { Rng, deckStyleOption, parseDeckStyle, type GameModule, type OptionSpec } from '@brett-und-blatt/engine';
import { mauMauBot } from './bots';
import { meta } from './meta';
import {
  applyMove,
  currentPlayers,
  defaultOptions,
  isLegal,
  legalMoves,
  playerView,
  result,
  sampleHidden,
  setup as setupGame,
} from './rules';
import type { MauMauMove, MauMauOptions, MauMauState } from './types';

export const options: OptionSpec[] = [
  deckStyleOption(),
  {
    id: 'sevenStack',
    label: '7er stapeln',
    description: 'Darf eine 7 auf eine 7 gelegt werden, sodass die Strafkarten weiterwandern?',
    choices: [
      { value: 'on', label: 'An (+2, +4, +6 …)' },
      { value: 'off', label: 'Aus (Nächster zieht 2)' },
    ],
    default: defaultOptions.sevenStack,
  },
  {
    id: 'nineReverse',
    label: '9 = Richtungswechsel',
    description: 'Eine 9 kehrt die Spielrichtung um. Bei zwei Spielern wirkt sie wie Aussetzen.',
    choices: [
      { value: 'on', label: 'An' },
      { value: 'off', label: 'Aus' },
    ],
    default: defaultOptions.nineReverse,
  },
  {
    id: 'aceExtraTurn',
    label: 'Ass = noch einmal',
    description: 'Wer ein Ass legt, darf sofort noch eine Karte legen.',
    choices: [
      { value: 'off', label: 'Aus' },
      { value: 'on', label: 'An' },
    ],
    default: defaultOptions.aceExtraTurn,
  },
  {
    id: 'jackOnEverything',
    label: 'Bube auf alles',
    description: 'Der Bube darf auf jede Karte gelegt werden und wünscht eine Farbe.',
    choices: [
      { value: 'on', label: 'An' },
      { value: 'off', label: 'Aus (nur passende Farbe)' },
    ],
    default: defaultOptions.jackOnEverything,
  },
  {
    id: 'jackOnJack',
    label: 'Bube auf Bube',
    description: 'Gilt „Bube auf Bube stinkt“? Dann darf kein Bube auf einen Buben gelegt werden.',
    choices: [
      { value: 'forbidden', label: 'Verboten' },
      { value: 'allowed', label: 'Erlaubt' },
    ],
    default: defaultOptions.jackOnJack,
  },
  {
    id: 'mauCall',
    label: '„Mau!“ rufen',
    description: 'Wer die vorletzte Karte legt, muss „Mau!“ rufen, sonst gibt es eine Strafkarte.',
    choices: [
      { value: 'on', label: 'An' },
      { value: 'off', label: 'Aus (automatisch)' },
    ],
    default: defaultOptions.mauCall,
  },
  {
    id: 'drawRule',
    label: 'Nachziehen',
    description: 'Nur eine Karte ziehen oder so lange ziehen, bis eine passende kommt.',
    choices: [
      { value: 'one', label: '1 Karte ziehen' },
      { value: 'untilMatch', label: 'Ziehen bis passend' },
    ],
    default: defaultOptions.drawRule,
  },
];

export const gameModule: GameModule<MauMauState, MauMauMove> = {
  info: meta,
  options,
  timePresets: {
    relaxed: { kind: 'perMove', moveMs: 60_000 },
    normal: { kind: 'perMove', moveMs: 25_000 },
    fast: { kind: 'perMove', moveMs: 12_000 },
  },
  setup(seats, opts, seed) {
    const rng = Rng.fromSeed(seed);
    const parsed: Partial<MauMauOptions> = {
      deckStyle: parseDeckStyle(opts?.deckStyle),
      sevenStack: (opts?.sevenStack as MauMauOptions['sevenStack']) ?? defaultOptions.sevenStack,
      nineReverse: (opts?.nineReverse as MauMauOptions['nineReverse']) ?? defaultOptions.nineReverse,
      aceExtraTurn: (opts?.aceExtraTurn as MauMauOptions['aceExtraTurn']) ?? defaultOptions.aceExtraTurn,
      jackOnEverything:
        (opts?.jackOnEverything as MauMauOptions['jackOnEverything']) ?? defaultOptions.jackOnEverything,
      jackOnJack: (opts?.jackOnJack as MauMauOptions['jackOnJack']) ?? defaultOptions.jackOnJack,
      mauCall: (opts?.mauCall as MauMauOptions['mauCall']) ?? defaultOptions.mauCall,
      drawRule: (opts?.drawRule as MauMauOptions['drawRule']) ?? defaultOptions.drawRule,
    };
    return setupGame(seats, rng, parsed);
  },
  currentPlayers,
  legalMoves,
  isLegal,
  applyMove,
  playerView,
  sampleHidden,
  result,
  bots: [mauMauBot],
};
