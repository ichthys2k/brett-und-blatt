import { describe, expect, it } from 'vitest';
import { CARD_LEARNING, CARD_NEW, CARD_REVIEW, answerCard, buildQueue, dayNumber, estimateFromSm2, formatInterval, outcomes, replayHistory, streakOf, todaysCounts, toFsrsCard, type ApkgCard, type ApkgRevlog } from '../src';

const DAYMS = 86_400_000;
const crt = Math.floor(Date.UTC(2026, 0, 1) / 1000);
const T0 = Date.UTC(2026, 10, 1, 9, 0, 0);
const fresh = (id: number, due = id): ApkgCard => ({ id, nid: id, did: 1, ord: 0, mod: 0, usn: -1, type: 0, queue: 0, due, ivl: 0, factor: 0, reps: 0, lapses: 0, left: 0, odue: 0, odid: 0, flags: 0, data: '' });

describe('FSRS auf Anki-Karten', () => {
  it('lässt eine neue Karte lernen, wiederholen und bei „Nochmal“ neu lernen', () => {
    let card = fresh(1);
    let now = T0;
    let history: ApkgRevlog[] = [];
    const step = (answer: 1 | 2 | 3 | 4) => {
      const r = answerCard(card, answer, crt, now, undefined, history);
      card = r.card;
      history = [...history, r.log];
    };
    step(3); // Gut: erster Lernschritt (1 Min → nach Standard 10 Min)
    expect(card.type).toBe(CARD_LEARNING);
    expect(card.queue).toBe(1);
    expect(card.due).toBeGreaterThan(Math.floor(now / 1000));
    now += 10 * 60_000;
    step(3); // Gut: Lernschritte durch
    expect(card.type).toBe(CARD_REVIEW);
    expect(card.ivl).toBeGreaterThanOrEqual(1);
    expect(JSON.parse(card.data)).toMatchObject({ dr: 0.9 });
    const firstIvl = card.ivl;
    now += card.ivl * DAYMS;
    step(3);
    expect(card.ivl).toBeGreaterThan(firstIvl); // Intervalle wachsen
    now += card.ivl * DAYMS;
    const lapsesBefore = card.lapses;
    step(1); // vergessen
    expect(card.lapses).toBe(lapsesBefore + 1);
    expect(card.type).not.toBe(CARD_REVIEW); // Neu lernen
    expect(history.map((h) => h.ease)).toEqual([3, 3, 3, 1]);
    expect(history[0]!.type).toBe(0);
    expect(history[2]!.type).toBe(1);
  });

  it('ist deterministisch und zeigt aufsteigende Termine je Antwort', () => {
    const a = outcomes(fresh(1), crt, T0);
    const b = outcomes(fresh(1), crt, T0);
    expect(a).toEqual(b);
    expect(a[1].label).toMatch(/Min/);
    const days = (o: typeof a) => (o[4].card.type === CARD_REVIEW ? o[4].card.ivl : 0);
    expect(days(a)).toBeGreaterThan(0); // Leicht schließt das Lernen ab
  });

  it('rechnet eine SM-2-Karte um: Stabilität aus dem Intervall, Schwierigkeit aus dem Faktor', () => {
    const sm2: ApkgCard = { ...fresh(2), type: 2, queue: 2, due: dayNumber(crt, T0), ivl: 20, factor: 2500, reps: 8, lapses: 1 };
    const est = estimateFromSm2(sm2);
    expect(est.stability).toBe(20);
    expect(est.difficulty).toBeGreaterThan(4);
    expect(est.difficulty).toBeLessThan(6);
    expect(estimateFromSm2({ ...sm2, factor: 1300 }).difficulty).toBe(10);
    expect(estimateFromSm2({ ...sm2, factor: 3500 }).difficulty).toBe(1);
    const card = toFsrsCard(sm2, crt, T0);
    expect(card.state).toBe(2);
    expect(card.stability).toBe(20);
    const next = answerCard(sm2, 3, crt, T0).card;
    expect(next.ivl).toBeGreaterThan(20);
  });

  it('berechnet den Zustand aus dem Protokoll, wenn kein FSRS-Zustand da ist', () => {
    const log: ApkgRevlog[] = [0, 1, 3, 8].map((d, i) => ({ id: T0 - (20 - d) * DAYMS, cid: 3, usn: -1, ease: 3, ivl: 1, lastIvl: 0, factor: 2500, time: 4000, type: i === 0 ? 0 : 1 }));
    const replay = replayHistory(log)!;
    expect(replay.stability).toBeGreaterThan(1);
    const sm2: ApkgCard = { ...fresh(3), type: 2, queue: 2, due: dayNumber(crt, T0), ivl: 5, factor: 2500, reps: 4 };
    expect(toFsrsCard(sm2, crt, T0, undefined, log).stability).toBeCloseTo(replay.stability, 5);
    // ein vorhandener FSRS-Zustand geht vor
    expect(toFsrsCard({ ...sm2, data: '{"s":42,"d":3.3}' }, crt, T0, undefined, log).stability).toBe(42);
  });

  it('bleibt bei Eingaben aus Anki robust', () => {
    const odd: ApkgCard = { ...fresh(4), type: 2, queue: 2, due: 5, ivl: 0, factor: 0, data: 'kein json' };
    expect(() => outcomes(odd, crt, T0)).not.toThrow();
    expect(formatInterval(30_000)).toBe('< 1 Min');
    expect(formatInterval(10 * 60_000)).toBe('10 Min');
    expect(formatInterval(3 * DAYMS)).toBe('3 Tage');
    expect(formatInterval(DAYMS)).toBe('1 Tag');
    expect(formatInterval(75 * DAYMS)).toBe('2,5 Mon');
    expect(formatInterval(400 * DAYMS)).toBe('1,1 Jahre');
  });
});

