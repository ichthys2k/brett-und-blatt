import { Rng, type GameModule, type OptionSpec } from '@brett-und-blatt/engine';
import { unoBot } from './bots';
import { meta } from './meta';
import { applyMove, currentPlayers, defaultOptions, isLegal, legalMoves, mathCardLabel, playerView, result, sampleHidden, setup, UNO_MATH_POOL } from './rules';
import type { UnoMove, UnoOptions, UnoState } from './types';

export { mathCardLabel, UNO_MATH_POOL };

export const options: OptionSpec[] = [
  {
    id: 'variant',
    label: 'Spielvariante',
    description: 'Wähle das Regelwerk und den Kartensatz.',
    choices: [
      { value: 'classic', label: 'Klassisch' },
      { value: 'no-mercy', label: 'Keine Gnade (No Mercy)' },
      { value: 'flip', label: 'Wenden (Flip)' },
      { value: 'all-wild', label: 'Nur Joker (All Wild)' },
      { value: 'junior', label: 'Junior (Tiere)' },
    ],
    default: defaultOptions.variant,
  },
  {
    id: 'stacking',
    label: 'Strafkarten stapeln',
    description: 'Dürfen Ziehkarten (+2, +4) aufeinander gelegt und kumuliert werden?',
    choices: [
      { value: 'same', label: 'Gleiche (+2 auf +2)' },
      { value: 'progressive', label: 'Aufsteigend (+4 auf +2)' },
      { value: 'off', label: 'Aus' },
    ],
    default: defaultOptions.stacking,
  },
  {
    id: 'sevenZero',
    label: '7-0 Tauschregel',
    description: '7 tauscht die Hand mit einem Wunschspieler; 0 lässt alle Hände wandern.',
    choices: [
      { value: 'off', label: 'Aus' },
      { value: 'on', label: 'An' },
    ],
    default: defaultOptions.sevenZero,
  },
  {
    id: 'jumpIn',
    label: 'Zwischenwerfen (Jump-in)',
    description: 'Wer eine exakt identische Karte hat, darf sie sofort außerhalb der Reihe ablegen.',
    choices: [
      { value: 'off', label: 'Aus' },
      { value: 'on', label: 'An' },
    ],
    default: defaultOptions.jumpIn,
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
  {
    id: 'callUno',
    label: '„Eins!“ rufen',
    description: 'Wer die vorletzte Karte legt, muss aktiv „Eins!“ rufen, um Strafen zu vermeiden.',
    choices: [
      { value: 'on', label: 'An' },
      { value: 'off', label: 'Aus (automatisch)' },
    ],
    default: defaultOptions.callUno,
  },
  {
    id: 'mathLabels',
    label: 'Mathe-Karten',
    description: 'Zahlenkarten (0–9) zeigen Kopfrechenaufgaben, Potenzen und Brüche (Klasse 5/6) statt der Ziffer.',
    choices: [
      { value: 'off', label: 'Aus (Ziffern 0–9)' },
      { value: 'on', label: 'An (Kopfrechnen & Brüche)' },
    ],
    default: defaultOptions.mathLabels ?? 'off',
  },
];

export const gameModule: GameModule<UnoState, UnoMove> = {
  info: meta,
  options,
  timePresets: {
    relaxed: { kind: 'perMove', moveMs: 60_000 },
    normal: { kind: 'perMove', moveMs: 25_000 },
    fast: { kind: 'perMove', moveMs: 12_000 },
  },
  setup(seats, opts, seed) {
    const rng = Rng.fromSeed(seed);
    const parsedOptions: Partial<UnoOptions> = {
      variant: (opts?.variant as UnoOptions['variant']) ?? defaultOptions.variant,
      stacking: (opts?.stacking as UnoOptions['stacking']) ?? defaultOptions.stacking,
      sevenZero: (opts?.sevenZero as UnoOptions['sevenZero']) ?? defaultOptions.sevenZero,
      jumpIn: (opts?.jumpIn as UnoOptions['jumpIn']) ?? defaultOptions.jumpIn,
      drawRule: (opts?.drawRule as UnoOptions['drawRule']) ?? defaultOptions.drawRule,
      callUno: (opts?.callUno as UnoOptions['callUno']) ?? defaultOptions.callUno,
      mathLabels: (opts?.mathLabels as UnoOptions['mathLabels']) ?? defaultOptions.mathLabels,
    };
    return setup(seats, rng, parsedOptions);
  },
  currentPlayers,
  legalMoves,
  isLegal,
  applyMove,
  playerView,
  sampleHidden,
  result,
  bots: [unoBot],
};
