import { describe, expect, it } from 'vitest';
import { MAX_PINNED, MAX_REPLAY_CHARS, limit, mergeChronik, pin, pinnedList, sameChronik, sanitizeChronik, stashReplay, unpin, type Replay } from '../apps/web/src/lib/chronik';
import type { PlayedGame } from '../apps/web/src/lib/partiebuch';

const game = (id: string, endedAt = 1000): PlayedGame => ({ id, gameId: 'chess', endedAt, durationMs: 1, mode: 'bots', seats: [{ name: 'Mia', kind: 'human', you: true }], outcome: 'win' });
const replay = (moves = 3, seed = 'S'): Replay => ({
  config: { gameId: 'chess', seed, seats: [{ kind: 'human', name: 'Mia' }, { kind: 'bot', name: 'Bot', level: 'medium' }], options: {}, time: { kind: 'none' } } as never,
  log: Array.from({ length: moves }, (_, i) => ({ actor: i % 2 === 0 ? 0 : 1, move: `m${i}`, cause: 'player' })) as never,
});

describe('Chronik (#143)', () => {
  it('heftet an, behält die Zugliste und löst wieder (mit Löschvermerk)', () => {
    const pinned = pin({}, game('a'), replay(), 10);
    expect(pinned.ok).toBe(true);
    if (!pinned.ok) return;
    expect(pinnedList(pinned.chronik).map((p) => p.id)).toEqual(['a']);
    expect(pinned.chronik.a!.replay!.log).toHaveLength(3);
    const unpinned = unpin(pinned.chronik, 'a', 20);
    expect(pinnedList(unpinned)).toEqual([]);
    expect(unpinned.a).toEqual({ id: 'a', at: 20, deleted: true });
    // erneutes Anheften geht
    expect(pin(unpinned, game('a'), null, 30).ok).toBe(true);
  });

  it('höchstens 20 angeheftete Partien', () => {
    let chronik = {};
    for (let i = 0; i < MAX_PINNED; i++) {
      const result = pin(chronik, game(`g${i}`), null, i + 1);
      expect(result.ok).toBe(true);
      if (result.ok) chronik = result.chronik;
    }
    expect(pin(chronik, game('zu-viel'), null, 99)).toEqual({ ok: false, reason: 'limit' });
    expect(pin(chronik, game('g3'), null, 99).ok).toBe(true); // schon angeheftet
  });

  it('die Ablage merkt nur die letzten Zuglisten und keine zu großen', () => {
    let ablage = {};
    for (let i = 0; i < 15; i++) ablage = stashReplay(ablage, `p${i}`, replay(2), i);
    expect(Object.keys(ablage)).toHaveLength(10);
    expect(Object.keys(ablage)).toContain('p14');
    expect(Object.keys(ablage)).not.toContain('p0');
    const big = replay(MAX_REPLAY_CHARS);
    expect(stashReplay({}, 'big', big, 1)).toEqual({});
  });

  it('beim Zusammenführen gewinnt je Partie die jüngere Änderung; Lösen setzt sich durch', () => {
    const a = pin({}, game('a'), replay(), 10);
    const b = pin({}, game('b'), null, 15);
    if (!a.ok || !b.ok) throw new Error();
    const phone = mergeChronik(a.chronik, b.chronik);
    expect(pinnedList(phone).map((p) => p.id).sort()).toEqual(['a', 'b']);
    // Tablet löst 'a' später
    const tablet = unpin(a.chronik, 'a', 50);
    const merged = mergeChronik(tablet, phone);
    expect(pinnedList(merged).map((p) => p.id)).toEqual(['b']);
    // und das Zusammenführen ist vertauschbar und wiederholbar
    expect(sameChronik(mergeChronik(phone, tablet), merged)).toBe(true);
    expect(sameChronik(mergeChronik(merged, merged), merged)).toBe(true);
    // ein älteres Anheften macht das Lösen nicht rückgängig
    expect(pinnedList(mergeChronik(a.chronik, merged)).map((p) => p.id)).toEqual(['b']);
  });

  it('bei zu viel Inhalt fallen zuerst die Zuglisten der ältesten Partien ab, die Kopfzeilen bleiben', () => {
    // Jede Zugliste passt allein (unter 14 000 Zeichen), zusammen sind es zu viele.
    const chronik = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`g${i}`, { id: `g${i}`, at: 100 + i, game: game(`g${i}`), replay: replay(200, `s${i}`) }]));
    expect(JSON.stringify(chronik).length).toBeGreaterThan(40_000);
    const limited = limit(chronik);
    const all = pinnedList(limited);
    expect(all.map((p) => p.id)).toEqual(['g4', 'g3', 'g2', 'g1', 'g0']);
    expect(JSON.stringify(limited).length).toBeLessThanOrEqual(40_000);
    expect(all.find((p) => p.id === 'g4')!.replay).toBeDefined();
  });

  it('bereinigt fremde Daten', () => {
    expect(sanitizeChronik(null)).toEqual({});
    const dirty = sanitizeChronik({
      ok: { id: 'ok', at: 5, game: game('ok') },
      falsch: { id: 'falsch', at: 5, game: game('anders') },
      kaputt: { at: 'x' },
      'böse id!': { at: 1, deleted: true },
      weg: { at: 7, deleted: true },
      repl: { at: 3, game: game('repl'), replay: { config: { gameId: 'chess' }, log: [] } },
    });
    expect(Object.keys(dirty).sort()).toEqual(['ok', 'repl', 'weg']);
    expect(dirty.repl!.replay).toBeUndefined();
    expect(dirty.weg).toEqual({ id: 'weg', at: 7, deleted: true });
  });
});