describe('Warteschlange und Lerntage', () => {
  it('ordnet Lernen, Wiederholen, Neu und achtet auf die Tageslimits', () => {
    const today = dayNumber(crt, T0);
    const cards: ApkgCard[] = [
      fresh(1, 1),
      fresh(2, 2),
      fresh(3, 3),
      { ...fresh(4), type: CARD_REVIEW, queue: 2, due: today - 1, ivl: 5 },
      { ...fresh(5), type: CARD_REVIEW, queue: 2, due: today + 3, ivl: 5 },
      { ...fresh(6), type: CARD_LEARNING, queue: 1, due: Math.floor(T0 / 1000) - 5 },
      { ...fresh(7), type: CARD_LEARNING, queue: 1, due: Math.floor(T0 / 1000) + 600 },
      { ...fresh(8), queue: -1 },
    ];
    const { queue, counts } = buildQueue(cards, crt, T0, { newPerDay: 2, reviewsPerDay: 10, doneNew: 0, doneReviews: 0 });
    expect(queue.map((c) => c.id)).toEqual([6, 4, 1, 2]);
    expect(counts).toEqual({ new: 2, learning: 1, review: 1 });
    expect(buildQueue(cards, crt, T0, { newPerDay: 2, reviewsPerDay: 10, doneNew: 2, doneReviews: 10 }).queue.map((c) => c.id)).toEqual([6]);
    // Kurz vor Fälligkeit (Lernvorgriff) kommt erst nach allem anderen
    const ahead = buildQueue(cards, crt, T0, { newPerDay: 2, reviewsPerDay: 10, doneNew: 0, doneReviews: 0, learnAheadSec: 1200 });
    expect(ahead.queue.map((c) => c.id)).toEqual([6, 4, 1, 2, 7]);
    expect(ahead.counts.learning).toBe(2);
  });

  it('zählt den heutigen Tag aus dem Protokoll', () => {
    const e = (id: number, type: number, lastIvl: number): ApkgRevlog => ({ id, cid: 1, usn: -1, ease: 3, ivl: 1, lastIvl, factor: 0, time: 0, type });
    const log = [e(T0 - 3 * DAYMS, 1, 4), e(T0 + 1000, 0, 0), e(T0 + 2000, 0, -600), e(T0 + 3000, 1, 5)];
    expect(todaysCounts(log, crt, T0 + 5000)).toEqual({ new: 1, reviews: 1, answered: 3 });
  });

  it('zählt Lerntage in Folge', () => {
    expect(streakOf(new Set([5, 6, 7]), 7)).toBe(3);
    expect(streakOf(new Set([5, 6]), 7)).toBe(2); // heute noch nichts: gestern zählt
    expect(streakOf(new Set([5, 6]), 8)).toBe(0);
    expect(streakOf(new Set(), 3)).toBe(0);
  });
});

import { STOCK_BASIC_ID, addNote, emptyCollection, emptyLearnBook, compactLearnBook, forgetCard, learnBookToStored, learnCards, mergeLearnBooks, recordAnswer, sanitizeLearnBook, LEARN_MAX_CHARS } from '../src';

