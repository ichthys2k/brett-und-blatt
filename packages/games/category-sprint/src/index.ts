import { loadCatalog, type GameModule, type PrepareContext } from '@brett-und-blatt/engine';
import { sprintBot } from './bots';
import { hasSprintCatalog, parseSprintCatalog, setSprintCatalog } from './catalog';
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
  type SprintMove,
  type SprintState,
} from './rules';

export { meta } from './meta';
export * from './catalog';
export * from './rules';
export { sprintBot } from './bots';

/** Pfad der Wortlisten auf dem Spieleserver und die mitgelieferte Rückfalldatei. */
export const KATALOG = { serverPath: '/wortspiele/kategorien', file: 'wortspiele/kategorien.json', label: 'Kategorien-Sprint' };

export async function prepare(context: PrepareContext): Promise<void> {
  if (hasSprintCatalog()) return;
  setSprintCatalog(parseSprintCatalog(await loadCatalog(context, KATALOG)));
}

export const gameModule: GameModule<SprintState, SprintMove> = {
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
  bots: [sprintBot],
};
