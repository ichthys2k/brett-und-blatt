import { loadCatalog, makeRoundGame, type BotLevel, type PrepareContext, type Rng, type RoundMove, type RoundState } from '@brett-und-blatt/engine';
import { meta } from './meta';

/**
 * Ein Satz Ereignisse. `items` steht durcheinander und ohne Jahreszahl, sonst verriete die
 * Anzeige die Lösung. Die Antwort nennt die Einträge in der gewählten Reihenfolge als Indizes.
 */
export interface TimelineQuestion {
  id: string;
  title: string;
  items: string[];
  /** Index in `items` für Platz 1, 2, …; während der Antwortzeit null. */
  order: number[] | null;
  /** Jahreszahl oder leer, passend zu `items`; während der Antwortzeit null. */
  years: string[] | null;
}

interface RawSet {
  id: string;
  title: string;
  items: string[];
}

interface Pack {
  id: string;
  name: string;
  sets: RawSet[];
}

let catalog: Pack[] | null = null;

export function parseTimelineCatalog(raw: unknown): Pack[] {
  const packs = (raw as { packs?: Pack[] }).packs;
  if (!Array.isArray(packs) || packs.length === 0) throw new Error('Zeitstrahl: Katalog ohne Pakete');
  for (const pack of packs) {
    for (const set of pack.sets) {
      if (!set.id || !set.title || !Array.isArray(set.items) || set.items.length < 3) throw new Error(`Zeitstrahl: Satz ${set.id} ist fehlerhaft`);
    }
  }
  return packs;
}

export const setTimelineCatalog = (packs: Pack[]) => {
  catalog = packs;
};
export const hasTimelineCatalog = () => catalog !== null;

export const KATALOG = { serverPath: '/klassenspiele/zeitstrahl', file: 'klassenspiele/zeitstrahl.json', label: 'Zeitstrahl' };

async function prepare(context: PrepareContext): Promise<void> {
  if (!catalog) setTimelineCatalog(parseTimelineCatalog(await loadCatalog(context, KATALOG)));
}

/** „Telefon (1876)“ wird zu Name und Jahreszahl. */
export function splitItem(item: string): { name: string; year: string } {
  const match = /^(.*?)\s*\(([^()]*)\)$/.exec(item);
  return match ? { name: match[1]!, year: match[2]! } : { name: item, year: '' };
}

export function buildQuestion(set: RawSet, rng: Rng): TimelineQuestion {
  const parts = set.items.map(splitItem);
  const indices = parts.map((_, i) => i);
  let shown = rng.shuffle(indices);
  // Nie schon fertig sortiert anzeigen.
  if (shown.every((v, i) => v === i)) shown = [...shown.slice(1), shown[0]!];
  return {
    id: set.id,
    title: set.title,
    items: shown.map((i) => parts[i]!.name),
    order: indices.map((i) => shown.indexOf(i)),
    years: shown.map((i) => parts[i]!.year),
  };
}

/** Je Eintrag am richtigen Platz 2 Punkte, alles richtig 4 extra. */
export function scoreTimeline(order: number[], answers: (number[] | null)[]): number[] {
  return answers.map((answer) => {
    if (answer === null) return 0;
    const right = answer.filter((item, place) => order[place] === item).length;
    return right * 2 + (right === order.length ? 4 : 0);
  });
}

const isPermutation = (a: unknown, n: number): a is number[] => Array.isArray(a) && a.length === n && new Set(a).size === n && a.every((v) => Number.isInteger(v) && v >= 0 && v < n);

const SWAPS: Record<BotLevel, number> = { easy: 3, medium: 1, hard: 0 };

export const gameModule = makeRoundGame<TimelineQuestion, number[]>({
  info: meta,
  defaultSeconds: 45,
  prepare,
  botName: 'Chronist',
  options: [
    {
      id: 'pack',
      label: 'Ereignisse',
      choices: [
        { value: 'all', label: 'Alles gemischt' },
        { value: 'bibel', label: 'Bibel' },
        { value: 'geschichte', label: 'Geschichte' },
        { value: 'erfindungen', label: 'Erfindungen' },
      ],
      default: 'all',
    },
  ],
  pickQuestions(options, count, rng) {
    if (!catalog) throw new Error('Zeitstrahl: Katalog nicht geladen');
    const pool = catalog.filter((p) => options.pack === undefined || options.pack === 'all' || p.id === options.pack).flatMap((p) => p.sets);
    return rng.shuffle(pool).slice(0, count).map((set) => buildQuestion(set, rng));
  },
  publicQuestion: (q) => ({ ...q, order: null, years: null }),
  isValidAnswer: (q, a): a is number[] => isPermutation(a, q.items.length),
  sampleAnswers: (q) => [q.items.map((_, i) => i), q.items.map((_, i) => q.items.length - 1 - i)],
  scoreRound: (q, answers) => scoreTimeline(q.order!, answers),
  botAnswer(q, level, rng) {
    // Der Bot kennt die Reihenfolge aus dem Katalog und vertauscht je nach Stufe ein paar Einträge.
    const set = catalog?.flatMap((p) => p.sets).find((s) => s.id === q.id);
    const names = set?.items.map((item) => splitItem(item).name) ?? q.items;
    const answer = names.map((name) => q.items.indexOf(name));
    for (let i = 0; i < SWAPS[level]; i++) {
      const a = Math.floor(rng.next() * answer.length);
      const b = Math.floor(rng.next() * answer.length);
      [answer[a], answer[b]] = [answer[b]!, answer[a]!];
    }
    return answer;
  },
});

export type TimelineState = RoundState<TimelineQuestion, number[]>;
export type TimelineMove = RoundMove<number[]>;
