import { answerCard, buildQueue, clampOptions, dayNumber, emptyCollection, learnCards, recordAnswer, recordPractice, reconcileCards, streakOf, tagNotes, todaysCounts, type AnkiCollection, type ApkgCard, type ApkgRevlog, type LearnBook, type LearnOptions, type QueueCounts, type Answer } from '@brett-und-blatt/engine';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadPack, savePackAnswer, savePackLearnSettings, updatePackCollection } from './ankiStore';
import { OWN } from './collectionSource';
import { loadCollection, saveCollection } from './library';
import { announceLearning } from './classLearning';
import { loadLearnBook, localMidnight, saveLearnBook } from './learnStore';

/*
 * Lernen mit einer Quelle (#101, L5): die eigene Sammlung (Lernstand im Pass-Block `lernen`) oder ein importiertes Anki-Paket (Lernstand
 * in IndexedDB, in der Anki-Form samt Protokoll). Beides sieht für den Karteikasten gleich aus.
 */

export interface Learner {
  status: 'loading' | 'ready' | 'missing';
  name: string;
  collection: AnkiCollection;
  media: Map<string, Uint8Array>;
  crt: number;
  options: LearnOptions;
  cards: ApkgCard[];
  /** Protokoll (bei der eigenen Sammlung nur die letzten 30 Tage). */
  revlog: ApkgRevlog[];
  /** Lerntage (Tageszahlen ab `crt`). */
  days: ReadonlySet<number>;
  /** Hinweis, wenn Termine nicht stimmen können. */
  notice: string | null;
  /** Antwortet auf eine Karte; `leech`: die Karte wurde zum Egel (zu oft vergessen) und zurückgestellt. */
  answer(card: ApkgCard, answer: Answer, timeMs: number, now?: number): { leech: boolean };
  /** Üben einer Auswahl: nur das Protokoll, die Karte und ihr Plan bleiben unberührt. */
  practice(card: ApkgCard, answer: Answer, timeMs: number, now?: number): void;
  setOptions(next: LearnOptions): void;
}

export const AHEAD_SEC = 20 * 60;

