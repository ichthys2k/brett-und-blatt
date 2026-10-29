/*
 * Der Fragenkatalog selbst liegt nicht hier, sondern in `content/bibelquiz/fragen.json`.
 * Er kommt vom Spieleserver (`GET /bibelquiz/fragen`), damit er nicht im Browser-Bundle
 * steckt und sich ohne neuen Web-Build ändern lässt; ohne Server greift die gleichnamige
 * Datei neben dem JS-Paket (`prepare` in `index.ts`). Deshalb ist der Katalog ein
 * veränderlicher Speicher: Die Regeln selbst bleiben rein und deterministisch, sobald
 * irgendwo – im Browser, im Bot-Worker, auf dem Server – derselbe Katalog gesetzt ist.
 */

export const QUESTION_CATEGORIES = [
  'Altes Testament',
  'Neues Testament',
  'Gleichnisse',
  'Personen',
  'Verse',
] as const;

export type QuestionCategory = (typeof QUESTION_CATEGORIES)[number];

export type QuestionDifficulty = 1 | 2 | 3;

export interface BibleQuestion {
  id: number;
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
  emojis: string;
  options: readonly [string, string, string, string];
  info: string;
  bibleLink?: string;
}

let catalog: readonly BibleQuestion[] = [];
let byId = new Map<number, BibleQuestion>();

/** Setzt den Katalog – vom Server, aus der mitgelieferten Datei oder im Test. */
export function setQuestionCatalog(questions: readonly BibleQuestion[]): void {
  catalog = questions;
  byId = new Map(questions.map((question) => [question.id, question]));
}

/** Der geladene Katalog; leer, solange `prepare` ihn nicht geholt hat. */
export function questionCatalog(): readonly BibleQuestion[] {
  return catalog;
}

export function hasQuestionCatalog(): boolean {
  return catalog.length > 0;
}

export function questionById(id: number): BibleQuestion | undefined {
  return byId.get(id);
}

function isQuestion(value: unknown, index: number): value is BibleQuestion {
  if (typeof value !== 'object' || value === null) return false;
  const q = value as Record<string, unknown>;
  const where = `Frage ${index + 1}`;
  if (!Number.isInteger(q.id) || (q.id as number) < 1) throw new Error(`${where}: ungültige id`);
  if (!QUESTION_CATEGORIES.includes(q.category as QuestionCategory)) throw new Error(`${where}: unbekannte Kategorie`);
  if (q.difficulty !== 1 && q.difficulty !== 2 && q.difficulty !== 3) throw new Error(`${where}: ungültige Schwierigkeit`);
  if (typeof q.emojis !== 'string' || q.emojis.length === 0) throw new Error(`${where}: keine Emojis`);
  if (typeof q.info !== 'string' || q.info.length === 0) throw new Error(`${where}: keine Erklärung`);
  if (!Array.isArray(q.options) || q.options.length !== 4) throw new Error(`${where}: es müssen vier Antworten sein`);
  if (!q.options.every((option) => typeof option === 'string' && option.length > 0)) throw new Error(`${where}: leere Antwort`);
  if (q.bibleLink !== undefined && typeof q.bibleLink !== 'string') throw new Error(`${where}: ungültiger Bibellink`);
  return true;
}

/**
 * Prüft rohe Daten (Serverantwort oder Datei) und gibt sie als Katalog zurück.
 * Wirft bei kaputten Daten mit einer klaren Meldung, statt später im Spiel zu straucheln.
 */
export function parseQuestionCatalog(data: unknown): BibleQuestion[] {
  const list = Array.isArray(data) ? data : (data as { questions?: unknown } | null)?.questions;
  if (!Array.isArray(list) || list.length === 0) throw new Error('Fragenkatalog: keine Fragen gefunden');
  const questions = list.filter(isQuestion);
  const ids = new Set(questions.map((q) => q.id));
  if (ids.size !== questions.length) throw new Error('Fragenkatalog: doppelte Frage-ids');
  return questions;
}
