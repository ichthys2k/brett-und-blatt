import type { GameModule } from '@brett-und-blatt/engine';
import { presidentBot } from './bots';
import { meta } from './meta';
import { applyMove, currentPlayers, isLegal, legalMoves, playerView, result, sampleHidden, setup, type PresidentMove, type PresidentState, type PresidentView } from './rules';

export type { PresidentMove, PresidentState, PresidentView } from './rules';

const onOff = [
  { value: 'off', label: 'Aus' },
  { value: 'on', label: 'An' },
];

export const gameModule: GameModule<PresidentState, PresidentMove, PresidentView> = {
  info: meta,
  options: [
    {
      id: 'rounds',
      label: 'Runden',
      choices: [
        { value: '3', label: '3 Runden' },
        { value: '5', label: '5 Runden' },
        { value: '10', label: '10 Runden' },
      ],
      default: '5',
    },
    {
      id: 'deck',
      label: 'Blatt',
      description: 'Automatisch: 32 Karten bis fünf Spieler, 52 Karten ab sechs.',
      choices: [
        { value: 'auto', label: 'Automatisch' },
        { value: '32', label: '32 Karten (7 bis Ass)' },
        { value: '52', label: '52 Karten (2 bis Ass)' },
      ],
      default: 'auto',
    },
    {
      id: 'deckStyle',
      label: 'Kartenbild',
      choices: [
        { value: 'french', label: 'Französisch' },
        { value: 'four-color', label: 'Vierfarbig' },
        { value: 'german', label: 'Deutsch' },
      ],
      default: 'french',
    },
    {
      id: 'titles',
      label: 'Titel',
      description: 'Königshof: König, Prinz, Bürger, Knecht, Bettler – schön für Kinder.',
      choices: [
        { value: 'president', label: 'Präsident … Bettler' },
        { value: 'court', label: 'Königshof' },
      ],
      default: 'president',
    },
    {
      id: 'passing',
      label: 'Nach dem Passen',
      choices: [
        { value: 'reenter', label: 'Später wieder einsteigen' },
        { value: 'out', label: 'Für den Stich draußen' },
      ],
      default: 'reenter',
    },
    { id: 'sameSkips', label: 'Gleich legen', description: 'Wer den gleichen Rang legt, lässt den Nächsten aussetzen.', choices: onOff, default: 'off' },
    { id: 'eightClears', label: 'Achter räumt', description: 'Eine 8 (auch als Paar …) beendet den Stich sofort, der Leger beginnt neu.', choices: onOff, default: 'off' },
    { id: 'revolution', label: 'Revolution', description: 'Wer vier Gleiche legt, kehrt die Rangfolge bis zum Rundenende um.', choices: onOff, default: 'off' },
    {
      id: 'twoHigh',
      label: '2 ist die höchste Karte',
      description: 'Nur mit 52 Karten: Rangfolge 3 bis Ass, darüber die 2.',
      choices: onOff,
      default: 'off',
      when: { deck: ['52'] },
    },
  ],
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
  result,
  sampleHidden,
  bots: [presidentBot],
};
