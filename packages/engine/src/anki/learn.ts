import { FSRS, Rating, State, createEmptyCard, generatorParameters, type Card, type Grade, type Steps } from 'ts-fsrs';
import type { ApkgCard, ApkgRevlog } from './apkg/types';

/*
 * Wiederholen nach FSRS (#101, L5). Der Lernstand einer Karte bleibt im Anki-Format (`ApkgCard`, `ApkgRevlog`), damit er verlustfrei nach
 * Anki und zurück geht; gerechnet wird mit `ts-fsrs` (FSRS-6, MIT). Zustand in `cards.data` wie bei Anki: `{"s":Stabilität,"d":Schwierigkeit,
 * "dr":Behaltensquote,"lrt":letzte Wiederholung in Sekunden}`. Fälligkeit von Wiederholungskarten ist eine Tageszahl ab `crt` (Tag 0 der
 * Sammlung), die von Lernkarten ein Zeitpunkt in Sekunden – genau wie bei Anki. Zufall (Fuzz) ist aus: gleiche Eingabe, gleiches Ergebnis.
 */

export interface LearnOptions {
  /** Gewünschte Behaltensquote (0,7 bis 0,99). */
  retention: number;
  maxInterval: number;
  learningSteps: readonly string[];
  relearningSteps: readonly string[];
  newPerDay: number;
  reviewsPerDay: number;
}

export const DEFAULT_LEARN_OPTIONS: LearnOptions = { retention: 0.9, maxInterval: 36500, learningSteps: ['1m', '10m'], relearningSteps: ['10m'], newPerDay: 20, reviewsPerDay: 200 };

export type Answer = 1 | 2 | 3 | 4;
export const ANSWER_LABELS: Record<Answer, string> = { 1: 'Nochmal', 2: 'Schwer', 3: 'Gut', 4: 'Leicht' };

/** Anki: type 0 neu, 1 lernen, 2 wiederholen, 3 neu lernen; queue 0 neu, 1 lernen, 2 wiederholen, 3 Tageslernen, <0 zurückgestellt. */
export const CARD_NEW = 0;
export const CARD_LEARNING = 1;
export const CARD_REVIEW = 2;
export const CARD_RELEARNING = 3;

const DAY = 86400;

export function clampOptions(value: Partial<LearnOptions> | undefined): LearnOptions {
  const d = DEFAULT_LEARN_OPTIONS;
  const steps = (list: unknown, fallback: readonly string[]) => (Array.isArray(list) && list.every((s) => typeof s === 'string' && /^\d{1,4}[mhd]$/.test(s)) ? (list as string[]) : fallback);
  const num = (v: unknown, lo: number, hi: number, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback);
  return {
    retention: num(value?.retention, 0.7, 0.99, d.retention),
    maxInterval: Math.round(num(value?.maxInterval, 1, 36500, d.maxInterval)),
    learningSteps: steps(value?.learningSteps, d.learningSteps),
    relearningSteps: steps(value?.relearningSteps, d.relearningSteps),
    newPerDay: Math.round(num(value?.newPerDay, 0, 9999, d.newPerDay)),
    reviewsPerDay: Math.round(num(value?.reviewsPerDay, 0, 9999, d.reviewsPerDay)),
  };
}

const schedulers = new Map<string, FSRS>();
function schedulerFor(opts: LearnOptions): FSRS {
  const key = JSON.stringify([opts.retention, opts.maxInterval, opts.learningSteps, opts.relearningSteps]);
  let f = schedulers.get(key);
  if (!f) {
    f = new FSRS(generatorParameters({ request_retention: opts.retention, maximum_interval: opts.maxInterval, enable_fuzz: false, enable_short_term: true, learning_steps: opts.learningSteps as Steps, relearning_steps: opts.relearningSteps as Steps }));
    if (schedulers.size > 8) schedulers.clear();
    schedulers.set(key, f);
  }
  return f;
}

/** Tageszahl für `now` (ms), gezählt ab `crt` (s). */
export const dayNumber = (crt: number, now: number): number => Math.floor((now / 1000 - crt) / DAY);

