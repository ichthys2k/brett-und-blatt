import { CREST_COLOR_SETS, CREST_DIVISIONS, CREST_ORNAMENTS, CREST_SHIELDS, crestNeeds, unlockOf, type CrestProgress } from '../packages/engine/src';
import { describe, expect, it } from 'vitest';
import { CARD_BACK_CATALOG, getCardBackDefinition, type CardBackUnlockState } from '../apps/web/src/lib/cardBacks';
import { totals, type Book, type Counter } from '../apps/web/src/lib/partiebuch';
import { CATEGORIES, familyGameIds } from '../apps/web/src/lib/rubriken';
import { stampCount } from '../apps/web/src/lib/stamps';
import { buildProgress, checkRule, crestProgressOf, crestUnlock, fillText, unlockFor } from '../apps/web/src/lib/unlocks';

/*
 * #569: Der Baustein ersetzt die Einzelregeln, ohne etwas zu ändern. Die „alten“ Entscheidungen stehen hier als Vergleich
 * (so, wie `cardBacks.ts` sie vor dem Umbau berechnete); beide müssen für viele Stände dasselbe sagen, samt Text.
 */

const c = (played: number, won = 0): Counter => ({ played, won, drawn: 0, lost: played - won });
const bookOf = (counts: Book['counts'], stamps: Book['stamps'] = {}): Book => ({ counts, stamps, recent: [] });

const label = (have: number, needed: number, done: string, todo: (missing: number) => string) =>
  have >= needed ? { unlocked: true, progressLabel: done } : { unlocked: false, progressLabel: `${todo(needed - have)} (${have}/${needed})` };

/** Die Regeln von vorher, unverändert übernommen. */
const OLD: Record<string, (state: CardBackUnlockState) => { unlocked: boolean; progressLabel: string }> = {
  'bavarian-gold': (state) => {
    const count = stampCount(state.book, ['skat', 'schafkopf', 'doppelkopf', 'binokel']);
    return count >= 3 ? { unlocked: true, progressLabel: `Freigeschaltet (${count}/3 Stichspiel-Stempel)` } : { unlocked: false, progressLabel: `Noch ${3 - count} Stichspiel-Stempel bis zur Freischaltung (${count}/3)` };
  },
  'jester-velvet': (state) => {
    const played = Object.values(state.book.counts).some((dev) => dev['color-sorter'] && Object.values(dev['color-sorter']).some((x) => x.played > 0));
    return played || state.jesterUnlocked ? { unlocked: true, progressLabel: 'Freigeschaltet durch den Narrenhof' } : { unlocked: false, progressLabel: 'Erfordert 1 Partie im Narrenhof oder Narren im Atelier' };
  },
  'dragon-scale': (state) => {
    const won = Object.values(state.book.counts).some((dev) => dev['drachenspiel'] && Object.values(dev['drachenspiel']).some((x) => x.won > 0));
    return won ? { unlocked: true, progressLabel: 'Freigeschaltet durch Sieg im Drachenspiel' } : { unlocked: false, progressLabel: 'Erfordert 1 Sieg im Drachenspiel' };
  },
  'castle-banner': (state) => label(totals(state.book).played, 10, 'Freigeschaltet nach 10 Partien', (n) => `Noch ${n} ${n === 1 ? 'Partie' : 'Partien'}`),
  'library-ink': (state) => label(state.learnDays ?? 0, 5, 'Freigeschaltet durch 5 Lerntage im Karteikasten', (n) => `Noch ${n} ${n === 1 ? 'Lerntag' : 'Lerntage'} im Karteikasten`),
  'garden-rose': (state) => {
    const distinct = (state.familyGameIds ?? []).filter((id) => totals(state.book, id).played > 0).length;
    return label(distinct, 3, 'Freigeschaltet durch 3 verschiedene Familienspiele', (n) => `Noch ${n} ${n === 1 ? 'Familienspiel' : 'verschiedene Familienspiele'}`);
  },
  fairground: (state) => label(totals(state.book, 'color-sorter').won > 0 ? 1 : 0, 1, 'Freigeschaltet durch Sieg im Narrenhof', () => 'Erfordert 1 Sieg im Narrenhof'),
  'night-sky': (state) => label(totals(state.book, undefined, 'tournament').played > 0 ? 1 : 0, 1, 'Freigeschaltet durch ein Turnier', () => 'Erfordert 1 beendetes Turnier'),
};

