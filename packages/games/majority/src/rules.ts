import { hashSeed, loadCatalog, makeRoundGame, type PrepareContext, type Rng, type RoundMove, type RoundState } from '@brett-und-blatt/engine';
import { meta } from './meta';

export interface MajorityQuestion {
  id: string;
  text: string;
  options: string[];
}

interface Pack {
  id: string;
  name: string;
  questions: MajorityQuestion[];
}

let catalog: Pack[] | null = null;

export function parseMajorityCatalog(raw: unknown): Pack[] {
  const packs = (raw as { packs?: Pack[] }).packs;
  if (!Array.isArray(packs) || packs.length === 0) throw new Error('Mehrheitsfrage: Katalog ohne Pakete');
  for (const pack of packs) {
    for (const q of pack.questions) {
      if (!q.id || !q.text || !Array.isArray(q.options) || q.options.length < 2) throw new Error(`Mehrheitsfrage: Frage ${q.id} ist fehlerhaft`);
    }
  }
  return packs;
}

export const setMajorityCatalog = (packs: Pack[]) => {
  catalog = packs;
};
export const hasMajorityCatalog = () => catalog !== null;

export const KATALOG = { serverPath: '/klassenspiele/mehrheit', file: 'klassenspiele/mehrheit.json', label: 'Mehrheitsfrage' };

async function prepare(context: PrepareContext): Promise<void> {
  if (!catalog) setMajorityCatalog(parseMajorityCatalog(await loadCatalog(context, KATALOG)));
}

/** Punkte nach dem Anteil derer, die dasselbe gewählt haben: Wählen es alle, sind es 10. */
export function scoreMajority(answers: (number | null)[]): number[] {
  const given = answers.filter((a) => a !== null).length;
  return answers.map((answer) => (answer === null ? 0 : Math.round((answers.filter((a) => a === answer).length / given) * 10)));
}

/** Bots haben zu jeder Frage dieselbe Vorliebe, damit auch unter ihnen Mehrheiten entstehen. */
function favourite(q: MajorityQuestion): number {
  return hashSeed(q.id)[0] % q.options.length;
}

export const gameModule = makeRoundGame<MajorityQuestion, number>({
  info: meta,
  defaultSeconds: 20,
  prepare,
  botName: 'Stimmungsfühler',
  options: [
    {
      id: 'pack',
      label: 'Fragen',
      choices: [
        { value: 'all', label: 'Alles gemischt' },
        { value: 'alltag', label: 'Alltag' },
        { value: 'bibel', label: 'Bibel' },
        { value: 'schule', label: 'Schule' },
      ],
      default: 'all',
    },
  ],
  pickQuestions(options, count, rng: Rng) {
    if (!catalog) throw new Error('Mehrheitsfrage: Katalog nicht geladen');
    const pool = catalog.filter((p) => options.pack === undefined || options.pack === 'all' || p.id === options.pack).flatMap((p) => p.questions);
    return rng.shuffle(pool).slice(0, count);
  },
  publicQuestion: (q) => q,
  isValidAnswer: (q, a): a is number => typeof a === 'number' && Number.isInteger(a) && a >= 0 && a < q.options.length,
  sampleAnswers: (q) => q.options.map((_, i) => i),
  scoreRound: (_q, answers) => scoreMajority(answers),
  botAnswer(q, level, rng) {
    const stray = level === 'easy' ? 0.6 : level === 'medium' ? 0.3 : 0.1;
    return rng.next() < stray ? Math.floor(rng.next() * q.options.length) : favourite(q);
  },
});

export type MajorityState = RoundState<MajorityQuestion, number>;
export type MajorityMove = RoundMove<number>;