interface FsrsData {
  s?: number;
  d?: number;
  dr?: number;
  lrt?: number;
  [key: string]: unknown;
}
function parseData(text: string): FsrsData {
  if (!text) return {};
  try {
    const v = JSON.parse(text);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as FsrsData) : {};
  } catch {
    return {};
  }
}

/** Schätzung aus dem alten Verfahren (SM-2): Stabilität ≈ Intervall, Schwierigkeit linear aus dem Faktor (130 % → 10, 350 % → 1). */
export function estimateFromSm2(card: Pick<ApkgCard, 'ivl' | 'factor'>): { stability: number; difficulty: number } {
  const ease = (card.factor > 0 ? card.factor : 2500) / 1000;
  return { stability: Math.max(0.1, card.ivl > 0 ? card.ivl : 1), difficulty: Math.min(10, Math.max(1, 10 - (ease - 1.3) * (9 / 2.2))) };
}

const GRADES: Record<number, Grade> = { 1: Rating.Again, 2: Rating.Hard, 3: Rating.Good, 4: Rating.Easy };

/** Spielt ein Protokoll durch FSRS nach (nur Antworten 1 bis 4 der Arten Lernen, Wiederholen, Neu lernen und Filterstapel). */
export function replayHistory(history: readonly ApkgRevlog[], opts: LearnOptions = DEFAULT_LEARN_OPTIONS): Card | null {
  const f = schedulerFor(opts);
  let card: Card | null = null;
  for (const entry of [...history].sort((a, b) => a.id - b.id)) {
    const grade = GRADES[entry.ease];
    if (!grade || entry.type > 3) continue;
    card = f.next(card ?? createEmptyCard(new Date(entry.id)), new Date(entry.id), grade).card;
  }
  return card;
}

/** Die Karte im Modell von `ts-fsrs`. Fehlt der FSRS-Zustand, wird er aus dem Protokoll berechnet, sonst aus Intervall und Faktor geschätzt. */
export function toFsrsCard(card: ApkgCard, crt: number, now: number, opts: LearnOptions = DEFAULT_LEARN_OPTIONS, history: readonly ApkgRevlog[] = []): Card {
  if (card.type === CARD_NEW) return createEmptyCard(new Date(now));
  const data = parseData(card.data);
  const state = card.type === CARD_REVIEW ? State.Review : card.type === CARD_RELEARNING ? State.Relearning : State.Learning;
  const due = new Date((card.type === CARD_REVIEW || card.queue === 3 ? crt + card.due * DAY : card.due) * 1000);
  let stability = typeof data.s === 'number' && data.s > 0 ? data.s : 0;
  let difficulty = typeof data.d === 'number' && data.d >= 1 ? data.d : 0;
  if (!stability || !difficulty) {
    const replayed = history.length > 0 ? replayHistory(history, opts) : null;
    if (replayed && replayed.stability > 0) ({ stability, difficulty } = replayed);
    else ({ stability, difficulty } = estimateFromSm2(card));
  }
  const lastSec = typeof data.lrt === 'number' && data.lrt > 0 ? data.lrt : history.length > 0 ? Math.max(...history.map((r) => r.id)) / 1000 : card.type === CARD_REVIEW ? Number(due) / 1000 - Math.max(card.ivl, 0) * DAY : 0;
  const last = lastSec > 0 ? new Date(lastSec * 1000) : undefined;
  const steps = card.type === CARD_RELEARNING ? opts.relearningSteps : opts.learningSteps;
  const remaining = card.left % 1000;
  return {
    due,
    stability,
    difficulty,
    elapsed_days: last ? Math.max(0, Math.floor((now - last.getTime()) / (DAY * 1000))) : 0,
    scheduled_days: card.type === CARD_REVIEW ? Math.max(card.ivl, 0) : 0,
    learning_steps: card.type === CARD_REVIEW ? 0 : Math.min(Math.max(steps.length - remaining, 0), Math.max(steps.length - 1, 0)),
    reps: card.reps,
    lapses: card.lapses,
    state,
    ...(last ? { last_review: last } : {}),
  };
}

