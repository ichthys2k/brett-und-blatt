import { crestNeeds, type CrestProgress } from '@brett-und-blatt/engine';
import { totals, type Book } from './partiebuch';
import { CATEGORIES, familyGameIds } from './rubriken';
import { categoryStamp, stampCount } from './stamps';

/*
 * Freischalt-Baustein (Belohnungskonzept #324, Schritt #569): Ein synchrones `Progress`-Objekt sammelt die Zähler aus
 * Partiebuch, Stempeln, Lernbuch und Turnieren; Regeln sind Daten (`{ id, art, bedingungen[] }`), den Fortschrittstext
 * erzeugt der Baustein. Rein: kein Speicher, keine Oberfläche, kein dynamischer Import. Die Kartenrücken
 * (`cardBacks.ts`) und die Wappenteile (`crestStore.ts`, Regeln in `player-crest.ts`) nutzen ihn; die Stufen (#571)
 * lesen dieselben Zähler.
 */

/** Stichspiele, deren Stempel den Rücken „Wirtshaus-Raute Gold“ freischalten. */
export const TRICK_GAMES = ['skat', 'schafkopf', 'doppelkopf', 'binokel'] as const;

export const STAT_KEYS = [
  'played',
  'won',
  'trophies',
  'tournamentPlayed',
  'tournamentWins',
  'stamps',
  'categoriesComplete',
  'learnDays',
  'trickStamps',
  'familyPlayed',
  'narrenhofWon',
  'dragonWon',
  'jester',
] as const;
export type StatKey = (typeof STAT_KEYS)[number];

/** Alle Zähler eines Passes; jeder Wert ist eine nicht negative ganze Zahl (Merker sind 0 oder 1). */
export type Progress = Record<StatKey, number>;

export interface ProgressInput {
  book: Book;
  /** Tage mit Lernsitzung im Karteikasten. */
  learnDays?: number;
  /** Narren im Atelier des Narrenhofs freigeschaltet (steht nicht im Partiebuch). */
  jesterAtelier?: boolean;
  /** Spiele der Rubrik „Familie & Gesellschaft“; Vorgabe: aus den Rubriken. */
  familyGameIds?: readonly string[];
  /** Nur diese Spiele gibt es (z. B. ohne Entwürfe); Vorgabe: alle Spiele der Rubriken. */
  knownGameIds?: ReadonlySet<string>;
}

const flag = (value: boolean): number => (value ? 1 : 0);

/** Rechnet die Zähler aus den Quellen aus. */
export function buildProgress(input: ProgressInput): Progress {
  const { book } = input;
  const known = input.knownGameIds;
  const categories = CATEGORIES.map((category) => ({ ...category, gameIds: category.gameIds.filter((id) => !known || known.has(id)) }));
  const allIds = categories.flatMap((category) => category.gameIds);
  const sum = totals(book);
  const tournament = totals(book, undefined, 'tournament');
  const family = input.familyGameIds ?? familyGameIds();
  return {
    played: sum.played,
    won: sum.won,
    trophies: sum.won,
    tournamentPlayed: flag(tournament.played > 0),
    tournamentWins: tournament.won,
    stamps: stampCount(book, allIds),
    categoriesComplete: categories.filter((category) => categoryStamp(book, category.gameIds).earned).length,
    learnDays: input.learnDays ?? 0,
    trickStamps: stampCount(book, TRICK_GAMES),
    familyPlayed: family.filter((id) => totals(book, id).played > 0).length,
    narrenhofWon: flag(totals(book, 'color-sorter').won > 0),
    dragonWon: flag(totals(book, 'drachenspiel').won > 0),
    jester: flag(totals(book, 'color-sorter').played > 0 || Boolean(input.jesterAtelier)),
  };
}

/** Eine Bedingung: der Zähler muss mindestens `min` erreichen. */
export interface Condition {
  stat: StatKey;
  min: number;
  /** Einheit für den Hinweis bei Wappenteilen („10 Stempel (du hast 5)“). */
  unit?: string;
}

/**
 * Textvorlagen: `{have}` (Stand), `{min}` (Ziel), `{n}` (fehlt noch) und `{n?Einzahl|Mehrzahl}` (wählt nach `n`).
 * Bei mehreren Bedingungen gilt die erste noch offene (sonst die erste).
 */
export interface RuleText {
  done: string;
  todo: string;
}

export interface UnlockRule {
  id: string;
  art: 'cardBack' | 'crest';
  /** Alle müssen erfüllt sein; leer: von Anfang an frei. */
  bedingungen: readonly Condition[];
  text?: RuleText;
}

export interface UnlockResult {
  unlocked: boolean;
  progressLabel: string;
  /** Für Wappenteile: was fehlt („10 Stempel (du hast 5)“), leer wenn frei. */
  hint: string;
}

export function fillText(template: string, values: { have: number; min: number; n: number }): string {
  return template
    .replace(/\{n\?([^|}]*)\|([^}]*)\}/g, (_all, one: string, many: string) => (values.n === 1 ? one : many))
    .replace(/\{(have|min|n)\}/g, (_all, key: 'have' | 'min' | 'n') => String(values[key]));
}