describe('Lernbuch der eigenen Sammlung', () => {
  const col = (n: number) => {
    let c = emptyCollection();
    for (let i = 0; i < n; i++) c = addNote(c, { notetypeId: STOCK_BASIC_ID, deckId: 1, fields: [`v${i}`, `h${i}`] }, T0 + i).col;
    return c;
  };
  const book0 = () => emptyLearnBook(crt);

  it('führt Karten, Protokoll und Lerntage ein und zeigt gelernte Karten im Anki-Format', () => {
    const c = col(3);
    let book = book0();
    const cards = learnCards(c, book);
    expect(cards.map((x) => x.type)).toEqual([0, 0, 0]);
    const r = answerCard(cards[0]!, 3, crt, T0);
    book = recordAnswer(book, r.card, r.log, T0, c);
    const again = learnCards(c, book);
    expect(again[0]!.type).toBe(CARD_LEARNING);
    expect(again[0]!.id).toBe(cards[0]!.id);
    expect(again[1]!.type).toBe(0);
    expect(book.log).toHaveLength(1);
    expect(book.days).toEqual([dayNumber(crt, T0)]);
    // gespeichert und wieder gelesen
    const back = sanitizeLearnBook(JSON.parse(JSON.stringify(learnBookToStored(book))));
    expect(learnCards(c, back)[0]).toEqual(again[0]);
  });

  it('führt zwei Geräte zusammen: jüngste Antwort je Karte, Protokoll und Tage vereint', () => {
    const c = col(2);
    const cards = learnCards(c, book0());
    const phone = (() => {
      const r = answerCard(cards[0]!, 3, crt, T0);
      return recordAnswer(book0(), r.card, r.log, T0, c);
    })();
    const laptop = (() => {
      let b = book0();
      const r1 = answerCard(cards[0]!, 1, crt, T0 + 60_000); // dieselbe Karte, später
      b = recordAnswer(b, r1.card, r1.log, T0 + 60_000, c);
      const r2 = answerCard(cards[1]!, 4, crt, T0 + 5 * DAYMS);
      return recordAnswer(b, r2.card, r2.log, T0 + 5 * DAYMS, c);
    })();
    const merged = mergeLearnBooks(phone, laptop);
    expect(mergeLearnBooks(laptop, phone)).toEqual(merged); // Reihenfolge egal
    expect(mergeLearnBooks(merged, merged)).toEqual(merged); // wiederholbar
    expect(merged.log.length + merged.older).toBe(3);
    expect(merged.days).toHaveLength(2);
    const lc = learnCards(c, merged);
    expect(lc[0]!.mod).toBe(Math.floor((T0 + 60_000) / 1000));
    expect(lc[1]!.type).not.toBe(0);
  });

  it('rechnet Fälligkeitstage um, wenn zwei Geräte verschiedenen Tag 0 haben', () => {
    const c = col(1);
    const card = { ...learnCards(c, book0())[0]!, type: CARD_REVIEW, queue: 2, due: 10, ivl: 5, mod: 100 };
    const a = recordAnswer({ ...book0(), crt: crt + 3 * 86400 }, card, { id: T0, cid: card.id, usn: -1, ease: 3, ivl: 5, lastIvl: 3, factor: 2500, time: 0, type: 1 }, T0, c);
    const merged = mergeLearnBooks(a, { ...book0(), crt });
    expect(merged.crt).toBe(crt);
    expect(learnCards(c, merged)[0]!.due).toBe(13);
  });

  it('vergessen bleibt auf allen Geräten vergessen und bleibt unter der Größengrenze', () => {
    const c = col(1);
    const cards = learnCards(c, book0());
    const r = answerCard(cards[0]!, 3, crt, T0);
    let book = recordAnswer(book0(), r.card, r.log, T0, c);
    const old = book;
    book = forgetCard(book, cards[0]!.id, T0 + 1000);
    expect(learnCards(c, mergeLearnBooks(old, book))[0]!.type).toBe(0);
    // viele Antworten: das Protokoll wird gekürzt, die Karten bleiben
    let big = book0();
    for (let i = 0; i < 4000; i++) big = { ...big, log: [...big.log, { id: T0 + i, cid: 1000 + (i % 50), usn: -1, ease: 3, ivl: 5, lastIvl: 3, factor: 0, time: 4000, type: 1 }] };
    const small = compactLearnBook(big, T0 + 4000);
    expect(JSON.stringify(learnBookToStored(small)).length).toBeLessThanOrEqual(LEARN_MAX_CHARS);
    expect(small.log.length + small.older).toBe(4000);
  });

  it('wirft kaputte Eingaben weg', () => {
    const b = sanitizeLearnBook({ crt: 'x', cards: { '12': [1, 2], abc: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }, log: [['a']], days: [-3, 'x', 5, 5] });
    expect(b.cards).toEqual({});
    expect(b.log).toEqual([]);
    expect(b.days).toEqual([5]);
    expect(sanitizeLearnBook(null)).toEqual(emptyLearnBook());
  });
});

