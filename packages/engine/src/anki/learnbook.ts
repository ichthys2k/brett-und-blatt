import { cardOrds, derivedCardId } from './collection';
import { clampOptions, type LearnOptions } from './learn';
import type { ApkgCard, ApkgRevlog } from './apkg/types';
import type { AnkiCollection } from './types';

/*
 * Lernbuch (#101, L5): der Lernstand der eigenen Sammlung. Er liegt im Pass-Block `lernen` und wird mit anderen Geräten zusammengeführt:
 * je Karte gilt die jüngste Antwort, das Protokoll vereinigt sich (nach Kennung), Lerntage vereinigen sich. Platz sparen: je Karte ein
 * Zahlenfeld statt Objekt, Protokoll nur 30 Tage (Älteres als Zähler), höchstens 400 Lerntage, Block höchstens 60 000 Zeichen (Grenze der
 * Sicherung ist 64 KB, verschlüsselt kommt etwas dazu). Karten importierter Pakete liegen nicht hier, sondern bei den Paketen.
 */

const DAY = 86400;
export const LEARN_LOG_DAYS = 30;
export const LEARN_MAX_DAYS = 400;
export const LEARN_MAX_CHARS = 60_000;

/** `[type, queue, due, ivl, factor, reps, lapses, left, mod, s, d, lrt]` */
export type StoredCard = [number, number, number, number, number, number, number, number, number, number, number, number];

export interface LearnBook {
  v: 1;
  /** Tag 0 (Sekunden), fest ab dem ersten Gebrauch. 0 = noch nicht benutzt. */
  crt: number;
  cards: Record<string, StoredCard>;
  /** Protokoll der letzten 30 Tage, jüngste zuletzt. */
  log: ApkgRevlog[];
  /** Antworten, die schon aus dem Protokoll herausgefallen sind. */
  older: number;
  /** Lerntage (Tageszahlen ab `crt`). */
  days: number[];
  options: LearnOptions;
  /** Wann die Einstellungen zuletzt geändert wurden (ms); die jüngeren gewinnen beim Zusammenführen. */
  optionsAt: number;
}

export const emptyLearnBook = (crt = 0): LearnBook => ({ v: 1, crt, cards: {}, log: [], older: 0, days: [], options: clampOptions(undefined), optionsAt: 0 });

const finite = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

export function sanitizeLearnBook(value: unknown): LearnBook {
  if (!value || typeof value !== 'object') return emptyLearnBook();
  const raw = value as Record<string, unknown>;
  const cards: Record<string, StoredCard> = {};
  if (raw.cards && typeof raw.cards === 'object') {
    for (const [id, t] of Object.entries(raw.cards as Record<string, unknown>)) {
      if (!/^\d{1,16}$/.test(id) || !Array.isArray(t) || t.length !== 12) continue;
      const row = t.map((x) => finite(x)) as StoredCard;
      if (row[0] < 0 || row[0] > 3 || row[1] < -3 || row[1] > 3) continue;
      cards[id] = row;
    }
  }
  const log: ApkgRevlog[] = [];
  if (Array.isArray(raw.log)) {
    for (const e of raw.log) {
      if (!Array.isArray(e) || e.length !== 7) continue;
      const [id, cid, ease, ivl, lastIvl, time, type] = e.map((x) => finite(x));
      if (id! > 0 && cid! > 0 && ease! >= 1 && ease! <= 4) log.push({ id: id!, cid: cid!, usn: -1, ease: ease!, ivl: ivl!, lastIvl: lastIvl!, factor: 0, time: time!, type: type! });
    }
  }
  const days = Array.isArray(raw.days) ? [...new Set((raw.days as unknown[]).map((d) => Math.trunc(finite(d, -1))).filter((d) => d >= 0))].sort((a, b) => a - b).slice(-LEARN_MAX_DAYS) : [];
  return { v: 1, crt: Math.max(0, Math.trunc(finite(raw.crt))), cards, log: log.sort((a, b) => a.id - b.id), older: Math.max(0, Math.trunc(finite(raw.older))), days, options: clampOptions(raw.options as Partial<LearnOptions> | undefined), optionsAt: Math.max(0, finite(raw.optionsAt)) };
}

