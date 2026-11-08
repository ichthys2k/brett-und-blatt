import type { AlbumSpec } from '@brett-und-blatt/ui';
import { CARD_SETS, SET_IDS, groupOf } from '../sets';
import type { QuartettState } from '../rules';

/**
 * Kapitel „Quartett“ im Sammelalbum des Passes (#148): jede Karte, die man in einem **gewonnenen** Spiel besaß, je Kartensatz.
 * Beim Trumpfspiel zählen die Karten des eigenen Stapels, beim Sammeln die Hand und alle Karten abgelegter Quartette.
 */
export const albumSpec: AlbumSpec<QuartettState> = {
  title: 'Quartett',
  catalog: () => SET_IDS.flatMap((setId) => CARD_SETS[setId]!.cards.map((card) => ({ id: `${setId}:${card.id}`, label: card.name, group: CARD_SETS[setId]!.name, icon: card.emoji }))),
  finds: ({ view, seat, result }) => {
    if (!result || result.kind !== 'win' || !result.winners.includes(seat)) return [];
    const set = CARD_SETS[view.set];
    if (!set) return [];
    const own = new Set<string>();
    for (const card of view.hands[seat] ?? []) if (card) own.add(card);
    for (const entry of view.stacks[seat] ?? []) if (entry?.card) own.add(entry.card);
    for (const quartet of view.quartets) if (quartet.seat === seat) for (const card of set.cards) if (groupOf(card.id) === quartet.group) own.add(card.id);
    return [...own].filter((id) => set.cards.some((card) => card.id === id)).map((id) => `${set.id}:${id}`);
  },
};
