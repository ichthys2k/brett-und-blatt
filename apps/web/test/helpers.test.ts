import { describe, expect, it } from 'vitest';
import {
  computeScoreTotals,
  formatCountdownMs,
  parseCustomFaces,
  parseEntryList,
  randomInt,
  rankScorePlayers,
  rollDiceSet,
  splitIntoTeams,
  sumNumericDice,
} from '../src/lib/helpers';
import { parseRoute } from '../src/lib/router';

describe('Spielhelfer-Logik (#106)', () => {
  it('parst #/helfer und alle fünf Werkzeug-Routen', () => {
    expect(parseRoute('#/helfer')).toEqual({ name: 'helpers' });
    expect(parseRoute('#/helfer/wuerfel')).toEqual({ name: 'helpers', tool: 'wuerfel' });
    expect(parseRoute('#/helfer/zufall')).toEqual({ name: 'helpers', tool: 'zufall' });
    expect(parseRoute('#/helfer/startspieler')).toEqual({ name: 'helpers', tool: 'startspieler' });
    expect(parseRoute('#/helfer/uhren')).toEqual({ name: 'helpers', tool: 'uhren' });
    expect(parseRoute('#/helfer/punkte')).toEqual({ name: 'helpers', tool: 'punkte' });
    expect(parseRoute('#/helfer/unbekannt')).toEqual({ name: 'helpers' });
  });

  it('erzeugt gleichverteilte Zufallszahlen innerhalb der Grenzen', () => {
    for (let i = 0; i < 40; i++) {
      const val = randomInt(3, 7);
      expect(val).toBeGreaterThanOrEqual(3);
      expect(val).toBeLessThanOrEqual(7);
    }
    expect(randomInt(5, 5)).toBe(5);
    expect(randomInt(10, 2, () => 0)).toBe(2);
  });

  it('würfelt 1 bis 10 Würfel und behält gehaltene Würfel bei', () => {
    const first = rollDiceSet([], 3, 'd6', [], () => 0.5);
    expect(first).toHaveLength(3);
    expect(first.every((d) => d.numeric === 4)).toBe(true);

    const withHold = first.map((d, idx) => (idx === 1 ? { ...d, held: true } : d));
    const second = rollDiceSet(withHold, 4, 'd6', [], () => 0.99);
    expect(second).toHaveLength(4);
    expect(second[0]?.numeric).toBe(6);
    expect(second[1]?.numeric).toBe(4);
    expect(second[1]?.held).toBe(true);
    expect(second[3]?.numeric).toBe(6);
    expect(sumNumericDice(second)).toBe(22);
  });

  it('unterstützt eigene Würfelseiten und gibt null als Summe für Symbole zurück', () => {
    const faces = parseCustomFaces('🔴, 🔵, 🟢');
    expect(faces).toEqual(['🔴', '🔵', '🟢']);
    const custom = rollDiceSet([], 2, 'custom', faces, () => 0);
    expect(custom.map((d) => d.label)).toEqual(['🔴', '🔴']);
    expect(sumNumericDice(custom)).toBeNull();

    const emptyFallback = parseCustomFaces('   ');
    expect(emptyFallback).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  it('teilt Namen gleichmäßig in Teams auf', () => {
    const names = parseEntryList('Anna\nBen, Clara; David\nEva');
    expect(names).toEqual(['Anna', 'Ben', 'Clara', 'David', 'Eva']);
    const teams = splitIntoTeams(names, 2, () => 0.1);
    expect(teams).toHaveLength(2);
    expect(teams[0]!.length + teams[1]!.length).toBe(5);
    expect(Math.abs(teams[0]!.length - teams[1]!.length)).toBeLessThanOrEqual(1);
  });

  it('berechnet Rundensummen und Rangliste inklusive Gleichstand', () => {
    const players = [
      { id: 'a', name: 'Anna' },
      { id: 'b', name: 'Ben' },
      { id: 'c', name: 'Clara' },
    ];
    const rounds = [
      { id: 1, scores: { a: 10, b: 15, c: 15 } },
      { id: 2, scores: { a: 5, b: 10, c: 10 } },
    ];
    const totals = computeScoreTotals(players, rounds);
    expect(totals).toEqual({ a: 15, b: 25, c: 25 });

    const desc = rankScorePlayers(players, totals, 'desc');
    expect(desc.map((r) => [r.player.id, r.rank, r.total])).toEqual([
      ['b', 1, 25],
      ['c', 1, 25],
      ['a', 3, 15],
    ]);

    const asc = rankScorePlayers(players, totals, 'asc');
    expect(asc[0]?.player.id).toBe('a');
    expect(asc[0]?.rank).toBe(1);
  });

  it('formatiert Countdown-Zeiten sauber', () => {
    expect(formatCountdownMs(0)).toBe('00:00');
    expect(formatCountdownMs(500)).toBe('00:01');
    expect(formatCountdownMs(65_000)).toBe('01:05');
  });
});
