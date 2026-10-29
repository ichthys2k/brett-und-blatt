import type { GameModule } from '@brett-und-blatt/engine';
import { symbolMatchBot } from './bots';
import { SYMBOL_SETS } from './deck';
import { meta } from './meta';
import { MODES, applyMove, currentPlayers, isLegal, legalMoves, playerView, result, sampleHidden, setup, type SymbolMatchMove, type SymbolMatchState, type SymbolMatchView } from './rules';

export type { SymbolMatchMove, SymbolMatchState, SymbolMatchView } from './rules';

export const gameModule: GameModule<SymbolMatchState, SymbolMatchMove, SymbolMatchView> = {
  info: meta,
  options: [
    {
      id: 'mode',
      label: 'Spielart',
      description: 'Allein gibt es nur den Turmbau (als Training).',
      choices: MODES,
      default: 'tower',
    },
    {
      id: 'order',
      label: 'Kartengröße',
      description: 'Mehr Symbole je Karte machen das Suchen schwerer.',
      choices: [
        { value: '3', label: 'Klein: 4 Symbole, 13 Karten' },
        { value: '5', label: 'Mittel: 6 Symbole, 31 Karten' },
        { value: '7', label: 'Groß: 8 Symbole, 57 Karten' },
      ],
      default: '5',
    },
    { id: 'symbols', label: 'Symbole', choices: SYMBOL_SETS, default: 'emoji' },
    {
      id: 'calm',
      label: 'Ruhige Karten',
      description: 'Alle Symbole gleich groß und gerade – leichter für jüngere Kinder.',
      choices: [
        { value: 'off', label: 'Aus' },
        { value: 'on', label: 'An' },
      ],
      default: 'off',
    },
  ],
  // Echtzeit: Die Uhr misst nur, wie lange jemand gar nichts tut – dann hilft der Bot aus.
  timePresets: {
    relaxed: { kind: 'none' },
    normal: { kind: 'perMove', moveMs: 60_000 },
    fast: { kind: 'perMove', moveMs: 30_000 },
  },
  setup,
  currentPlayers,
  legalMoves,
  isLegal,
  applyMove,
  playerView,
  result,
  sampleHidden,
  bots: [symbolMatchBot],
};
