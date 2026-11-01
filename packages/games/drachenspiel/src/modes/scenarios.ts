import type { BotLevel } from '@brett-und-blatt/engine';
import { decodeDeck, parseDeckCode } from '../deckcode';
import { DECK_THEME_IDS, themeCardIds } from '../decks';
import type { DeckThemeId } from '../types';

/**
 * Solo-Kämpfe (Phase 9): Eine Partie bleibt eine Partie; ein Szenario legt nur fest, wie sie beginnt.
 * Platz 0 ist immer der Mensch, Platz 1 der Bot. Sonderregeln entstehen allein aus der Startaufstellung,
 * darum braucht kein Kampf eigenen Regelcode.
 */
export interface SideSetup {
  house: DeckThemeId;
  deck: string[];
  health?: number;
  armor?: number;
  board?: string[];
  /** Feste Starthand statt gezogener Karten. */
  hand?: string[];
  mana?: number;
}

export interface Scenario {
  me: SideSetup;
  enemy: SideSetup;
  level: BotLevel;
}

/** Lerndecks: nur Tiere ohne Fähigkeit, damit nichts vorgreift, was eine spätere Lektion erklärt. */
const SIMPLE = ['n_kobold', 'n_crow', 'n_heron', 'n_bison', 'c43', 'n_giant', 'c7'];
const simpleDeck = () => SIMPLE.flatMap((id) => [id, id, id, id]);

export interface Lesson {
  id: string;
  title: string;
  /** Was die Lektion beibringt, in der Reihenfolge der Hinweise. */
  tips: string[];
  scenario: Scenario;
}

export const LESSONS: Lesson[] = [
  {
    id: 'mana',
    title: 'Mana und Tiere',
    tips: ['Unten siehst du deine Karten. Die blaue Zahl sagt, wie viel Mana (💧) eine Karte kostet.', 'Tippe eine Karte an: Das Tier kommt aufs Feld. Im nächsten Zug darf es angreifen.', 'Beende deinen Zug mit dem Knopf. Jeden Zug bekommst du einen Kristall mehr.', 'Greife den gegnerischen Helden an: Tippe dein Tier an, dann den Helden oben. Bei 0 Leben hast du gewonnen.'],
    scenario: { me: { house: 'farm', deck: simpleDeck(), hand: ['c7', 'n_kobold', 'n_crow'], mana: 2 }, enemy: { house: 'farm', deck: simpleDeck(), health: 6, hand: [] }, level: 'easy' },
  },
  {
    id: 'trade',
    title: 'Abtausch',
    tips: ['Greifst du ein Tier an, schlagen beide zu: Jedes verliert so viele Leben, wie das andere Angriff hat.', 'Dein Reiher (4/3) räumt die Krähe (3/2) ab, fällt dabei aber selbst. Dein Bison (4/5) übersteht das. Probiere aus, welcher Tausch sich lohnt.', 'Ein Tier des Gegners wegzuräumen schützt deinen Helden oft mehr als ein Treffer.'],
    scenario: { me: { house: 'farm', deck: simpleDeck(), board: ['n_heron', 'n_bison'], mana: 2 }, enemy: { house: 'farm', deck: simpleDeck(), health: 10, board: ['n_crow', 'n_kobold'], hand: [] }, level: 'easy' },
  },
  {
    id: 'guard',
    title: 'Beschützer',
    tips: ['Tiere mit 🛡️ Beschützer musst du zuerst angreifen, bevor du etwas anderes treffen darfst.', 'Lange drücken zeigt jede Karte groß, mit allen Fähigkeiten.'],
    scenario: { me: { house: 'farm', deck: simpleDeck(), board: ['n_heron', 'n_heron'], mana: 3 }, enemy: { house: 'forest', deck: simpleDeck(), health: 8, board: ['f_dormouse', 'sea_hermit'], hand: [] }, level: 'easy' },
  },
  {
    id: 'power',
    title: 'Hauskraft',
    tips: ['Der runde Knopf neben „Zug beenden“ ist deine Hauskraft: einmal je Zug, 2 Mana.', 'Dein Hof ruft damit Küken. Wenn Mana übrig ist, lohnt sie sich fast immer.'],
    scenario: { me: { house: 'farm', deck: simpleDeck(), hand: ['c7'], mana: 3 }, enemy: { house: 'farm', deck: simpleDeck(), health: 8, board: ['n_kobold'], hand: [] }, level: 'easy' },
  },
  {
    id: 'spell',
    title: 'Zauber',
    tips: ['Zauber wirken sofort und sind dann weg. Manche brauchen ein Ziel: erst die Karte antippen, dann das Ziel.', 'Blitzschlag trifft Gegner oder Helden, der Honigtopf stärkt dein eigenes Tier.'],
    scenario: { me: { house: 'wild', deck: simpleDeck(), board: ['n_crow'], hand: ['s_lightning', 's_honey', 's_lightning'], mana: 4 }, enemy: { house: 'farm', deck: simpleDeck(), health: 10, board: ['n_heron'], hand: [] }, level: 'easy' },
  },
  {
    id: 'choice',
    title: 'Wählen',
    tips: ['Manche Karten fragen nach: Du wählst aus mehreren Möglichkeiten genau eine.', 'Das Eichhörnchen fragt: Karte ziehen oder selbst stärker werden? Beides kann richtig sein.', 'Spurenlesen zeigt dir drei Tiere; eines kommt auf die Hand.'],
    scenario: { me: { house: 'bugs', deck: simpleDeck(), hand: ['c24', 's_tracks', 'c24'], mana: 4 }, enemy: { house: 'farm', deck: simpleDeck(), health: 12, board: ['n_crow'], hand: [] }, level: 'easy' },
  },
  {
    id: 'final',
    title: 'Dein erstes Duell',
    tips: ['Jetzt alles zusammen: ein ganzes Deck, ein echter Gegner, er hat nur etwas weniger Leben.', 'Tipp: Der Knopf „Tipp“ unter dem Feld schlägt dir einen Zug vor.'],
    scenario: { me: { house: 'farm', deck: themeCardIds('farm', true) }, enemy: { house: 'forest', deck: themeCardIds('forest', true), health: 18 }, level: 'easy' },
  },
];