const family = familyGameIds();
const states = (): CardBackUnlockState[] => {
  const out: CardBackUnlockState[] = [];
  const stampSets: Book['stamps'][] = [{}, { 'skat/first': 1 }, { 'skat/first': 1, 'skat/win': 2, 'binokel/first': 3 }, { 'skat/first': 1, 'schafkopf/first': 1, 'doppelkopf/first': 1, 'binokel/first': 1, 'binokel/win': 1 }];
  const countSets: Book['counts'][] = [
    {},
    { d: { skat: { 'bots/easy': c(9) } } },
    { d: { skat: { 'bots/easy': c(6) }, uno: { 'solo/-': c(4) } } },
    { d: { skat: { 'bots/easy': c(10, 3) } }, e: { 'color-sorter': { 'solo/-': c(1) } } },
    { d: { 'color-sorter': { 'solo/-': c(2, 1) }, drachenspiel: { 'bots/hard': c(1, 1) } } },
    { d: { drachenspiel: { 'bots/easy': c(3) } } },
    { d: { [family[0]!]: { 'solo/-': c(1) }, [family[1]!]: { 'hotseat/-': c(1) } }, e: { [family[2]!]: { 'online/-': c(2, 1) } } },
    { d: { [family[0]!]: { 'solo/-': c(1) }, [family[1]!]: { 'solo/-': c(1) } } },
    { d: { skat: { 'tournament/-': c(1) } } },
  ];
  for (const counts of countSets)
    for (const stamps of stampSets)
      for (const learnDays of [0, 4, 5, 9])
        for (const jesterUnlocked of [false, true])
          for (const familyGameIds of [undefined, family]) out.push({ book: bookOf(counts, stamps), hasCrest: false, learnDays, jesterUnlocked, ...(familyGameIds ? { familyGameIds } : {}) });
  return out;
};

describe('Freischalt-Baustein: Kartenrücken (#569)', () => {
  it('alle 13 Rücken entscheiden und beschriften wie vorher', () => {
    const all = states();
    expect(all.length).toBeGreaterThan(500);
    const free = ['classic-red', 'classic-blue', 'tavern-oak', 'royal-crest', 'tavern-lantern'];
    for (const entry of CARD_BACK_CATALOG) {
      const old = OLD[entry.id];
      if (!old) {
        expect(free, entry.id).toContain(entry.id);
        for (const state of all) expect(entry.unlockCheck(state).unlocked, entry.id).toBe(true);
        continue;
      }
      for (const state of all) expect(entry.unlockCheck(state), entry.id).toEqual(old(state));
    }
  });

  it('alle 8 Rücken mit Regel sind im Katalog (die gemalten, sobald ihr Bild vorliegt)', () => {
    for (const id of ['bavarian-gold', 'jester-velvet', 'dragon-scale']) expect(getCardBackDefinition(id as never).id).toBe(id);
    expect(CARD_BACK_CATALOG.map((e) => e.id).filter((id) => OLD[id]).length).toBeGreaterThanOrEqual(3);
  });
});