/** Zurück ins Anki-Format: Tageszahl bei Wiederholungskarten, Zeitpunkt bei Lernkarten. */
function fromFsrsCard(prev: ApkgCard, next: Card, crt: number, opts: LearnOptions, now: number): ApkgCard {
  const dueSec = Math.round(next.due.getTime() / 1000);
  const base = parseData(prev.data);
  const data = { ...base, s: Math.round(next.stability * 10000) / 10000, d: Math.round(next.difficulty * 10000) / 10000, dr: opts.retention, lrt: Math.floor(now / 1000) };
  const common = { ...prev, mod: Math.floor(now / 1000), usn: -1, reps: next.reps, lapses: next.lapses, odue: 0, data: JSON.stringify(data), factor: prev.factor || 2500 };
  if (next.state === State.Review) return { ...common, type: CARD_REVIEW, queue: 2, due: Math.max(0, Math.floor((dueSec - crt) / DAY)), ivl: Math.max(1, next.scheduled_days), left: 0 };
  const steps = next.state === State.Relearning ? opts.relearningSteps : opts.learningSteps;
  const remaining = Math.max(1, steps.length - next.learning_steps);
  return {
    ...common,
    type: next.state === State.Relearning ? CARD_RELEARNING : CARD_LEARNING,
    queue: 1,
    due: dueSec,
    // Bei neu gelernten Karten bleibt das letzte Intervall stehen (Anki zeigt es weiter an).
    ivl: next.state === State.Relearning ? Math.max(prev.ivl, 1) : 0,
    left: remaining + remaining * 1000,
  };
}

/** Wie lange es bis zur nächsten Wiederholung dauert, auf Deutsch („10 Min“, „3 Tage“, „2,5 Mon“). */
export function formatInterval(ms: number): string {
  const min = ms / 60000;
  if (min < 1) return '< 1 Min';
  if (min < 60) return `${Math.round(min)} Min`;
  const h = min / 60;
  if (h < 24) return `${Math.round(h)} Std`;
  const d = h / 24;
  if (d < 30) return `${Math.round(d)} ${Math.round(d) === 1 ? 'Tag' : 'Tage'}`;
  const num = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');
  if (d < 365) return `${num(d / 30.4)} Mon`;
  return `${num(d / 365)} ${Math.round((d / 365) * 10) / 10 === 1 ? 'Jahr' : 'Jahre'}`;
}

export interface Outcome {
  card: ApkgCard;
  log: ApkgRevlog;
  /** Zeit bis zur nächsten Wiederholung, schon formatiert. */
  label: string;
}

/** Was passiert bei „Nochmal, Schwer, Gut, Leicht“ – für die Vorschau der Termine unter den Knöpfen. */
export function outcomes(card: ApkgCard, crt: number, now: number, opts: LearnOptions = DEFAULT_LEARN_OPTIONS, history: readonly ApkgRevlog[] = [], timeMs = 0): Record<Answer, Outcome> {
  const f = schedulerFor(opts);
  const fsrsCard = toFsrsCard(card, crt, now, opts, history);
  const out = {} as Record<Answer, Outcome>;
  for (const answer of [1, 2, 3, 4] as const) {
    const { card: next } = f.next(fsrsCard, new Date(now), GRADES[answer]!);
    const row = fromFsrsCard(card, next, crt, opts, now);
    const lastIvl = card.type === CARD_NEW ? 0 : card.type === CARD_REVIEW ? card.ivl : -Math.max(1, Math.round(card.due - Math.floor(now / 1000)) || 60);
    const ivl = row.type === CARD_REVIEW ? row.ivl : -Math.max(1, Math.round((next.due.getTime() - now) / 1000));
    out[answer] = {
      card: row,
      log: { id: now, cid: card.id, usn: -1, ease: answer, ivl, lastIvl, factor: row.type === CARD_REVIEW ? row.factor : 0, time: Math.min(Math.max(Math.round(timeMs), 0), 3_600_000), type: card.type === CARD_NEW || card.type === CARD_LEARNING ? 0 : card.type === CARD_REVIEW ? 1 : 2 },
      label: formatInterval(next.due.getTime() - now),
    };
  }
  return out;
}

