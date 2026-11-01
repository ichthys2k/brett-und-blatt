import { Rng } from '@brett-und-blatt/engine';
import { CARDS_DB } from '../cards';
import { buildableCards, DECK_SIZE, decodeDeck, encodeDeck, PRESET_DECKS } from '../deckcode';
import { DECK_THEME_IDS } from '../decks';
import type { DeckThemeId } from '../types';
import { LESSONS, RUN_FOES, TREASURES, type Treasure } from './scenarios';

/** Fortschritt der Solo-Modi als reine Daten: Lauf, Turnier, Turnierbuch. Nichts hier ist zufällig gekauft oder belohnt. */
export interface RunState {
  seed: string;
  house: DeckThemeId;
  cards: string[];
  treasures: string[];
  /** Nächster Gegner (0–7). */
  fight: number;
  /** Nach einem Sieg: erst Beute wählen. */
  awaitingLoot: boolean;
  over: 'won' | 'lost' | null;
}

export interface ArenaState {
  seed: string;
  house: DeckThemeId | null;
  cards: string[];
  wins: number;
  losses: number;
}

export interface Stats {
  wins: number;
  winsByHouse: Partial<Record<DeckThemeId, number>>;
  customWins: number;
  bestRunFight: number;
  runsWon: number;
  bestArena: number;
}

export interface Book {
  stats: Stats;
  lessons: string[];
  run: RunState | null;
  arena: ArenaState | null;
  /** Schon gezählte Partien, damit Neuladen nichts doppelt zählt. */
  plays: string[];
  frame: string | null;
  crest: string | null;
  updatedAt: number;
}

export const emptyBook = (): Book => ({
  stats: { wins: 0, winsByHouse: {}, customWins: 0, bestRunFight: 0, runsWon: 0, bestArena: 0 },
  lessons: [],
  run: null,
  arena: null,
  plays: [],
  frame: null,
  crest: null,
  updatedAt: 0,
});

const MAX_PLAYS = 60;

// ---------------------------------------------------------------- Wanderschaft

/** Beginnt mit 15 einfachen Karten des Hauses; das Deck wächst mit jedem Sieg. */
export function startRun(house: DeckThemeId, seed: string): RunState {
  const preset = PRESET_DECKS.find((deck) => deck.house === house)!;
  const cards = decodeDeck(preset.code)!.cardIds.filter((_, index) => index % 2 === 0).concat(decodeDeck(preset.code)!.cardIds[1]!).slice(0, 15);
  return { seed, house, cards, treasures: [], fight: 0, awaitingLoot: false, over: null };
}

/** Drei Kartenbündel zur Wahl; fest aus Lauf und Kampf, Neuladen würfelt nichts neu. */
export function lootOffer(run: RunState): string[][] {
  const rng = Rng.fromSeed(`${run.seed}/beute/${run.fight}`);
  const pool = buildableCards(run.house).filter((def) => !def.quest && !def.trap);
  const shuffled = rng.shuffle(pool.map((def) => def.id));
  return [shuffled.slice(0, 3), shuffled.slice(3, 6), shuffled.slice(6, 9)];
}

/** Nach dem zweiten und fünften Sieg kommt ein Schatz dazu. */
export function treasureOffer(run: RunState): Treasure[] {
  if (run.fight !== 2 && run.fight !== 5) return [];
  const rng = Rng.fromSeed(`${run.seed}/schatz/${run.fight}`);
  return rng.shuffle(TREASURES.filter((treasure) => !run.treasures.includes(treasure.id))).slice(0, 3);
}

export function takeLoot(run: RunState, bundle: number, treasure: string | null): RunState {
  const cards = lootOffer(run)[bundle];
  if (!run.awaitingLoot || !cards) return run;
  return { ...run, awaitingLoot: false, cards: [...run.cards, ...cards], treasures: treasure ? [...run.treasures, treasure] : run.treasures };
}

export const runDeckCode = (run: RunState) => encodeDeck(run.house, run.cards);

// ---------------------------------------------------------------- Turnier

export const startArena = (seed: string): ArenaState => ({ seed, house: null, cards: [], wins: 0, losses: 0 });
export const ARENA_WINS = 5;
export const ARENA_LOSSES = 2;

export function arenaHouses(arena: ArenaState): DeckThemeId[] {
  return Rng.fromSeed(`${arena.seed}/haeuser`).shuffle([...DECK_THEME_IDS]).slice(0, 3);
}

/** Drei Karten zur Wahl; was schon voll im Deck ist, kommt nicht mehr. */
export function arenaOffer(arena: ArenaState): string[] {
  if (!arena.house || arena.cards.length >= DECK_SIZE) return [];
  const rng = Rng.fromSeed(`${arena.seed}/wahl/${arena.cards.length}`);
  const open = buildableCards(arena.house).filter((def) => !def.quest && arena.cards.filter((id) => id === def.id).length < (def.rarity === 'mythic' ? 1 : 2));
  return rng.shuffle(open.map((def) => def.id)).slice(0, 3);
}

