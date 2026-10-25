import { describe, expect, it } from 'vitest';
import { Clocks } from '../src';

describe('Clocks', () => {
  it('Zugzeit ohne Zeitbank läuft nach der Zugzeit ab', () => {
    const clocks = new Clocks({ kind: 'perMove', moveMs: 10_000 }, 2);
    clocks.start(0, 0);
    expect(clocks.read(0, 4_000)).toMatchObject({ leftMs: 6_000, expired: false });
    expect(clocks.isExpired(0, 10_001)).toBe(true);
    expect(clocks.isExpired(1, 10_001)).toBe(false);
  });

  it('Zugzeit mit Zeitbank: Überziehen verbraucht die Bank, die nächste Zugzeit ist wieder voll', () => {
    const clocks = new Clocks({ kind: 'perMove', moveMs: 10_000, bankMs: 30_000 }, 2);
    clocks.start(0, 0);
    expect(clocks.read(0, 15_000)).toMatchObject({ leftMs: 0, bankLeftMs: 25_000, usingBank: true, expired: false });
    clocks.stop(0, 15_000);
    clocks.start(0, 20_000);
    expect(clocks.read(0, 20_000)).toMatchObject({ leftMs: 10_000, bankLeftMs: 25_000 });
    expect(clocks.isExpired(0, 20_000 + 10_000 + 25_000)).toBe(true);
  });

  it('Schachuhr zieht verbrauchte Zeit ab und schreibt den Zuschlag gut', () => {
    const clocks = new Clocks({ kind: 'chessClock', baseMs: 60_000, incrementMs: 2_000 }, 2);
    clocks.start(0, 0);
    clocks.stop(0, 10_000);
    expect(clocks.read(0, 10_000).leftMs).toBe(52_000);
    clocks.start(0, 20_000);
    expect(clocks.isExpired(0, 20_000 + 52_000)).toBe(true);
  });

  it('Pause hält alle laufenden Uhren an', () => {
    const clocks = new Clocks({ kind: 'perMove', moveMs: 10_000 }, 2);
    clocks.start(0, 0);
    clocks.pause(3_000);
    expect(clocks.read(0, 50_000).leftMs).toBe(7_000);
    clocks.resume(50_000);
    expect(clocks.read(0, 52_000).leftMs).toBe(5_000);
  });

  it('ohne Uhr läuft nie etwas ab', () => {
    const clocks = new Clocks({ kind: 'none' }, 2);
    clocks.start(0, 0);
    expect(clocks.isExpired(0, 1e12)).toBe(false);
    expect(clocks.enabled).toBe(false);
  });
});
