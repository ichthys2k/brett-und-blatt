import type { GameModule } from '@brett-und-blatt/engine';
import { bots, wordSaladBot } from './bots';
import { meta } from './meta';
import {
  applyMove,
  currentPlayers,
  isLegal,
  legalMoves,
  playerView,
  result,
  setup,
  type FoundWordEntry,
  type RoundSummary,
  type SaladMode,
  type SaladPlayerState,
  type WordSaladMove,
  type WordSaladState,
} from './rules';
import {
  STEM_CATALOG,
  canFormFromStem,
  getValidSubwords,
  normalizeSaladWord,
  scoreWordLength,
  type SaladCategory,
  type StemEntry,
} from './words';

export {
  STEM_CATALOG,
  applyMove,
  bots,
  canFormFromStem,
  currentPlayers,
  getValidSubwords,
  isLegal,
  legalMoves,
  meta,
  normalizeSaladWord,
  playerView,
  result,
  scoreWordLength,
  setup,
  wordSaladBot,
  type FoundWordEntry,
  type RoundSummary,
  type SaladCategory,
  type SaladMode,
  type SaladPlayerState,
  type StemEntry,
  type WordSaladMove,
  type WordSaladState,
};

export const gameModule: GameModule<WordSaladState, WordSaladMove> = {
  info: meta,
  options: [
    {
      id: 'mode',
      label: 'Spielmodus',
      choices: [
        { value: 'classic', label: '🥗 Wörterjagd (jedes Wort zählt nach Länge)' },
        { value: 'unique', label: '⭐ Exklusiv-Bonus (einzigartige Funde zählen doppelt)' },
      ],
      default: 'classic',
    },
    {
      id: 'category',
      label: 'Stammwort-Paket',
      choices: [
        { value: 'mix', label: '🎲 Bunter Mix (Alltag, Schule & Freizeit)' },
        { value: 'natur', label: '🌿 Natur, Tiere & Jahreszeiten' },
        { value: 'mathe', label: '📐 Mathe & Geometrie (Kl. 5/6)' },
      ],
      default: 'mix',
    },
    {
      id: 'rounds',
      label: 'Runden (Stammwörter)',
      choices: [
        { value: '1', label: '1 Stammwort (Schnellrunde)' },
        { value: '3', label: '3 Stammwörter (Standard)' },
        { value: '5', label: '5 Stammwörter (Turnier)' },
      ],
      default: '3',
    },
    {
      id: 'minLength',
      label: 'Mindestwortlänge',
      choices: [
        { value: '3', label: 'Ab 3 Buchstaben (Standard)' },
        { value: '4', label: 'Ab 4 Buchstaben (Knifflig)' },
      ],
      default: '3',
    },
  ],
  timePresets: {
    relaxed: { kind: 'none' },
    normal: { kind: 'perMove', moveMs: 60_000, bankMs: 60_000 },
    fast: { kind: 'perMove', moveMs: 35_000, bankMs: 35_000 },
  },
  setup,
  currentPlayers,
  legalMoves,
  isLegal,
  applyMove,
  playerView,
  result,
  bots: [wordSaladBot],
};