export interface RunFoe {
  name: string;
  emoji: string;
  /** Was diesen Kampf besonders macht. */
  rule: string;
  house: DeckThemeId;
  health: number;
  armor?: number;
  board?: string[];
  mana?: number;
  level: BotLevel;
}

/** Die Wanderschaft: acht Gegner, nach dem Tierepos und eigenen Sagen. */
export const RUN_FOES: RunFoe[] = [
  { name: 'Lampe der Hase', emoji: '🐇', rule: 'Hat wenig Leben, ist aber schnell dabei.', house: 'farm', health: 14, board: ['n_kobold'], level: 'easy' },
  { name: 'Henning der Hahn', emoji: '🐓', rule: 'Beginnt mit zwei Küken.', house: 'farm', health: 16, board: ['token_chick', 'token_chick'], level: 'easy' },
  { name: 'Hinze der Kater', emoji: '🐈', rule: 'Lauert hinter einer Wildkatze.', house: 'wild', health: 18, board: ['n_wildcat'], level: 'easy' },
  { name: 'Mira im Moor', emoji: '🕷️', rule: 'Ihr Bienenstock steht schon.', house: 'bugs', health: 20, board: ['bug_hive'], level: 'medium' },
  { name: 'Grimbart im Hain', emoji: '🦡', rule: 'Trägt 5 Rüstung.', house: 'forest', health: 22, armor: 5, level: 'medium' },
  { name: 'Kapitän Krabbe', emoji: '🦀', rule: 'Hält dich mit zwei Beschützern auf.', house: 'sea', health: 24, board: ['sea_hermit', 'sea_hermit'], level: 'medium' },
  { name: 'Isegrim der Wolf', emoji: '🐺', rule: 'Hat von Anfang an zwei Kristalle mehr.', house: 'wild', health: 26, mana: 3, level: 'hard' },
  { name: 'König Nobel', emoji: '🦁', rule: 'Die letzte Prüfung: 30 Leben, 5 Rüstung und ein Platzhirsch.', house: 'forest', health: 30, armor: 5, board: ['f_stag'], level: 'hard' },
];