export const arenaOver = (arena: ArenaState) => arena.wins >= ARENA_WINS || arena.losses >= ARENA_LOSSES;

export function arenaFoe(arena: ArenaState): DeckThemeId {
  return Rng.fromSeed(`${arena.seed}/gegner/${arena.wins + arena.losses}`).pick(DECK_THEME_IDS);
}

// ---------------------------------------------------------------- Ergebnis einer Partie

export interface PlayResult {
  playId: string;
  scenario: string;
  won: boolean;
  house: DeckThemeId | null;
  custom: boolean;
  now: number;
}

/** Zählt eine beendete Partie. Dieselbe `playId` zählt nur einmal. */
export function recordPlay(book: Book, result: PlayResult): Book {
  if (book.plays.includes(result.playId)) return book;
  const next: Book = { ...book, stats: { ...book.stats, winsByHouse: { ...book.stats.winsByHouse } }, plays: [...book.plays, result.playId].slice(-MAX_PLAYS), updatedAt: result.now };
  if (result.won) {
    next.stats.wins++;
    if (result.house) next.stats.winsByHouse[result.house] = (next.stats.winsByHouse[result.house] ?? 0) + 1;
    if (result.custom) next.stats.customWins++;
  }
  const [kind, a] = result.scenario.split('-');
  if (kind === 'lesson' && result.won && a && !next.lessons.includes(a)) next.lessons = [...next.lessons, a];
  if (kind === 'run' && next.run && !next.run.over && Number(a) === next.run.fight && !next.run.awaitingLoot) {
    if (!result.won) next.run = { ...next.run, over: 'lost' };
    else if (next.run.fight === RUN_FOES.length - 1) {
      next.run = { ...next.run, over: 'won', fight: RUN_FOES.length };
      next.stats.runsWon++;
      next.stats.bestRunFight = RUN_FOES.length;
    } else {
      next.run = { ...next.run, fight: next.run.fight + 1, awaitingLoot: true };
      next.stats.bestRunFight = Math.max(next.stats.bestRunFight, next.run.fight);
    }
  }
  if (kind === 'arena' && next.arena && !arenaOver(next.arena)) {
    next.arena = { ...next.arena, wins: next.arena.wins + (result.won ? 1 : 0), losses: next.arena.losses + (result.won ? 0 : 1) };
    next.stats.bestArena = Math.max(next.stats.bestArena, next.arena.wins);
  }
  return next;
}

// ---------------------------------------------------------------- Turnierbuch

export interface BookTask {
  id: string;
  text: string;
  /** Fortschritt und Ziel. */
  progress(book: Book): [number, number];
  reward: { kind: 'frame' | 'crest'; id: string; name: string; emoji: string };
}

const housesWon = (book: Book) => DECK_THEME_IDS.filter((house) => (book.stats.winsByHouse[house] ?? 0) > 0).length;

/** Feste Reihenfolge, nie zufällig. Belohnung sind nur Kartenrahmen und Wappen. */
export const BOOK_TASKS: BookTask[] = [
  { id: 'schueler', text: 'Schließe den Übungsweg ab', progress: (b) => [b.lessons.length, LESSONS.length], reward: { kind: 'crest', id: 'schild', name: 'Knappenschild', emoji: '🛡️' } },
  { id: 'erster', text: 'Gewinne 3 Partien', progress: (b) => [b.stats.wins, 3], reward: { kind: 'frame', id: 'holz', name: 'Holzrahmen', emoji: '🪵' } },
  { id: 'baumeister', text: 'Gewinne mit einem eigenen Deck', progress: (b) => [b.stats.customWins, 1], reward: { kind: 'crest', id: 'hammer', name: 'Baumeister', emoji: '🔨' } },
  { id: 'haeuser', text: 'Gewinne mit jedem Haus', progress: (b) => [housesWon(b), DECK_THEME_IDS.length], reward: { kind: 'frame', id: 'silber', name: 'Silberrahmen', emoji: '🥈' } },
  { id: 'wanderer', text: 'Komme in der Wanderschaft bis zum vierten Gegner', progress: (b) => [b.stats.bestRunFight, 3], reward: { kind: 'crest', id: 'stiefel', name: 'Wanderstiefel', emoji: '🥾' } },
  { id: 'turnier', text: 'Erreiche 3 Siege in einem Turnier', progress: (b) => [b.stats.bestArena, 3], reward: { kind: 'crest', id: 'lanze', name: 'Turnierlanze', emoji: '🏇' } },
  { id: 'veteran', text: 'Gewinne 25 Partien', progress: (b) => [b.stats.wins, 25], reward: { kind: 'frame', id: 'gold', name: 'Goldrahmen', emoji: '🥇' } },
  { id: 'koenig', text: 'Besiege König Nobel', progress: (b) => [b.stats.runsWon, 1], reward: { kind: 'crest', id: 'krone', name: 'Krone', emoji: '👑' } },
];

