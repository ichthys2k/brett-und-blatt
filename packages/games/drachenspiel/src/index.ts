import { drachenspiel } from './rules';

export { drachenspiel as gameModule, drachenspiel } from './rules';
export { meta } from './meta';
export { CARDS_DB, ALL_CARD_IDS, STAR_CARD } from './cards';
export { DECK_THEMES, DECK_THEME_IDS } from './decks';
export type {
  DrachenspielState,
  DrachenspielMove,
  DrachenspielView,
  Minion,
  CardInstance,
  CardDefinition,
  DeckThemeId,
  Phase,
} from './types';
