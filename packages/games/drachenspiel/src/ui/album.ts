import type { AlbumSpec } from '@brett-und-blatt/ui';
import { ALL_CARD_IDS, ALL_SPELL_IDS, CARDS_DB, SPELLS_DB } from '../cards';
import type { DrachenspielView } from '../types';

/**
 * Kapitel „Drachenspiel“ im Sammelalbum des Passes (#148): Karten, mit denen man eine Partie **gewonnen** hat
 * (eigene Hand und eigenes Feld am Ende, dazu das eigene Deck bei selbst gebauten Decks).
 */
export const albumSpec: AlbumSpec<DrachenspielView> = {
  title: 'Drachenspiel',
  catalog: () => [
    ...ALL_CARD_IDS.map((id) => ({ id, label: CARDS_DB[id]!.name, group: 'Tiere', icon: CARDS_DB[id]!.emoji })),
    ...ALL_SPELL_IDS.map((id) => ({ id, label: SPELLS_DB[id]!.name, group: 'Zauber', icon: SPELLS_DB[id]!.emoji })),
  ],
  finds: ({ view, seat, result }) => {
    if (!result || result.kind !== 'win' || !result.winners.includes(seat)) return [];
    const me = view.players[seat];
    if (!me) return [];
    const known = new Set<string>([...ALL_CARD_IDS, ...ALL_SPELL_IDS]);
    const ids = new Set<string>();
    for (const card of me.hand ?? []) ids.add(card.defId);
    for (const minion of me.board) ids.add(minion.cardId);
    return [...ids].filter((id) => known.has(id));
  },
};
