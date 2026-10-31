import { deckStyleOption, type GameModule } from '@brett-und-blatt/engine';
import { binokelBot } from './bot/index';
import { meta } from './meta';
import { applyMove, currentPlayers, isLegal, legalMoves, playerView, result, sampleHidden, setup, type BinokelMove, type BinokelState } from './rules';

export { activeSeats, teamOf } from './rules';
export type { BinokelMove, BinokelPhase, BinokelState, RoundResult } from './rules';
export { findMelds, meldPoints, type Meld } from './melds';
export { binokelContract, createDeck, SUIT_NAMES, SUITS } from './cards';
export { binokelBot } from './bot/index';

export const gameModule: GameModule<BinokelState, BinokelMove> = {
  info: meta,
  options: [
    {
      id: 'fourTable',
      label: 'Zu viert',
      description: 'Gilt nur mit vier Plätzen: Entweder setzt der Geber jedes Spiel aus, oder alle vier spielen Kreuzbinokel (die Gegenübersitzenden sind Partner).',
      choices: [
        { value: 'sitOut', label: 'Geber setzt aus' },
        { value: 'kreuz', label: 'Kreuzbinokel (2 gegen 2)' },
      ],
      default: 'sitOut',
    },
    deckStyleOption(),
    {
      id: 'deckSize',
      label: 'Kartendeck',
      choices: [
        { value: '40', label: '40 Karten (ohne Siebener)' },
        { value: '48', label: '48 Karten (mit Siebenern / Dissle)' },
      ],
      default: '40',
    },
    {
      id: 'minBid',
      label: 'Mindestgebot',
      choices: [
        { value: '150', label: '150' },
        { value: '200', label: '200' },
        { value: '250', label: '250' },
        { value: '300', label: '300' },
      ],
      default: '150',
    },
    {
      id: 'targetScore',
      label: 'Gespielt wird bis',
      choices: [
        { value: '1000', label: '1000 Punkte' },
        { value: '1500', label: '1500 Punkte' },
      ],
      default: '1000',
    },
    {
      id: 'allowDurch',
      label: 'Durch ansagen',
      choices: [
        { value: 'true', label: 'Erlaubt' },
        { value: 'false', label: 'Nicht erlaubt' },
      ],
      default: 'true',
    },
    {
      id: 'foldCompensation',
      label: 'Wenn der Spielmacher abgeht',
      choices: [
        { value: 'fifty', label: 'Gegner bekommen je 50' },
        { value: 'half', label: 'Gegner bekommen je das halbe Gebot' },
        { value: 'none', label: 'Gegner bekommen nur ihre Meldungen' },
      ],
      default: 'fifty',
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
  bots: [binokelBot],
};
