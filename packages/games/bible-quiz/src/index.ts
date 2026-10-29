import type { GameModule, PrepareContext } from '@brett-und-blatt/engine';
import { quizBot } from './bots';
import { meta } from './meta';
import {
  hasQuestionCatalog,
  parseQuestionCatalog,
  setQuestionCatalog,
  type BibleQuestion,
} from './questions';
import {
  applyMove,
  currentPlayers,
  isLegal,
  legalMoves,
  options,
  playerView,
  result,
  sampleHidden,
  setup,
  timePresets,
  timeoutMove,
  type BibleQuizMove,
  type BibleQuizState,
} from './rules';

export { meta } from './meta';
export * from './questions';
export * from './rules';
export { quizBot } from './bots';

/** Pfad der Fragen auf dem Spieleserver. */
export const KATALOG_PFAD = '/bibelquiz/fragen';
/** Dieselben Fragen liegen als Datei neben dem JS-Paket – für den Start ohne Server/Internet. */
export const KATALOG_DATEI = 'bibelquiz/fragen.json';

/** Wie lange auf eine Quelle gewartet wird, bevor die nächste drankommt. Ohne Netz soll das Spiel schnell starten. */
const ZEITGRENZE_MS = 3000;

/** `fetch` mit Zeitgrenze – `AbortSignal.timeout` fehlt in manchen Laufzeiten (Cloudflare-Worker). */
async function fetchMitGrenze(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ZEITGRENZE_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Holt den Fragenkatalog: zuerst vom Spieleserver (immer aktuell, ohne neuen Web-Build),
 * sonst aus der mitgelieferten Datei. Ist schon einer gesetzt – etwa auf dem Server –, passiert nichts.
 */
export async function prepare(context: PrepareContext): Promise<void> {
  if (hasQuestionCatalog()) return;

  const quellen = [
    ...(context.serverUrl ? [`${context.serverUrl.replace(/\/+$/, '')}${KATALOG_PFAD}`] : []),
    `${context.baseUrl}${KATALOG_DATEI}`,
  ];

  const fehler: string[] = [];
  for (const url of quellen) {
    try {
      const response = await fetchMitGrenze(url);
      if (!response.ok) {
        fehler.push(`${url}: ${response.status}`);
        continue;
      }
      const questions: BibleQuestion[] = parseQuestionCatalog(await response.json());
      setQuestionCatalog(questions);
      return;
    } catch (error) {
      fehler.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`Bibel-Quiz: Der Fragenkatalog ließ sich nicht laden (${fehler.join('; ')})`);
}

export const gameModule: GameModule<BibleQuizState, BibleQuizMove> = {
  info: meta,
  options,
  timePresets,
  prepare,
  setup,
  currentPlayers,
  legalMoves,
  isLegal,
  applyMove,
  playerView,
  sampleHidden,
  timeoutMove,
  result,
  bots: [quizBot],
};
