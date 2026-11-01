import { loadCatalog, type GameModule, type PrepareContext } from '@brett-und-blatt/engine';
import { whoBot } from './bots';
import { hasWhoCatalog, parseWhoCatalog, setWhoCatalog } from './catalog';
import { meta } from './meta';
import {
  applyMove,
  currentPlayers,
  isLegal,
  legalMoves,
  options,
  playerView,
  result,
  sampleHidden,
  setup,
  timeoutMove,
  timePresets,
  type WhoMove,
  type WhoState,
} from './rules';

export { meta } from './meta';
export * from './catalog';
export * from './rules';
export { whoBot } from './bots';

export const KATALOG = { serverPath: '/wortspiele/wer-bin-ich', file: 'wortspiele/wer-bin-ich.json', label: 'Wer bin ich?' };

export async function prepare(context: PrepareContext): Promise<void> {
  if (hasWhoCatalog()) return;
  setWhoCatalog(parseWhoCatalog(await loadCatalog(context, KATALOG)));
}

export const gameModule: GameModule<WhoState, WhoMove> = {
  info: meta,
  options,
  timePresets,
  prepare,
  setup,
  currentPlayers,
  legalMoves,
  isLegal,
  applyMove,
  playerView,
  sampleHidden,
  timeoutMove,
  result,
  bots: [whoBot],
};