describe('Freischalt-Baustein: Wappenteile (#569)', () => {
  const grid = [0, 1, 2, 3, 4, 5, 9, 10, 25, 100];
  const parts: ['shield' | 'division' | 'colors' | 'ornament', string][] = [
    ...CREST_SHIELDS.map((v) => ['shield', v] as ['shield', string]),
    ...CREST_DIVISIONS.map((v) => ['division', v] as ['division', string]),
    ...CREST_COLOR_SETS.map((v) => ['colors', v.id] as ['colors', string]),
    ...CREST_ORNAMENTS.map((v) => ['ornament', v] as ['ornament', string]),
  ];

  it('jedes Teil: gleiche Entscheidung und gleicher Hinweis wie `unlockOf`', () => {
    const keys = ['stamps', 'trophies', 'wins', 'played', 'tournamentWins', 'categoriesComplete'] as const;
    expect(parts.length).toBeGreaterThan(30);
    for (const have of grid) {
      for (const lone of keys) {
        const progress: CrestProgress = { stamps: 0, trophies: 0, wins: 0, played: 0, tournamentWins: 0, categoriesComplete: 0 };
        progress[lone] = have;
        const stats = buildProgress({ book: bookOf({}) });
        Object.assign(stats, { stamps: progress.stamps, trophies: progress.trophies, won: progress.wins, played: progress.played, tournamentWins: progress.tournamentWins, categoriesComplete: progress.categoriesComplete });
        expect(crestProgressOf(stats)).toEqual(progress);
        for (const [kind, value] of parts) expect(crestUnlock(kind, value, stats), `${kind}:${value} ${lone}=${have}`).toEqual(unlockOf(kind, value, progress));
      }
    }
  });

  it('jede Bedingung der Engine hat eine Regel, ein unbekanntes Teil ist frei', () => {
    const stats = buildProgress({ book: bookOf({}) });
    for (const need of crestNeeds()) expect(unlockFor(`crest:${need.id}`, stats).unlocked).toBe(false);
    expect(crestUnlock('shield', 'gibt-es-nicht', stats)).toEqual({ ok: true, hint: '' });
  });
});

describe('Progress und Textvorlagen (#569)', () => {
  it('zählt Stempel, Rubriken und Merker aus dem Buch', () => {
    const board = CATEGORIES.find((cat) => cat.id === 'board')!.gameIds;
    const counts: Book['counts'] = { d: Object.fromEntries(board.map((id) => [id, { 'solo/-': c(1, 1) }])) };
    const progress = buildProgress({ book: bookOf(counts), learnDays: 3, jesterAtelier: true });
    expect(progress.categoriesComplete).toBe(1);
    expect(progress.played).toBe(board.length);
    expect(progress.learnDays).toBe(3);
    expect(progress.jester).toBe(1);
    expect(progress.tournamentPlayed).toBe(0);
    expect(buildProgress({ book: bookOf({}), knownGameIds: new Set(['chess']) }).categoriesComplete).toBe(0);
  });

  it('füllt Vorlagen mit Zahl und Einzahl/Mehrzahl', () => {
    expect(fillText('Noch {n} {n?Partie|Partien} ({have}/{min})', { have: 9, min: 10, n: 1 })).toBe('Noch 1 Partie (9/10)');
    expect(fillText('Noch {n} {n?Partie|Partien} ({have}/{min})', { have: 7, min: 10, n: 3 })).toBe('Noch 3 Partien (7/10)');
  });

  it('mehrere Bedingungen: alle müssen stimmen, der Text folgt der ersten offenen', () => {
    const rule = { id: 'x', art: 'cardBack' as const, bedingungen: [{ stat: 'played' as const, min: 2 }, { stat: 'learnDays' as const, min: 3 }], text: { done: 'ja', todo: 'Noch {n} ({have}/{min})' } };
    const base = buildProgress({ book: bookOf({ d: { skat: { 'solo/-': c(5) } } }), learnDays: 1 });
    expect(checkRule(rule, base)).toMatchObject({ unlocked: false, progressLabel: 'Noch 2 (1/3)' });
    expect(checkRule(rule, { ...base, learnDays: 3 })).toMatchObject({ unlocked: true, progressLabel: 'ja' });
  });
});
