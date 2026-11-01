import { loadCatalog, type GameModule, type PrepareContext } from '@brett-und-blatt/engine';
import { duelBot } from './bots';
import { hasDuelCatalog, parseDuelCatalog, setDuelCatalog } from './catalog';
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
  type DuelMove,
  type DuelState,
} from './rules';

export { meta } from './meta';
export * from './catalog';
export * from './rules';
export { duelBot } from './bots';

export const KATALOG = { serverPath: '/wortspiele/begriffe', file: 'wortspiele/begriffe.json', label: 'Verboten!' };

export async function prepare(context: PrepareContext): Promise<void> {
  if (hasDuelCatalog()) return;
  setDuelCatalog(parseDuelCatalog(await loadCatalog(context, KATALOG)));
}

export const gameModule: GameModule<DuelState, DuelMove> = {
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
  bots: [duelBot],
};