/** Prüft eine Regel gegen die Zähler. */
export function checkRule(rule: UnlockRule, progress: Progress): UnlockResult {
  const open = rule.bedingungen.find((condition) => progress[condition.stat] < condition.min);
  const focus = open ?? rule.bedingungen[0];
  const have = focus ? progress[focus.stat] : 0;
  const min = focus?.min ?? 0;
  const values = { have, min, n: Math.max(0, min - have) };
  const unlocked = !open;
  const template = unlocked ? rule.text?.done : rule.text?.todo;
  return {
    unlocked,
    progressLabel: template ? fillText(template, values) : '',
    hint: unlocked || !focus ? '' : `${focus.min} ${focus.unit ?? ''} (du hast ${have})`.replace(/ {2,}/g, ' '),
  };
}

/** Regeln der Kartenrücken mit Freischaltung (die fünf freien Rücken haben keine). */
export const CARD_BACK_RULES: readonly UnlockRule[] = [
  {
    id: 'bavarian-gold',
    art: 'cardBack',
    bedingungen: [{ stat: 'trickStamps', min: 3 }],
    text: { done: 'Freigeschaltet ({have}/{min} Stichspiel-Stempel)', todo: 'Noch {n} Stichspiel-Stempel bis zur Freischaltung ({have}/{min})' },
  },
  {
    id: 'jester-velvet',
    art: 'cardBack',
    bedingungen: [{ stat: 'jester', min: 1 }],
    text: { done: 'Freigeschaltet durch den Narrenhof', todo: 'Erfordert 1 Partie im Narrenhof oder Narren im Atelier' },
  },
  {
    id: 'dragon-scale',
    art: 'cardBack',
    bedingungen: [{ stat: 'dragonWon', min: 1 }],
    text: { done: 'Freigeschaltet durch Sieg im Drachenspiel', todo: 'Erfordert 1 Sieg im Drachenspiel' },
  },
  {
    id: 'castle-banner',
    art: 'cardBack',
    bedingungen: [{ stat: 'played', min: 10 }],
    text: { done: 'Freigeschaltet nach 10 Partien', todo: 'Noch {n} {n?Partie|Partien} ({have}/{min})' },
  },
  {
    id: 'library-ink',
    art: 'cardBack',
    bedingungen: [{ stat: 'learnDays', min: 5 }],
    text: { done: 'Freigeschaltet durch 5 Lerntage im Karteikasten', todo: 'Noch {n} {n?Lerntag|Lerntage} im Karteikasten ({have}/{min})' },
  },
  {
    id: 'garden-rose',
    art: 'cardBack',
    bedingungen: [{ stat: 'familyPlayed', min: 3 }],
    text: { done: 'Freigeschaltet durch 3 verschiedene Familienspiele', todo: 'Noch {n} {n?Familienspiel|verschiedene Familienspiele} ({have}/{min})' },
  },
  {
    id: 'fairground',
    art: 'cardBack',
    bedingungen: [{ stat: 'narrenhofWon', min: 1 }],
    text: { done: 'Freigeschaltet durch Sieg im Narrenhof', todo: 'Erfordert 1 Sieg im Narrenhof ({have}/{min})' },
  },
  {
    id: 'night-sky',
    art: 'cardBack',
    bedingungen: [{ stat: 'tournamentPlayed', min: 1 }],
    text: { done: 'Freigeschaltet durch ein Turnier', todo: 'Erfordert 1 beendetes Turnier ({have}/{min})' },
  },
];

/** Regeln der Wappenteile, abgeleitet aus der Tabelle der Engine (`crestNeeds`): Kennung `crest:<art>:<wert>`. */
export const CREST_RULES: readonly UnlockRule[] = crestNeeds().map((need) => ({
  id: `crest:${need.id}`,
  art: 'crest' as const,
  bedingungen: [{ stat: need.stat === 'wins' ? 'won' : need.stat, min: need.min, unit: need.text }],
}));

const RULES = new Map<string, UnlockRule>([...CARD_BACK_RULES, ...CREST_RULES].map((rule) => [rule.id, rule]));

/** Die Regel zu einer Kennung (Kartenrücken-Id oder `crest:<art>:<wert>`), falls es eine gibt. */
export function ruleFor(id: string): UnlockRule | undefined {
  return RULES.get(id);
}

/** Prüft die Regel mit dieser Kennung; ohne Regel ist der Rücken bzw. das Teil frei. */
export function unlockFor(id: string, progress: Progress): UnlockResult {
  const rule = RULES.get(id);
  return rule ? checkRule(rule, progress) : { unlocked: true, progressLabel: '', hint: '' };
}

/** Ist ein Wappenteil frei? Gleiche Antwort wie `unlockOf` der Engine, aber über die Regeln dieses Bausteins. */
export function crestUnlock(kind: 'shield' | 'division' | 'colors' | 'ornament', value: string, progress: Progress): { ok: boolean; hint: string } {
  const result = unlockFor(`crest:${kind}:${value}`, progress);
  return { ok: result.unlocked, hint: result.hint };
}

/** Die Zähler in der Form, die die Wappen-Engine kennt. */
export function crestProgressOf(progress: Progress): CrestProgress {
  return {
    stamps: progress.stamps,
    trophies: progress.trophies,
    wins: progress.won,
    played: progress.played,
    tournamentWins: progress.tournamentWins,
    categoriesComplete: progress.categoriesComplete,
  };
}