/** Antwortet auf eine Karte; liefert die neue Karte und den Protokolleintrag. */
export function answerCard(card: ApkgCard, answer: Answer, crt: number, now: number, opts: LearnOptions = DEFAULT_LEARN_OPTIONS, history: readonly ApkgRevlog[] = [], timeMs = 0): { card: ApkgCard; log: ApkgRevlog } {
  const o = outcomes(card, crt, now, opts, history, timeMs)[answer];
  return { card: o.card, log: o.log };
}

// ---------------------------------------------------------------- Warteschlange

/** Ist die Karte jetzt zu lernen? Zurückgestellte (`queue < 0`) nie. */
export function isDue(card: ApkgCard, crt: number, now: number): boolean {
  if (card.queue === 1) return card.due <= Math.floor(now / 1000);
  if (card.queue === 2 || card.queue === 3) return card.due <= dayNumber(crt, now);
  return card.queue === 0;
}

export interface QueueCounts {
  new: number;
  learning: number;
  review: number;
}

export interface QueueOptions {
  newPerDay: number;
  reviewsPerDay: number;
  /// Heute schon gelernte neue Karten und Wiederholungen (aus dem Protokoll).
  doneNew: number;
  doneReviews: number;
  /** Lernkarten, die in so vielen Sekunden fällig werden, kommen schon jetzt dran (Anki: 20 Minuten). */
  learnAheadSec?: number;
}

/** Zählt das Protokoll des heutigen Tages: neue Karten, die zum ersten Mal beantwortet wurden, und Wiederholungen. */
export function todaysCounts(revlog: readonly ApkgRevlog[], crt: number, now: number): { new: number; reviews: number; answered: number } {
  const start = (crt + dayNumber(crt, now) * DAY) * 1000;
  let n = 0;
  let r = 0;
  let a = 0;
  for (const e of revlog) {
    if (e.id < start || e.id > start + DAY * 1000) continue;
    a++;
    if (e.type === 0 && e.lastIvl === 0) n++;
    else if (e.type === 1) r++;
  }
  return { new: n, reviews: r, answered: a };
}

/**
 * Reihenfolge der Karten für heute: zuerst fällige Lernkarten (nach Zeit), dann Wiederholungen (nach Fälligkeit), dann neue (in der
 * Reihenfolge der Notizen). Neue und Wiederholungen halten die Tageslimits ein; Lernkarten nie.
 */
export function buildQueue(cards: readonly ApkgCard[], crt: number, now: number, limits: QueueOptions): { queue: ApkgCard[]; counts: QueueCounts } {
  const learning: ApkgCard[] = [];
  const ahead: ApkgCard[] = [];
  const review: ApkgCard[] = [];
  const fresh: ApkgCard[] = [];
  const nowSec = Math.floor(now / 1000);
  const today = dayNumber(crt, now);
  for (const c of cards) {
    if (c.queue < 0) continue;
    if (c.queue === 0) fresh.push(c);
    else if (c.queue === 1) {
      if (c.due <= nowSec) learning.push(c);
      else if (c.due <= nowSec + (limits.learnAheadSec ?? 0)) ahead.push(c);
    } else if (c.due <= today) (c.queue === 2 ? review : learning).push(c);
  }
  const at = (c: ApkgCard) => (c.queue === 1 ? c.due : crt + c.due * DAY);
  learning.sort((a, b) => at(a) - at(b));
  ahead.sort((a, b) => a.due - b.due);
  review.sort((a, b) => a.due - b.due || a.id - b.id);
  fresh.sort((a, b) => a.due - b.due || a.id - b.id);
  const reviews = review.slice(0, Math.max(0, limits.reviewsPerDay - limits.doneReviews));
  const news = fresh.slice(0, Math.max(0, limits.newPerDay - limits.doneNew));
  // Wie in Anki: Lernkarten, die erst in Kürze fällig werden, kommen nur, wenn sonst nichts mehr ansteht.
  return { queue: [...learning, ...reviews, ...news, ...ahead], counts: { new: news.length, learning: learning.length + ahead.length, review: reviews.length } };
}

/** Lerntage in Folge, gezählt bis heute (oder bis gestern, solange heute noch nichts gelernt wurde). */
export function streakOf(days: ReadonlySet<number>, today: number): number {
  let day = days.has(today) ? today : today - 1;
  let n = 0;
  while (days.has(day)) {
    n++;
    day--;
  }
  return n;
}