export const taskDone = (task: BookTask, book: Book) => {
  const [have, need] = task.progress(book);
  return have >= need;
};

export function unlockedRewards(book: Book): BookTask['reward'][] {
  return BOOK_TASKS.filter((task) => taskDone(task, book)).map((task) => task.reward);
}

// ---------------------------------------------------------------- Sicherung

const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0);
const isHouse = (value: unknown): value is DeckThemeId => DECK_THEME_IDS.includes(value as DeckThemeId);
const realCards = (value: unknown) => (Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && Boolean(CARDS_DB[id])).slice(0, 60) : []);

/** Macht aus fremden Daten einen gültigen Stand. */
export function sanitizeBook(value: unknown): Book {
  const raw = (value ?? {}) as Partial<Book>;
  const base = emptyBook();
  const stats = (raw.stats ?? {}) as Partial<Stats>;
  const byHouse = (stats.winsByHouse ?? {}) as Record<string, unknown>;
  base.stats = {
    wins: num(stats.wins),
    winsByHouse: Object.fromEntries(DECK_THEME_IDS.flatMap((house) => (num(byHouse[house]) ? [[house, num(byHouse[house])]] : []))),
    customWins: num(stats.customWins),
    bestRunFight: Math.min(RUN_FOES.length, num(stats.bestRunFight)),
    runsWon: num(stats.runsWon),
    bestArena: Math.min(ARENA_WINS, num(stats.bestArena)),
  };
  base.lessons = Array.isArray(raw.lessons) ? raw.lessons.filter((id): id is string => LESSONS.some((lesson) => lesson.id === id)) : [];
  base.plays = Array.isArray(raw.plays) ? raw.plays.filter((id): id is string => typeof id === 'string' && id.length <= 24).slice(-MAX_PLAYS) : [];
  const run = raw.run as Partial<RunState> | null | undefined;
  if (run && isHouse(run.house) && typeof run.seed === 'string') {
    base.run = {
      seed: run.seed.slice(0, 40),
      house: run.house,
      cards: realCards(run.cards),
      treasures: Array.isArray(run.treasures) ? run.treasures.filter((id): id is string => TREASURES.some((t) => t.id === id)) : [],
      fight: Math.min(RUN_FOES.length, num(run.fight)),
      awaitingLoot: Boolean(run.awaitingLoot),
      over: run.over === 'won' || run.over === 'lost' ? run.over : null,
    };
  }
  const arena = raw.arena as Partial<ArenaState> | null | undefined;
  if (arena && typeof arena.seed === 'string') {
    base.arena = { seed: arena.seed.slice(0, 40), house: isHouse(arena.house) ? arena.house : null, cards: realCards(arena.cards).slice(0, DECK_SIZE), wins: Math.min(ARENA_WINS, num(arena.wins)), losses: Math.min(ARENA_LOSSES, num(arena.losses)) };
  }
  base.frame = typeof raw.frame === 'string' ? raw.frame.slice(0, 20) : null;
  base.crest = typeof raw.crest === 'string' ? raw.crest.slice(0, 20) : null;
  base.updatedAt = num(raw.updatedAt);
  return base;
}

/** Bestwerte zählen das Höchste, Abgeschlossenes bleibt; Lauf und Turnier nimmt die jüngste Änderung. */
export function mergeBooks(a: Book, b: Book): Book {
  const [newer, older] = a.updatedAt >= b.updatedAt ? [a, b] : [b, a];
  const winsByHouse: Stats['winsByHouse'] = {};
  for (const house of DECK_THEME_IDS) {
    const most = Math.max(a.stats.winsByHouse[house] ?? 0, b.stats.winsByHouse[house] ?? 0);
    if (most) winsByHouse[house] = most;
  }
  return {
    stats: {
      wins: Math.max(a.stats.wins, b.stats.wins),
      winsByHouse,
      customWins: Math.max(a.stats.customWins, b.stats.customWins),
      bestRunFight: Math.max(a.stats.bestRunFight, b.stats.bestRunFight),
      runsWon: Math.max(a.stats.runsWon, b.stats.runsWon),
      bestArena: Math.max(a.stats.bestArena, b.stats.bestArena),
    },
    lessons: [...new Set([...a.lessons, ...b.lessons])],
    run: newer.run,
    arena: newer.arena,
    plays: [...new Set([...older.plays, ...newer.plays])].slice(-MAX_PLAYS),
    frame: newer.frame ?? older.frame,
    crest: newer.crest ?? older.crest,
    updatedAt: newer.updatedAt,
  };
}
