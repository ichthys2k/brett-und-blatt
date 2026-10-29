import { DECKS, TOOLS } from './content';
import { MODS } from './mods';
import type { Rarity } from './types';

/**
 * Freischaltungen in der Narrenschule (intern „Atelier“, bezahlt mit Glöckchen 🔔, intern „drops“). Sie gelten je Gerät und erweitern den Zufallspool
 * für Mods, Werkzeuge und Kartensätze; Kartenrücken und Tisch-Themen sind reiner Schmuck.
 * Die Reihenfolge der Liste ist Teil des Speicherformats: nur hinten anfügen.
 */

export type UnlockKind = 'mod' | 'deck' | 'tool' | 'back' | 'theme';

export interface Unlockable {
  /** z. B. „mod:twins“ */
  id: string;
  kind: UnlockKind;
  key: string;
  price: number;
}

export interface CosmeticDef {
  key: string;
  name: string;
  emoji: string;
  text: string;
}

/** Kartenrücken – der erste ist immer da. */
export const CARD_BACKS: CosmeticDef[] = [
  {
    key: 'classic',
    name: 'Harlekin',
    emoji: '🃏',
    text: 'Der Standard-Rücken',
  },
  { key: 'wave', name: 'Welle', emoji: '🌊', text: 'Blaugrüne Wellen' },
  { key: 'bloom', name: 'Blüten', emoji: '🌸', text: 'Rosa Blütenmuster' },
  { key: 'space', name: 'Weltall', emoji: '🚀', text: 'Sterne auf Nachtblau' },
  { key: 'candy', name: 'Bonbon', emoji: '🍬', text: 'Bunte Streifen' },
  {
    key: 'night',
    name: 'Nachtfalter',
    emoji: '🌙',
    text: 'Dunkel mit Mondsichel',
  },
];

/** Tisch-Themen – das erste ist immer da. */
export const THEMES: CosmeticDef[] = [
  {
    key: 'workshop',
    name: 'Thronsaal',
    emoji: '🏰',
    text: 'Der Standard-Tisch',
  },
  { key: 'forest', name: 'Wald', emoji: '🌲', text: 'Grüner Tisch mit Moos' },
  { key: 'sea', name: 'Meer', emoji: '🐚', text: 'Türkis wie eine Lagune' },
  {
    key: 'sunset',
    name: 'Abendrot',
    emoji: '🌅',
    text: 'Warme Farben zum Abend',
  },
];

const LOCKED_MODS = ['twins', 'santaFan', 'family', 'tree', 'king', 'unicorn', 'painter', 'snail', 'echo', 'broccoli', 'apple', 'robot', 'santaClaus', 'herald', 'collector', 'kidFan', 'monkey'];
const LOCKED_DECKS = ['yellow', 'green', 'black', 'magic'];
const LOCKED_TOOLS = ['courtHerald', 'diploma', 'breadRight', 'touringStage', 'shelf', 'basket', 'book', 'scope'];

export const MOD_PRICES: Record<Rarity, number> = {
  common: 4,
  uncommon: 6,
  rare: 10,
  legendary: 20,
};
export const DECK_PRICE = 8;
export const TOOL_UNLOCK_PRICE = 6;
export const BACK_PRICE = 5;
export const THEME_PRICE = 8;
/** Atelier-Lieferung: eine zufällige, noch nicht freigeschaltete Sache. */
export const ATELIER_BOX_PRICE = 5;

export const UNLOCKABLES: Unlockable[] = [
  ...LOCKED_MODS.map(
    (key): Unlockable => ({
      id: `mod:${key}`,
      kind: 'mod',
      key,
      price: MOD_PRICES[MODS[key]!.rarity],
    }),
  ),
  ...LOCKED_DECKS.map(
    (key): Unlockable => ({
      id: `deck:${key}`,
      kind: 'deck',
      key,
      price: DECK_PRICE,
    }),
  ),
  ...LOCKED_TOOLS.map(
    (key): Unlockable => ({
      id: `tool:${key}`,
      kind: 'tool',
      key,
      price: TOOL_UNLOCK_PRICE,
    }),
  ),
  ...CARD_BACKS.slice(1).map(
    (c): Unlockable => ({
      id: `back:${c.key}`,
      kind: 'back',
      key: c.key,
      price: BACK_PRICE,
    }),
  ),
  ...THEMES.slice(1).map(
    (c): Unlockable => ({
      id: `theme:${c.key}`,
      kind: 'theme',
      key: c.key,
      price: THEME_PRICE,
    }),
  ),
];