export interface Treasure {
  id: string;
  name: string;
  emoji: string;
  text: string;
}

export const TREASURES: Treasure[] = [
  { id: 'vigor', name: 'Kräutertee', emoji: '🍵', text: '5 Leben mehr in jedem Kampf.' },
  { id: 'shield', name: 'Alter Schild', emoji: '🛡️', text: '5 Rüstung in jedem Kampf.' },
  { id: 'mana', name: 'Kristallsplitter', emoji: '💎', text: 'Jeder Kampf beginnt mit einem Kristall mehr.' },
  { id: 'chick', name: 'Treues Küken', emoji: '🐥', text: 'In jedem Kampf liegt zu Beginn ein Küken bei dir.' },
  { id: 'scout', name: 'Spähtrupp', emoji: '🐜', text: 'In jedem Kampf liegen zu Beginn zwei Ameisen bei dir.' },
  { id: 'guard', name: 'Treuer Käfer', emoji: '🪲', text: 'In jedem Kampf liegt zu Beginn ein Käfer als Beschützer bei dir.' },
];

export const SCENARIO_PATTERN = '[a-z0-9-]+';
export const TREASURES_PATTERN = '[a-z,]+';

function withTreasures(side: SideSetup, list: string): SideSetup {
  const out = { ...side, board: [...(side.board ?? [])] };
  for (const id of list.split(',')) {
    if (id === 'vigor') out.health = (out.health ?? 30) + 5;
    else if (id === 'shield') out.armor = (out.armor ?? 0) + 5;
    else if (id === 'mana') out.mana = (out.mana ?? 1) + 1;
    else if (id === 'chick') out.board.push('token_chick');
    else if (id === 'scout') out.board.push('token_ant', 'token_ant');
    else if (id === 'guard') out.board.push('c4');
  }
  return out;
}

export interface ScenarioOptions {
  scenario?: string;
  deckCode?: string;
  treasures?: string;
}

/** Baut aus den verborgenen Optionen den Kampf; `null`: gewöhnliche Partie. */
export function scenarioFrom(options: ScenarioOptions): Scenario | null {
  const id = options.scenario;
  if (!id || id === 'none') return null;
  const [kind, a, b] = id.split('-');
  if (kind === 'lesson') return LESSONS.find((lesson) => lesson.id === a)?.scenario ?? null;
  if (kind === 'run') {
    const foe = RUN_FOES[Number(a)];
    // Das Lauf-Deck wächst erst noch; es muss nur aus echten Karten bestehen.
    const deck = decodeDeck(options.deckCode ?? '');
    if (!foe || !deck || deck.cardIds.length === 0) return null;
    return {
      me: withTreasures({ house: deck.house, deck: deck.cardIds }, options.treasures ?? ''),
      enemy: { house: foe.house, deck: themeCardIds(foe.house, true), health: foe.health, ...(foe.armor ? { armor: foe.armor } : {}), ...(foe.board ? { board: foe.board } : {}), ...(foe.mana ? { mana: foe.mana } : {}) },
      level: foe.level,
    };
  }
  if (kind === 'arena') {
    const deck = parseDeckCode(options.deckCode ?? '');
    const house = b as DeckThemeId;
    if (!deck || !DECK_THEME_IDS.includes(house)) return null;
    return { me: { house: deck.house, deck: deck.cardIds }, enemy: { house, deck: themeCardIds(house, true) }, level: Number(a) >= 3 ? 'hard' : 'medium' };
  }
  return null;
}

export function lessonOf(options: ScenarioOptions): Lesson | null {
  const [kind, id] = (options.scenario ?? '').split('-');
  return kind === 'lesson' ? (LESSONS.find((lesson) => lesson.id === id) ?? null) : null;
}
