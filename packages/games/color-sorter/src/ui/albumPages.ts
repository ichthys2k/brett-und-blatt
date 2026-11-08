import { BOSS_LIST, DECKS, DREAMS, NAILS, SPELLS, TOOLS } from '../content';
import { MODS } from '../mods';
import type { Rarity } from '../types';
import type { AlbumKind } from './progress';

/** Die Seiten der Hofchronik (Album des Narrenhofs): Einträge je Art. Auch das Sammelalbum des Passes (#148) liest sie. */
export const ALBUM_PAGES: {
  kind: AlbumKind;
  title: string;
  items: {
    key: string;
    emoji: string;
    name: string;
    text: string;
    tone?: string;
  }[];
}[] = [
  {
    kind: 'mod',
    title: 'Narren',
    items: (['common', 'uncommon', 'rare', 'legendary'] as Rarity[]).flatMap((rarity) =>
      Object.values(MODS)
        .filter((m) => m.rarity === rarity)
        .map((m) => ({
          key: m.key,
          emoji: m.emoji,
          name: m.name,
          text: m.text + (m.multi ? ' (nur zu mehreren)' : ''),
          tone: `cs-t-${rarity}`,
        })),
    ),
  },
  {
    kind: 'spell',
    title: 'Kunststücke',
    items: Object.entries(SPELLS).map(([key, d]) => ({
      key,
      emoji: d.emoji,
      name: d.name,
      text: d.text,
      tone: 'cs-t-spell',
    })),
  },
  {
    kind: 'nail',
    title: 'Übungen',
    items: Object.entries(NAILS).map(([key, d]) => ({
      key,
      emoji: d.emoji,
      name: d.name,
      text: '',
      tone: 'cs-t-nail',
    })),
  },
  {
    kind: 'dream',
    title: 'Kuriositäten',
    items: Object.entries(DREAMS).map(([key, d]) => ({
      key,
      emoji: d.emoji,
      name: d.name,
      text: d.text,
      tone: 'cs-t-dream',
    })),
  },
  {
    kind: 'tool',
    title: 'Privilegien',
    items: Object.values(TOOLS).map((d) => ({
      key: d.key,
      emoji: d.emoji,
      name: d.name,
      text: d.text,
      tone: 'cs-t-tool',
    })),
  },
  {
    kind: 'boss',
    title: 'Herrschaften',
    items: BOSS_LIST.map((d) => ({
      key: d.key,
      emoji: d.emoji,
      name: d.name,
      text: d.text,
    })),
  },
  {
    kind: 'deck',
    title: 'Narrenkappen',
    items: DECKS.map((d) => ({
      key: d.key,
      emoji: d.emoji,
      name: d.name,
      text: d.text,
    })),
  },
];