export const UNLOCKABLE_BY_ID: Record<string, Unlockable> = Object.fromEntries(UNLOCKABLES.map((u) => [u.id, u]));

/** Was den Spielablauf verändert (und deshalb online für alle gleich sein muss). */
export const isGameplayUnlock = (u: Unlockable) => u.kind === 'mod' || u.kind === 'deck' || u.kind === 'tool';

/** Freischaltungen als kurze Hex-Zeichenkette (ein Bit je Eintrag), für die verborgene Option. */
export function encodeUnlocks(ids: Iterable<string>): string {
  const set = new Set(ids);
  const bits = UNLOCKABLES.map((u) => set.has(u.id) && isGameplayUnlock(u));
  let out = '';
  for (let i = 0; i < bits.length; i += 4) {
    const nibble = (bits[i] ? 8 : 0) | (bits[i + 1] ? 4 : 0) | (bits[i + 2] ? 2 : 0) | (bits[i + 3] ? 1 : 0);
    out += nibble.toString(16);
  }
  return out.replace(/0+$/, '');
}

export function decodeUnlocks(code: string): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < code.length; i++) {
    const nibble = parseInt(code[i]!, 16);
    if (Number.isNaN(nibble)) continue;
    for (let b = 0; b < 4; b++) {
      const unlock = UNLOCKABLES[i * 4 + b];
      if (unlock && nibble & (8 >> b)) out.add(unlock.id);
    }
  }
  return out;
}

export type PoolChoice = 'mine' | 'base' | 'all';

/** Gesperrte Spielinhalte (Kennungen wie „mod:twins“) für die Partie. */
export function lockedFor(pool: PoolChoice, unlocked: Set<string>): string[] {
  if (pool === 'all') return [];
  return UNLOCKABLES.filter((u) => isGameplayUnlock(u) && !(pool === 'mine' && unlocked.has(u.id))).map((u) => u.id);
}

/** Name und Emoji einer Freischaltung für die Anzeige. */
export function unlockLabel(u: Unlockable): { emoji: string; name: string } {
  if (u.kind === 'mod') return { emoji: MODS[u.key]!.emoji, name: MODS[u.key]!.name };
  if (u.kind === 'deck') {
    const deck = DECKS.find((d) => d.key === u.key)!;
    return { emoji: deck.emoji, name: deck.name };
  }
  if (u.kind === 'tool') return { emoji: TOOLS[u.key]!.emoji, name: TOOLS[u.key]!.name };
  const list = u.kind === 'back' ? CARD_BACKS : THEMES;
  const def = list.find((c) => c.key === u.key)!;
  return { emoji: def.emoji, name: def.name };
}

export const UNLOCK_KIND_NAMES: Record<UnlockKind, string> = {
  mod: 'Narren',
  deck: 'Narrenkappen',
  tool: 'Privilegien',
  back: 'Kartenrücken',
  theme: 'Tisch-Themen',
};

/** Quoten der Atelier-Lieferung: jede noch gesperrte Sache gleich wahrscheinlich – nach Art zusammengefasst. */
export function boxOdds(unlocked: Set<string>): { kind: UnlockKind; count: number; percent: number }[] {
  const open = UNLOCKABLES.filter((u) => !unlocked.has(u.id));
  const kinds: UnlockKind[] = ['mod', 'deck', 'tool', 'back', 'theme'];
  return kinds
    .map((kind) => {
      const count = open.filter((u) => u.kind === kind).length;
      return {
        kind,
        count,
        percent: open.length ? Math.round((count / open.length) * 1000) / 10 : 0,
      };
    })
    .filter((o) => o.count > 0);
}

/** Inhalt einer Atelier-Lieferung: nie eine Dublette. `random` liefert eine Zahl in [0, 1). */
export function openAtelierBox(unlocked: Set<string>, random: () => number): Unlockable | null {
  const open = UNLOCKABLES.filter((u) => !unlocked.has(u.id));
  if (open.length === 0) return null;
  return open[Math.min(open.length - 1, Math.floor(random() * open.length))]!;
}