import { applyGameResults, decodePairsOption, dueRowIds, encodePairsOption, noteIdOfRow, rowIdOf, packsOf } from '../src';

describe('Lernen beim Spielen', () => {
  const setup = () => {
    let c = emptyCollection();
    for (let i = 0; i < 8; i++) c = addNote(c, { notetypeId: STOCK_BASIC_ID, deckId: 1, fields: [`v${i}`, `h${i}`] }, T0 + i).col;
    return c;
  };
  it('die Zeilenkennung führt zur Notiz zurück', () => {
    const c = setup();
    const row = rowIdOf(c.notes[3]!.id);
    expect(noteIdOfRow(row)).toBe(c.notes[3]!.id);
    expect(noteIdOfRow('p-123456')).toBeNull();
  });
  it('die Auswahl nimmt fällige Zeilen zuerst und die Kennungen reisen im Optionswert mit', () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ id: `n-${(i + 1).toString(16).padStart(6, '0')}`, a: `a${i}`, b: `b${i}` }));
    const prefer = new Set([rows[25]!.id, rows[27]!.id, rows[29]!.id]);
    const value = encodePairsOption({ name: 'Test', rows }, (n) => n - 1, prefer);
    const pack = decodePairsOption(value)!;
    expect(pack.pairs).toHaveLength(18);
    expect(pack.pairs.slice(0, 3).map((p) => p.id).sort()).toEqual([...prefer].sort());
    expect(pack.pairs.every((p) => p.id)).toBe(true);
    // ohne Vorliebe bleibt es eine Zufallsauswahl, Kennungen sind trotzdem dabei
    expect(decodePairsOption(encodePairsOption({ name: 'Test', rows }, (n) => n - 1))!.pairs[0]!.id).toMatch(/^n-/);
  });
  it('zählt „sicher“ als Gut und „unsicher“ als Schwer, lässt noch nicht fällige Karten in Ruhe', () => {
    const c = setup();
    const rowA = rowIdOf(c.notes[0]!.id);
    const rowB = rowIdOf(c.notes[1]!.id);
    const rowC = rowIdOf(c.notes[2]!.id);
    let book = emptyLearnBook(crt);
    // A und B sind neu: beginnen zu lernen
    const first = applyGameResults(c, book, [{ row: rowA, sure: true }, { row: rowB, sure: false }, { row: rowA, sure: false }], T0);
    expect(first.applied).toBe(2); // doppelte Meldung zählt einmal
    book = first.book;
    const cards = learnCards(c, book);
    expect(cards[0]!.type).toBe(CARD_LEARNING);
    expect(book.log.map((e) => e.ease).sort()).toEqual([2, 3]);
    // Karte C ist längst gelernt und erst in 20 Tagen fällig: bleibt unberührt
    const cardC = { ...cards[2]!, type: CARD_REVIEW, queue: 2, due: dayNumber(crt, T0) + 20, ivl: 30, reps: 5 };
    const withC = recordAnswer(book, cardC, { id: T0 - 5, cid: cardC.id, usn: -1, ease: 3, ivl: 30, lastIvl: 20, factor: 2500, time: 0, type: 1 }, T0 - 5, c);
    const early = applyGameResults(c, withC, [{ row: rowC, sure: true }], T0 + 1000);
    expect(early.applied).toBe(0);
    expect(early.book).toBe(withC);
    // eine fällige Karte zählt
    const due = applyGameResults(c, withC, [{ row: rowC, sure: true }], T0 + 25 * DAYMS);
    expect(due.applied).toBe(1);
    expect(learnCards(c, due.book)[2]!.ivl).toBeGreaterThan(30);
  });
  it('findet die heute fälligen Zeilen, nicht die neuen', () => {
    const c = setup();
    const ids = c.notes.map((n) => rowIdOf(n.id));
    const first = applyGameResults(c, emptyLearnBook(crt), [{ row: ids[0]!, sure: true }, { row: ids[1]!, sure: true }], T0);
    // direkt danach: Lernschritt in 10 Minuten (noch nicht fällig)
    expect(dueRowIds(c, first.book, ids, T0 + 60_000).size).toBe(0);
    // nach 11 Minuten sind beide fällig, die neuen weiterhin nicht
    expect([...dueRowIds(c, first.book, ids, T0 + 11 * 60_000)].sort()).toEqual([ids[0]!, ids[1]!].sort());
    expect(packsOf(c)).toEqual([]); // Standardstapel ist kein Paket
  });
});

