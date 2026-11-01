import { loadCatalog, makeRoundGame, type BotLevel, type PrepareContext, type Rng, type RoundMove, type RoundState } from '@brett-und-blatt/engine';
import { meta } from './meta';

export interface EstimateQuestion {
  id: string;
  text: string;
  /** Die Lösung; während der Antwortzeit null. */
  answer: number | null;
  unit: string;
  min: number;
  max: number;
}

interface Pack {
  id: string;
  name: string;
  questions: EstimateQuestion[];
}

let catalog: Pack[] | null = null;

/** Prüft den Katalog beim Einlesen; ein Fehler darin soll nicht erst mitten in der Partie auffallen. */
export function parseEstimateCatalog(raw: unknown): Pack[] {
  const packs = (raw as { packs?: Pack[] }).packs;
  if (!Array.isArray(packs) || packs.length === 0) throw new Error('Schätzmeister: Katalog ohne Pakete');
  for (const pack of packs) {
    for (const q of pack.questions) {
      if (!q.id || !q.text || typeof q.answer !== 'number' || !(q.min <= q.answer && q.answer <= q.max)) throw new Error(`Schätzmeister: Frage ${q.id} ist fehlerhaft`);
    }
  }
  return packs;
}

export const setEstimateCatalog = (packs: Pack[]) => {
  catalog = packs;
};
export const hasEstimateCatalog = () => catalog !== null;

export const KATALOG = { serverPath: '/klassenspiele/schaetzen', file: 'klassenspiele/schaetzen.json', label: 'Schätzmeister' };

async function prepare(context: PrepareContext): Promise<void> {
  if (!catalog) setEstimateCatalog(parseEstimateCatalog(await loadCatalog(context, KATALOG)));
}

const packs = () => {
  if (!catalog) throw new Error('Schätzmeister: Katalog nicht geladen');
  return catalog;
};

/** Die Punkte einer Runde: am nächsten 10, bis 10 % daneben 5, bis 25 % daneben 2, genau getroffen 5 extra. */
export function scoreEstimate(truth: number, answers: (number | null)[]): number[] {
  const given = answers.filter((a): a is number => a !== null);
  const best = given.length > 0 ? Math.min(...given.map((a) => Math.abs(a - truth))) : 0;
  return answers.map((answer) => {
    if (answer === null) return 0;
    const off = Math.abs(answer - truth);
    const share = truth === 0 ? (off === 0 ? 0 : 1) : off / Math.abs(truth);
    let points = off === best ? 10 : share <= 0.1 ? 5 : share <= 0.25 ? 2 : 0;
    if (off === 0) points += 5;
    return points;
  });
}

const NOISE: Record<BotLevel, number> = { easy: 0.45, medium: 0.2, hard: 0.08 };

export const gameModule = makeRoundGame<EstimateQuestion, number>({
  info: meta,
  defaultSeconds: 30,
  prepare,
  botName: 'Schätzfuchs',
  options: [
    {
      id: 'pack',
      label: 'Fragen',
      choices: [
        { value: 'all', label: 'Alles gemischt' },
        { value: 'allgemein', label: 'Allgemein' },
        { value: 'bibel', label: 'Bibel' },
        { value: 'mathe', label: 'Mathe Kl. 5/6' },
      ],
      default: 'all',
    },
  ],
  pickQuestions(options, count, rng: Rng) {
    const pool = packs().filter((p) => options.pack === undefined || options.pack === 'all' || p.id === options.pack).flatMap((p) => p.questions);
    return rng.shuffle(pool).slice(0, count);
  },
  publicQuestion: (q) => ({ ...q, answer: null }),
  isValidAnswer: (q, a): a is number => typeof a === 'number' && Number.isInteger(a) && a >= q.min && a <= q.max,
  sampleAnswers: (q) => [q.min, Math.round((q.min + q.max) / 2), q.max],
  scoreRound: (q, answers) => scoreEstimate(q.answer!, answers),
  botAnswer(q, level, rng) {
    // Der Bot kennt die Lösung aus dem Katalog und liegt je nach Stufe mehr oder weniger daneben.
    const truth = packs().flatMap((p) => p.questions).find((x) => x.id === q.id)?.answer ?? (q.min + q.max) / 2;
    const guess = truth * (1 + (rng.next() * 2 - 1) * NOISE[level]);
    return Math.max(q.min, Math.min(q.max, Math.round(guess)));
  },
});

export type EstimateState = RoundState<EstimateQuestion, number>;
export type EstimateMove = RoundMove<number>;
