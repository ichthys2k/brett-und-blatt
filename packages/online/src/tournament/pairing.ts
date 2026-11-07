import type { MatchSlot, SlotSource } from './types';

/** Reine Bausteine für Auslosung und Paarungen, ohne Zustand. */

/** Kleiner Zufallsstrom aus dem Seed: dieselbe Auslosung bei jeder Wiederherstellung. */
function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const random = seededRandom(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Gruppenzahl: die größte Zweierpotenz, bei der jede Gruppe mindestens drei Spieler hat. */
export function groupCountFor(players: number): number {
  let groups = 2;
  while (Math.floor(players / (groups * 2)) >= 3) groups *= 2;
  return groups;
}

/** Runden im Schweizer System wie im Plan: 8 → 5, 16 → 6, 32 → 7, nie mehr als Gegner da sind. */
export function swissRoundsFor(players: number): number {
  return Math.min(players - 1, Math.ceil(Math.log2(players)) + 2);
}

/** Jeder gegen jeden nach dem Kreisverfahren; die Heimseite wechselt. */
export function roundRobinPairs<T>(players: readonly T[]): [T, T][] {
  const list: (T | null)[] = [...players];
  if (list.length % 2 === 1) list.push(null);
  const rounds = list.length - 1;
  const pairs: [T, T][] = [];
  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < list.length / 2; i++) {
      const a = list[i]!;
      const b = list[list.length - 1 - i]!;
      if (a !== null && b !== null) pairs.push(round % 2 === 0 ? [a, b] : [b, a]);
    }
    list.splice(1, 0, list.pop()!);
  }
  return pairs;
}

/** Erste K.-o.-Runde: Gruppensieger gegen Zweite; Spieler derselben Gruppe treffen sich erst im Finale. */
export function koFirstRound(groups: number): [SlotSource, SlotSource][] {
  const top: [SlotSource, SlotSource][] = [];
  const bottom: [SlotSource, SlotSource][] = [];
  for (let g = 0; g < groups; g += 2) {
    top.push([{ kind: 'groupPlace', group: g, place: 0 }, { kind: 'groupPlace', group: g + 1, place: 1 }]);
    bottom.push([{ kind: 'groupPlace', group: g + 1, place: 0 }, { kind: 'groupPlace', group: g, place: 1 }]);
  }
  return [...top, ...bottom];
}

/**
 * Setzliste eines Baums: Platz 1 und 2 treffen sich erst im Finale. Die Positionen je
 * zwei Einträge bilden eine Partie der ersten Runde; Setzplätze über der Spielerzahl sind Freilose.
 */
export function seedOrder(size: number): number[] {
  let order = [0];
  while (order.length < size) {
    const next = order.length * 2 - 1;
    order = order.flatMap((seed) => [seed, next - seed]);
  }
  return order;
}

/** Erste Runde eines Baums; ein Freilos steht immer auf der zweiten Seite. */
export function firstRoundSlots(ids: readonly string[]): [MatchSlot, MatchSlot][] {
  let size = 2;
  while (size < ids.length) size *= 2;
  const order = seedOrder(size);
  const pairs: [MatchSlot, MatchSlot][] = [];
  for (let i = 0; i < size; i += 2) {
    const [a, b] = [order[i]!, order[i + 1]!].sort((x, y) => x - y) as [number, number];
    pairs.push([{ player: ids[a] ?? null }, { player: ids[b] ?? null }]);
  }
  return pairs;
}

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Paart nach Tabellenstand ohne Wiederholung (mit Rücksetzen); bei ungerader Zahl das Freilos für den Letzten ohne Freilos. */
export function swissPairing(ranked: readonly string[], played: ReadonlySet<string>, hadBye: ReadonlySet<string>): { pairs: [string, string][]; bye: string | null } {
  let list = [...ranked];
  let bye: string | null = null;
  if (list.length % 2 === 1) {
    bye = [...list].reverse().find((p) => !hadBye.has(p)) ?? list[list.length - 1]!;
    list = list.filter((p) => p !== bye);
  }
  const search = (rest: string[]): [string, string][] | null => {
    if (rest.length === 0) return [];
    const [first, ...others] = rest;
    for (const other of others) {
      if (played.has(pairKey(first!, other))) continue;
      const below = search(others.filter((p) => p !== other));
      if (below) return [[first!, other], ...below];
    }
    return null;
  };
  // Geht es ohne Wiederholung nicht (viele Rückzüge), wird der Reihe nach gepaart.
  const pairs = search(list) ?? list.flatMap((p, i) => (i % 2 === 0 ? [[p, list[i + 1]!] as [string, string]] : []));
  return { pairs, bye };
}

export const winnerOf = (match: string): MatchSlot => ({ player: null, from: { kind: 'winner', match } });
export const loserOf = (match: string): MatchSlot => ({ player: null, from: { kind: 'loser', match } });