import { clampOptions } from '../src';

describe('Klassischer Planer (SM-2) und Egel (L8)', () => {
  const sm2 = clampOptions({ scheduler: 'sm2' });
  const reviewCard = (over: Partial<ApkgCard> = {}): ApkgCard => ({ ...fresh(9), type: CARD_REVIEW, queue: 2, due: dayNumber(crt, T0), ivl: 10, factor: 2500, reps: 5, ...over });

  it('Lernschritte, dann Abschluss mit einem Tag (Gut) oder vier Tagen (Leicht)', () => {
    const o = outcomes(fresh(1), crt, T0, sm2);
    expect(o[3].card).toMatchObject({ type: CARD_LEARNING, queue: 1 });
    expect(o[3].label).toBe('10 Min');
    expect(o[1].label).toBe('1 Min');
    expect(o[4].card).toMatchObject({ type: CARD_REVIEW, ivl: 4 });
    // zweiter Schritt, dann Gut: Wiederholungskarte mit einem Tag
    const second = outcomes(o[3].card, crt, T0 + 10 * 60_000, sm2);
    expect(second[3].card).toMatchObject({ type: CARD_REVIEW, ivl: 1, due: dayNumber(crt, T0 + 10 * 60_000) + 1, factor: 2500 });
  });
  it('Wiederholung: Intervall mal Faktor, Faktor wandert, Vergessen führt in die Neu-Lernen-Schritte', () => {
    const o = outcomes(reviewCard(), crt, T0, sm2);
    expect(o[3].card).toMatchObject({ ivl: 25, factor: 2500 });
    expect(o[2].card).toMatchObject({ ivl: 12, factor: 2350 });
    expect(o[4].card).toMatchObject({ ivl: 34, factor: 2650 });
    expect(o[1].card).toMatchObject({ type: 3, queue: 1, lapses: 1, factor: 2300 });
    // Verspätung zählt zur Hälfte
    expect(outcomes(reviewCard({ due: dayNumber(crt, T0) - 4 }), crt, T0, sm2)[3].card.ivl).toBe(30);
    // aus dem Neu-Lernen zurück: das reduzierte Intervall gilt
    const lapsed = o[1].card;
    expect(outcomes(lapsed, crt, T0 + 11 * 60_000, sm2)[3].card).toMatchObject({ type: CARD_REVIEW, ivl: 1 });
  });
  it('das Ergebnis bleibt im Anki-Format und die Karte lässt sich mit FSRS weiterlernen', () => {
    const next = answerCard(reviewCard(), 3, crt, T0, sm2).card;
    expect(next.queue).toBe(2);
    expect(() => outcomes(next, crt, T0 + 30 * DAYMS)).not.toThrow(); // Standard-Einstellung (FSRS)
  });
  it('Egel: ab der Schwelle zurückgestellt, danach alle halbe Schwelle wieder', () => {
    const lapsesTo = (lapses: number) => outcomes(reviewCard({ lapses }), crt, T0, clampOptions({ leech: 8 }))[1];
    expect(lapsesTo(6).leech).toBeUndefined();
    expect(lapsesTo(7)).toMatchObject({ leech: true, card: { queue: -1, lapses: 8 } });
    expect(lapsesTo(8).leech).toBeUndefined();
    expect(lapsesTo(11).leech).toBe(true); // 12 Mal vergessen
    expect(outcomes(reviewCard({ lapses: 7 }), crt, T0, clampOptions({ leech: 0 }))[1].leech).toBeUndefined();
    expect(answerCard(reviewCard({ lapses: 7 }), 1, crt, T0).leech).toBe(true);
  });
  it('Einstellungen werden geprüft', () => {
    expect(clampOptions({ scheduler: 'bogus' as never }).scheduler).toBe('fsrs');
    expect(clampOptions({ leech: 500 }).leech).toBe(99);
    expect(clampOptions(undefined)).toMatchObject({ scheduler: 'fsrs', fuzz: false, leech: 8, burySiblings: false });
  });
});
