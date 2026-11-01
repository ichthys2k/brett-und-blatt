import { CARDS_DB } from './cards';
import { DECK_THEME_IDS } from './decks';
import type { CardDefinition, DeckThemeId } from './types';

/**
 * Eigene Decks (Phase 8): Regeln und Deck-Code, ohne Oberfläche. Auch der Server prüft hiermit,
 * denn die Spielregeln nehmen ein Deck nur nach dieser Prüfung an.
 */
export const DECK_SIZE = 30;
export const MAX_COPIES = 2;
/** Ein voller Code ist kürzer, mehr nimmt niemand an. */
export const DECK_CODE_MAX = 600;
export const DECK_CODE_PATTERN = '[a-z]+:[a-z0-9_*,]+';

export interface BuiltDeck {
  house: DeckThemeId;
  cardIds: string[];
}

const copiesAllowed = (def: CardDefinition) => (def.rarity === 'mythic' || def.singleCopy ? 1 : MAX_COPIES);

/** Alle Karten, die in ein Deck dieses Hauses dürfen: eigene und neutrale. */
export function buildableCards(house: DeckThemeId): CardDefinition[] {
  return Object.values(CARDS_DB)
    .filter((def) => !def.token && def.id !== 'special_star' && (def.house === house || def.house === 'neutral'))
    .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name, 'de'));
}

/** Was an einem Deck noch nicht stimmt, in Worten für die Oberfläche. Leer: spielbar. */
export function deckProblems(house: DeckThemeId, cardIds: string[]): string[] {
  const problems: string[] = [];
  if (cardIds.length !== DECK_SIZE) problems.push(`Das Deck hat ${cardIds.length} statt ${DECK_SIZE} Karten.`);
  const counts = new Map<string, number>();
  for (const id of cardIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const [id, count] of counts) {
    const def = CARDS_DB[id];
    if (!def || def.token || id === 'special_star') problems.push(`Die Karte „${id}“ gibt es nicht im Deckbau.`);
    else if (def.house !== house && def.house !== 'neutral') problems.push(`${def.name} gehört zu einem anderen Haus.`);
    else if (count > copiesAllowed(def)) problems.push(`${def.name} darf höchstens ${copiesAllowed(def)}-mal ins Deck.`);
  }
  return problems;
}

export function encodeDeck(house: DeckThemeId, cardIds: string[]): string {
  const counts = new Map<string, number>();
  for (const id of cardIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  const parts = [...counts.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([id, count]) => (count > 1 ? `${id}*${count}` : id));
  return `${house}:${parts.join(',')}`;
}

/** Liest einen Code und prüft nur die Form; ob das Deck erlaubt ist, sagt `parseDeckCode`. */
export function decodeDeck(input: string): BuiltDeck | null {
  const code = input.trim();
  if (code.length > DECK_CODE_MAX || !new RegExp(`^${DECK_CODE_PATTERN}$`).test(code)) return null;
  const [house, list] = code.split(':') as [DeckThemeId, string];
  if (!DECK_THEME_IDS.includes(house)) return null;
  const cardIds: string[] = [];
  for (const part of list.split(',')) {
    const [id, count] = part.split('*');
    const times = count === undefined ? 1 : Number(count);
    if (!id || !Number.isInteger(times) || times < 1 || times > DECK_SIZE) return null;
    for (let i = 0; i < times; i++) cardIds.push(id);
  }
  return { house, cardIds };
}

/** Ein spielbares Deck aus dem Code oder `null`. */
export function parseDeckCode(input: string): BuiltDeck | null {
  const deck = decodeDeck(input);
  return deck && deckProblems(deck.house, deck.cardIds).length === 0 ? deck : null;
}

/** Füllt ein angefangenes Deck auf: billige, mittlere und teure Karten in vernünftiger Mischung. `pick` lost aus. */
export function fillDeck(house: DeckThemeId, cardIds: string[], pick: (size: number) => number): string[] {
  const deck = [...cardIds];
  const bucket = (cost: number) => (cost <= 2 ? 0 : cost <= 4 ? 1 : 2);
  const goal = [13, 11, 6];
  while (deck.length < DECK_SIZE) {
    const have = [0, 0, 0];
    for (const id of deck) have[bucket(CARDS_DB[id]?.cost ?? 0)]!++;
    const open = buildableCards(house).filter((def) => deck.filter((id) => id === def.id).length < copiesAllowed(def) && !def.quest && def.rarity !== 'mythic');
    const wanted = open.filter((def) => have[bucket(def.cost)]! < goal[bucket(def.cost)]!);
    const pool = wanted.length > 0 ? wanted : open;
    deck.push(pool[pick(pool.length)]!.id);
  }
  return deck;
}

export interface PresetDeck {
  name: string;
  house: DeckThemeId;
  description: string;
  code: string;
}

const preset = (name: string, house: DeckThemeId, description: string, pairs: string[]): PresetDeck => ({
  name,
  house,
  description,
  code: encodeDeck(house, pairs.flatMap((id) => [id, id])),
});

/** Einfach zu spielende Vorschläge für den Einstieg und als Grundlage zum Umbauen. */
export const PRESET_DECKS: PresetDeck[] = [
  preset('Waldfreunde', 'forest', 'Viele solide Tiere, wenig zu merken.', ['f_jay', 'f_dormouse', 'f_lynx', 'f_woodpecker', 'f_badger', 'c7', 'c21', 'c23', 'c25', 'f_wolf', 'f_boar', 'c28', 'f_nymph', 'f_bear', 'c40']),
  preset('Küstenwache', 'sea', 'Zähe Beschützer halten den Gegner auf.', ['sea_starfish', 'sea_seal', 'sea_sardine', 'c15', 'sea_penguin', 'sea_hermit', 'sea_dolphin', 'sea_turtle', 'sea_gull', 'c32', 'sea_walrus', 'sea_manta', 'sea_shark', 'sea_orca', 's_flood']),
  preset('Bunter Hof', 'farm', 'Viele kleine Tiere, die zusammenhalten.', ['farm_fieldmouse', 'farm_duck', 'farm_lamb', 'farm_goose', 'farm_cat', 'farm_donkey', 'c29', 'c22', 'farm_cow', 'c35', 'c36', 'farm_bull', 'farm_coldblood', 'farm_march', 's_growth']),
  preset('Steppenzug', 'wild', 'Rüstung sammeln und kräftig zuschlagen.', ['wild_meerkat', 'wild_warthog', 'wild_hyena', 'wild_lioncub', 'wild_gazelle', 'wild_ostrich', 'wild_armadillo', 'wild_buffalo', 'wild_lioness', 'wild_cheetah', 'c43', 'wild_gorilla', 'wild_croc', 'c47', 'wild_shield']),
  preset('Flinker Schwarm', 'bugs', 'Billig, viel und schnell auf dem Feld.', ['c1', 'bug_ladybug', 'bug_bee', 'c4', 'c5', 'bug_wasp', 'bug_centipede', 'bug_dragonfly', 'c12', 'bug_stagbeetle', 'bug_tarantula', 'bug_hornet', 'bug_queen', 'bug_motherspider', 'bug_swarm']),
];
