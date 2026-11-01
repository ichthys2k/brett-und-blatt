import { CARDS_DB } from './cards';
import { BOARD_LIMIT } from './core/effects';
import { effectsText } from './core/text';
import type { DeckThemeId, Effect, HousePower } from './types';

function power(id: DeckThemeId, name: string, emoji: string, effects: Effect[]): HousePower {
  return { id, name, emoji, cost: 2, effects, text: effectsText(effects, 'none', CARDS_DB) };
}

/** Die Hauskräfte der fünf Häuser. Namen und Werte sind Startwerte, siehe Ausbauplan Kapitel 7.4. */
export const HOUSE_POWERS: Record<DeckThemeId, HousePower> = {
  forest: power('forest', 'Eichenkraft', '🌰', [{ kind: 'heroAttack', amount: 1 }, { kind: 'armor', amount: 1 }]),
  sea: power('sea', 'Gezeitenruf', '🐚', [{ kind: 'summonRandom', cardIds: ['token_mussel', 'token_shrimp', 'token_seahorse'] }]),
  farm: power('farm', 'Kükenruf', '🐥', [{ kind: 'summon', cardId: 'token_chick' }]),
  wild: power('wild', 'Dickes Fell', '🦏', [{ kind: 'armor', amount: 2 }]),
  bugs: power('bugs', 'Kleiner Stachel', '🐝', [{ kind: 'equip', gear: { name: 'Kleiner Stachel', emoji: '🐝', attack: 1, durability: 2 } }]),
};

/** Eine Kraft, die ein Tier ruft, geht nicht bei vollem Feld. */
export function powerIsUsable(power: HousePower, boardSize: number): boolean {
  return boardSize < BOARD_LIMIT || !power.effects.some((effect) => effect.kind === 'summon' || effect.kind === 'summonRandom');
}
