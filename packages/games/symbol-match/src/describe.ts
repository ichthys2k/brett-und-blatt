/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import { symbolText } from './deck';
import type { SymbolMatchMove, SymbolMatchView } from './rules';

export function describeMove(view: SymbolMatchView, move: SymbolMatchMove): string {
  return `${symbolText(view.options.symbols, move.symbol, move.center)} auf Platz ${move.target + 1}`;
}