/** Die Form für die Speicherung (Protokolleinträge als Zahlenfelder). */
export function learnBookToStored(book: LearnBook): unknown {
  return { v: 1, crt: book.crt, cards: book.cards, log: book.log.map((e) => [e.id, e.cid, e.ease, e.ivl, e.lastIvl, e.time, e.type]), older: book.older, days: book.days, options: book.options, optionsAt: book.optionsAt };
}

/** Kürzt auf die Fenster und die Größengrenze; mit Sammlung fallen Karten gelöschter Notizen weg. */
export function compactLearnBook(book: LearnBook, now: number, col?: AnkiCollection): LearnBook {
  let log = book.log;
  let older = book.older;
  const cutoff = now - LEARN_LOG_DAYS * DAY * 1000;
  const kept = log.filter((e) => e.id >= cutoff);
  older += log.length - kept.length;
  log = kept;
  let cards = book.cards;
  if (col) {
    const alive = new Set<string>();
    const types = new Map(col.notetypes.map((nt) => [nt.id, nt]));
    for (const note of col.notes) {
      const nt = types.get(note.mid);
      if (nt) for (const ord of cardOrds(nt, note.fields)) alive.add(String(derivedCardId(note.id, ord)));
    }
    cards = Object.fromEntries(Object.entries(cards).filter(([id]) => alive.has(id)));
  }
  let next: LearnBook = { ...book, cards, log, older, days: book.days.slice(-LEARN_MAX_DAYS) };
  // Zu groß: das älteste Protokoll opfern (der Lernstand der Karten bleibt immer erhalten).
  while (next.log.length > 0 && JSON.stringify(learnBookToStored(next)).length > LEARN_MAX_CHARS) {
    const drop = Math.max(1, Math.floor(next.log.length / 5));
    next = { ...next, log: next.log.slice(drop), older: next.older + drop };
  }
  return next;
}

/** Schiebt Fälligkeitstage von Wiederholungskarten, wenn ein anderes Gerät einen anderen Tag 0 hat. */
function rebase(book: LearnBook, crt: number): LearnBook {
  if (book.crt === crt || book.crt === 0) return { ...book, crt };
  const delta = Math.round((book.crt - crt) / DAY);
  const cards = Object.fromEntries(Object.entries(book.cards).map(([id, c]) => [id, c[1] === 2 || c[1] === 3 ? ([...c.slice(0, 2), c[2] + delta, ...c.slice(3)] as StoredCard) : c]));
  return { ...book, crt, cards, days: book.days.map((d) => d + delta).filter((d) => d >= 0) };
}

export function mergeLearnBooks(a: LearnBook, b: LearnBook): LearnBook {
  if (b.crt === 0 && Object.keys(b.cards).length === 0 && b.log.length === 0 && b.days.length === 0) return a.crt === 0 ? { ...a, options: a.optionsAt >= b.optionsAt ? a.options : b.options } : a;
  if (a.crt === 0 && Object.keys(a.cards).length === 0 && a.log.length === 0 && a.days.length === 0) return b;
  const crt = Math.min(...[a.crt, b.crt].filter((c) => c > 0));
  const x = rebase(a, crt);
  const y = rebase(b, crt);
  const cards: Record<string, StoredCard> = { ...x.cards };
  for (const [id, c] of Object.entries(y.cards)) {
    const mine = cards[id];
    // je Karte die jüngste Antwort (Feld 8 = Änderungszeit), bei Gleichstand die mit mehr Wiederholungen
    if (!mine || c[8] > mine[8] || (c[8] === mine[8] && c[5] > mine[5])) cards[id] = c;
  }
  const seen = new Set<number>();
  const log = [...x.log, ...y.log].filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true))).sort((p, q) => p.id - q.id);
  const [newer, other] = x.optionsAt >= y.optionsAt ? [x, y] : [y, x];
  return { v: 1, crt, cards, log, older: Math.max(x.older, y.older), days: [...new Set([...x.days, ...y.days])].sort((p, q) => p - q), options: newer.options, optionsAt: Math.max(newer.optionsAt, other.optionsAt) };
}