export function useLearner(source: string): Learner {
  const [state, setState] = useState<{ status: Learner['status']; name: string; collection: AnkiCollection; media: Map<string, Uint8Array>; crt: number; options: LearnOptions; cards: ApkgCard[]; revlog: ApkgRevlog[]; days: number[]; notice: string | null; book: LearnBook | null }>({
    status: 'loading',
    name: '',
    collection: emptyCollection(),
    media: new Map(),
    crt: 0,
    options: clampOptions(undefined),
    cards: [],
    revlog: [],
    days: [],
    notice: null,
    book: null,
  });

  useEffect(() => {
    let cancelled = false;
    if (source === OWN) {
      const collection = loadCollection();
      const book = loadLearnBook();
      setState({ status: 'ready', name: 'Meine Notizen', collection, media: new Map(), crt: book.crt, options: book.options, cards: learnCards(collection, book), revlog: book.log, days: book.days, notice: null, book });
      import('./ankiStore').then(({ loadMedia }) => loadMedia(OWN)).then((media) => !cancelled && setState((s) => ({ ...s, media })), () => undefined);
      return () => {
        cancelled = true;
      };
    }
    loadPack(source).then(
      (loaded) => {
        if (cancelled) return;
        if (!loaded) return setState((s) => ({ ...s, status: 'missing' }));
        const { pack, media } = loaded;
        const crt = pack.crt ?? localMidnight();
        const cards = reconcileCards(pack.collection, pack.cards);
        const hasReviews = cards.some((c) => c.type === 2);
        setState({
          status: 'ready',
          name: pack.name,
          collection: pack.collection,
          media,
          crt,
          options: clampOptions(pack.learnOptions),
          cards,
          revlog: pack.revlog,
          days: [...new Set(pack.revlog.map((r) => dayNumber(crt, r.id)))],
          notice: !pack.crt && hasReviews ? 'Dieses Paket wurde vor der Lernfunktion importiert; die Termine der Karten können deshalb um einige Tage abweichen. Importiere es bei Bedarf noch einmal.' : null,
          book: null,
        });
      },
      () => !cancelled && setState((s) => ({ ...s, status: 'missing' })),
    );
    return () => {
      cancelled = true;
    };
  }, [source]);

  // Der neueste Stand liegt auch in einer Referenz, damit Antworten und Speichern nicht im Aktualisierer von React laufen (der kann doppelt laufen).
  const latest = useRef(state);
  latest.current = state;
  const answer = useCallback(
    (card: ApkgCard, ease: Answer, timeMs: number, now = Date.now()): { leech: boolean } => {
      const s = latest.current;
      const history = s.revlog.filter((r) => r.cid === card.id);
      const result = answerCard(card, ease, s.crt, now, s.options, history, timeMs);
      const cards = s.cards.map((c) => (c.id === card.id ? result.card : c));
      // Egel: Die Notiz bekommt die Markierung `leech` (wie in Anki), die Karte ist zurückgestellt.
      const collection = result.leech ? tagNotes(s.collection, [card.nid], ['leech']) : s.collection;
      let next: typeof s;
      if (source === OWN && s.book) {
        const book = recordAnswer(s.book, result.card, result.log, now, collection);
        saveLearnBook(book, collection);
        if (result.leech) saveCollection(collection);
        next = { ...s, cards, collection, revlog: book.log, days: book.days, book };
      } else {
        void savePackAnswer(source, result.card, result.log);
        if (result.leech) void updatePackCollection(source, collection);
        announceLearning();
        const day = dayNumber(s.crt, now);
        next = { ...s, cards, collection, revlog: [...s.revlog, result.log], days: s.days.includes(day) ? s.days : [...s.days, day] };
      }
      latest.current = next;
      setState(next);
      return { leech: result.leech };
    },
    [source],
  );
  const practice = useCallback(
    (card: ApkgCard, ease: Answer, timeMs: number, now = Date.now()): void => {
      const s = latest.current;
      const log = { id: now, cid: card.id, usn: -1, ease, ivl: 0, lastIvl: 0, factor: 0, time: Math.min(Math.max(Math.round(timeMs), 0), 3_600_000), type: 3 };
      let next: typeof s;
      if (source === OWN && s.book) {
        const book = recordPractice(s.book, log, now, s.collection);
        saveLearnBook(book, s.collection);
        next = { ...s, revlog: book.log, days: book.days, book };
      } else {
        void savePackAnswer(source, card, log);
        const day = dayNumber(s.crt, now);
        next = { ...s, revlog: [...s.revlog, log], days: s.days.includes(day) ? s.days : [...s.days, day] };
      }
      latest.current = next;
      setState(next);
    },
    [source],
  );
  const setOptions = useCallback(
    (value: LearnOptions) => {
      const s = latest.current;
      const options = clampOptions(value);
      let next: typeof s;
      if (source === OWN && s.book) {
        const book = { ...s.book, options, optionsAt: Date.now() };
        saveLearnBook(book, s.collection);
        next = { ...s, options, book };
      } else {
        void savePackLearnSettings(source, { learnOptions: options, crt: s.crt });
        next = { ...s, options };
      }
      latest.current = next;
      setState(next);
    },
    [source],
  );

  return useMemo<Learner>(() => ({ ...state, days: new Set(state.days), answer, practice, setOptions }), [state, answer, practice, setOptions]);
}

export interface DueInfo {
  queue: ApkgCard[];
  counts: QueueCounts;
  today: { new: number; reviews: number; answered: number };
  streak: number;
}

/** Was heute zu tun ist, für alle Karten oder einen Stapel samt Unterstapeln. */
export function dueInfo(learner: Pick<Learner, 'cards' | 'revlog' | 'crt' | 'options' | 'days' | 'collection'>, now: number, deckId: number | 'all' = 'all'): DueInfo {
  let cards = learner.cards;
  if (deckId !== 'all') {
    const deck = learner.collection.decks.find((d) => d.id === deckId);
    if (deck) {
      const ids = new Set(learner.collection.decks.filter((d) => d.id === deck.id || d.name.startsWith(`${deck.name}::`)).map((d) => d.id));
      cards = cards.filter((c) => ids.has(c.did));
    }
  }
  const today = todaysCounts(learner.revlog, learner.crt, now);
  if (learner.options.burySiblings) {
    // Geschwisterkarten: Wer heute eine Karte einer Notiz beantwortet hat, sieht deren andere Karten (neu oder Wiederholung) erst morgen.
    const start = (learner.crt + dayNumber(learner.crt, now) * 86400) * 1000;
    const answered = new Set(learner.revlog.filter((r) => r.id >= start && r.type !== 3).map((r) => r.cid));
    const nids = new Set(learner.cards.filter((c) => answered.has(c.id)).map((c) => c.nid));
    cards = cards.filter((c) => answered.has(c.id) || c.queue === 1 || !nids.has(c.nid));
  }
  const { queue, counts } = buildQueue(cards, learner.crt, now, { newPerDay: learner.options.newPerDay, reviewsPerDay: learner.options.reviewsPerDay, doneNew: today.new, doneReviews: today.reviews, learnAheadSec: AHEAD_SEC });
  return { queue, counts, today, streak: streakOf(learner.days, dayNumber(learner.crt, now)) };
}