export function sameLearnBook(a: LearnBook, b: LearnBook): boolean {
  return JSON.stringify(learnBookToStored(a)) === JSON.stringify(learnBookToStored(b));
}

// ---------------------------------------------------------------- Karten

function fromStored(id: number, nid: number, did: number, ord: number, t: StoredCard): ApkgCard {
  const data: Record<string, number> = {};
  if (t[9] > 0) Object.assign(data, { s: t[9], d: t[10], dr: 0.9, lrt: t[11] });
  return { id, nid, did, ord, mod: t[8], usn: -1, type: t[0], queue: t[1], due: t[2], ivl: t[3], factor: t[4], reps: t[5], lapses: t[6], left: t[7], odue: 0, odid: 0, flags: 0, data: t[9] > 0 ? JSON.stringify(data) : '' };
}

function toStoredCard(card: ApkgCard): StoredCard {
  let s = 0;
  let d = 0;
  let lrt = 0;
  try {
    const data = JSON.parse(card.data || '{}') as Record<string, unknown>;
    s = finite(data.s);
    d = finite(data.d);
    lrt = finite(data.lrt);
  } catch {
    // ohne lesbare Daten bleibt der FSRS-Zustand leer
  }
  return [card.type, card.queue, card.due, card.ivl, card.factor, card.reps, card.lapses, card.left, card.mod, s, d, lrt];
}

/** Alle Karten der Sammlung im Anki-Format, mit dem Lernstand aus dem Buch; Neues in der Reihenfolge der Notizen. */
export function learnCards(col: AnkiCollection, book: LearnBook): ApkgCard[] {
  const types = new Map(col.notetypes.map((nt) => [nt.id, nt]));
  const out: ApkgCard[] = [];
  let position = 1;
  for (const note of col.notes) {
    const nt = types.get(note.mid);
    if (!nt) continue;
    for (const ord of cardOrds(nt, note.fields)) {
      const id = derivedCardId(note.id, ord);
      const stored = book.cards[String(id)];
      if (stored && stored[0] !== 0) {
        out.push(fromStored(id, note.id, note.did, ord, stored));
        position++;
      } else out.push({ id, nid: note.id, did: note.did, ord, mod: stored?.[8] ?? 0, usn: -1, type: 0, queue: 0, due: position++, ivl: 0, factor: 0, reps: 0, lapses: 0, left: 0, odue: 0, odid: 0, flags: 0, data: '' });
    }
  }
  return out;
}

/** Trägt eine Antwort ins Buch ein (Karte, Protokoll, Lerntag). */
export function recordAnswer(book: LearnBook, card: ApkgCard, log: ApkgRevlog, now: number, col?: AnkiCollection): LearnBook {
  const crt = book.crt;
  const today = Math.floor((now / 1000 - crt) / DAY);
  const days = book.days.includes(today) ? book.days : [...book.days, today];
  return compactLearnBook({ ...book, cards: { ...book.cards, [String(card.id)]: toStoredCard(card) }, log: [...book.log, log], days }, now, col);
}

/** Stellt eine Karte wieder auf „neu“. Der Eintrag bleibt (mit neuer Änderungszeit), damit andere Geräte die Karte nicht zurückbringen. */
export function forgetCard(book: LearnBook, cardId: number, now: number): LearnBook {
  return { ...book, cards: { ...book.cards, [String(cardId)]: [0, 0, 0, 0, 0, 0, 0, 0, Math.floor(now / 1000), 0, 0, 0] } };
}
