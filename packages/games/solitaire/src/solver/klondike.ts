import { cardRank, type CardId } from '@brett-und-blatt/engine';
import { foundationIndex } from '../common';
import type { KlondikeState, Loc, SolitaireMove } from '../types';
import { Heap } from './heap';

/**
 * Löser für Klondike mit voller Information: Er kennt alle verdeckten Karten und
 * die Reihenfolge des Talons. Im Spiel weiß das niemand – der Löser dient deshalb
 * zwei Zwecken, bei denen das erlaubt ist:
 * - beim Austeilen prüfen, ob eine Partie lösbar ist (dort ist ja alles bekannt),
 * - für den Bot, der die verdeckten Karten mehrfach zufällig belegt und jede
 *   Belegung löst (Stichprobensuche).
 *
 * Verfahren wie beim FreeCell-Löser: Bestensuche mit einer Liste gesehener
 * Stellungen, sichere Ablagezüge sofort. Karten sind Zahlen: Farbe × 16 + Rang.
 */

interface Node {
  down: number[][];
  up: number[][];
  /** Talon; die oberste Karte ist das letzte Element. */
  stock: number[];
  waste: number[];
  found: number[];
  parent: Node | null;
  move: SolitaireMove | null;
  h: number;
}

const rank = (c: number) => c & 15;
const suit = (c: number) => c >> 4;
// Farbreihenfolge wie SUITS (Kreuz, Karo, Herz, Pik): Karo und Herz sind rot.
const red = (c: number) => suit(c) === 1 || suit(c) === 2;

function encode(card: CardId): number {
  return foundationIndex(card) * 16 + cardRank(card);
}

/** Passt `card` auf `target`? Leere Stapel (target undefined) nehmen nur Könige. */
function fits(target: number | undefined, card: number): boolean {
  return target === undefined ? rank(card) === 13 : red(target) !== red(card) && rank(target) === rank(card) + 1;
}

function heuristic(n: Node): number {
  let h = 0;
  for (const f of n.found) h += 13 - f;
  for (const d of n.down) h += d.length * 4;
  return h * 4 + n.stock.length + n.waste.length;
}

function key(n: Node): string {
  return n.down.map((d, i) => `${d.length}:${n.up[i]!.join(',')}`).join('|') + '#' + n.stock.join(',') + '#' + n.waste.join(',') + '#' + n.found.join(',');
}

/** Nimmt `count` Karten von Stapel `i` und deckt bei Bedarf die nächste auf. */
function take(n: Node, i: number, count: number): { down: number[][]; up: number[][] } {
  const down = n.down.slice();
  const up = n.up.slice();
  const rest = up[i]!.slice(0, -count);
  if (rest.length === 0 && down[i]!.length > 0) {
    up[i] = [down[i]![down[i]!.length - 1]!];
    down[i] = down[i]!.slice(0, -1);
  } else {
    up[i] = rest;
  }
  return { down, up };
}

function withFound(found: number[], card: number): number[] {
  return found.map((f, s) => (s === suit(card) ? f + 1 : f));
}

function step(parent: Node, change: Partial<Pick<Node, 'down' | 'up' | 'stock' | 'waste' | 'found'>>, move: SolitaireMove): Node {
  return { down: parent.down, up: parent.up, stock: parent.stock, waste: parent.waste, found: parent.found, ...change, parent, move, h: 0 };
}

/** Sichere Ablagezüge: Eine Karte wird nie mehr gebraucht, wenn beide andersfarbigen Karten eins darunter schon abgelegt sind. */
function autoPlay(n: Node): Node {
  let node = n;
  const safe = (c: number) => {
    if (node.found[suit(c)] !== rank(c) - 1) return false;
    if (rank(c) <= 2) return true;
    const opposite = red(c) ? [0, 3] : [1, 2];
    return opposite.every((s) => (node.found[s] ?? 0) >= rank(c) - 1);
  };
  for (let moved = true; moved; ) {
    moved = false;
    for (let i = 0; i < 7 && !moved; i++) {
      const top = node.up[i]![node.up[i]!.length - 1];
      if (top !== undefined && safe(top)) {
        node = step(node, { ...take(node, i, 1), found: withFound(node.found, top) }, { type: 'move', from: { kind: 'tableau', index: i }, to: { kind: 'foundation', index: suit(top) }, count: 1 });
        moved = true;
      }
    }
    const top = node.waste[node.waste.length - 1];
    if (!moved && top !== undefined && safe(top)) {
      node = step(node, { waste: node.waste.slice(0, -1), found: withFound(node.found, top) }, { type: 'move', from: { kind: 'waste' }, to: { kind: 'foundation', index: suit(top) }, count: 1 });
      moved = true;
    }
  }
  node.h = heuristic(node);
  return node;
}

function expand(n: Node, draw: number): Node[] {
  const out: Node[] = [];
  const add = (change: Parameters<typeof step>[1], move: SolitaireMove) => out.push(autoPlay(step(n, change, move)));
  const wasteTop = n.waste[n.waste.length - 1];
  const firstEmpty = n.up.findIndex((u, i) => u.length === 0 && n.down[i]!.length === 0);

  // Auf die Ablage
  for (let i = 0; i < 7; i++) {
    const top = n.up[i]![n.up[i]!.length - 1];
    if (top !== undefined && n.found[suit(top)] === rank(top) - 1) {
      add({ ...take(n, i, 1), found: withFound(n.found, top) }, { type: 'move', from: { kind: 'tableau', index: i }, to: { kind: 'foundation', index: suit(top) }, count: 1 });
    }
  }
  if (wasteTop !== undefined && n.found[suit(wasteTop)] === rank(wasteTop) - 1) {
    add({ waste: n.waste.slice(0, -1), found: withFound(n.found, wasteTop) }, { type: 'move', from: { kind: 'waste' }, to: { kind: 'foundation', index: suit(wasteTop) }, count: 1 });
  }

  // Stapel → Stapel
  for (let i = 0; i < 7; i++) {
    const up = n.up[i]!;
    for (let count = 1; count <= up.length; count++) {
      const whole = count === up.length;
      if (whole) {
        // Ein ganzer Stapel ohne verdeckte Karten darunter wandert nur, um eine Spalte zu leeren.
        if (n.down[i]!.length === 0 && rank(up[0]!) === 13) continue;
      } else {
        // Teilfolgen nur, wenn die Karte darunter dann auf die Ablage kann.
        const below = up[up.length - count - 1]!;
        if (n.found[suit(below)] !== rank(below) - 1) continue;
      }
      const bottom = up[up.length - count]!;
      for (let j = 0; j < 7; j++) {
        if (j === i) continue;
        const target = n.up[j]!;
        if (target.length === 0 && j !== firstEmpty) continue;
        if (!fits(target[target.length - 1], bottom)) continue;
        const { down, up: ups } = take(n, i, count);
        ups[j] = [...target, ...up.slice(-count)];
        add({ down, up: ups }, { type: 'move', from: { kind: 'tableau', index: i }, to: { kind: 'tableau', index: j }, count });
      }
    }
  }

  // Ablage (Waste) → Stapel
  if (wasteTop !== undefined) {
    for (let j = 0; j < 7; j++) {
      const target = n.up[j]!;
      if (target.length === 0 && j !== firstEmpty) continue;
      if (!fits(target[target.length - 1], wasteTop)) continue;
      const up = n.up.slice();
      up[j] = [...target, wasteTop];
      add({ up, waste: n.waste.slice(0, -1) }, { type: 'move', from: { kind: 'waste' } as Loc, to: { kind: 'tableau', index: j }, count: 1 });
    }
  }

  // Talon
  if (n.stock.length > 0) {
    const k = Math.min(draw, n.stock.length);
    add({ stock: n.stock.slice(0, -k), waste: [...n.waste, ...n.stock.slice(-k).reverse()] }, { type: 'draw' });
  } else if (n.waste.length > 0) {
    add({ stock: [...n.waste].reverse(), waste: [] }, { type: 'recycle' });
  }
  return out;
}

export interface KlondikeSolveResult {
  /** Die Züge bis zum Sieg oder null, wenn keine Lösung gefunden wurde. */
  moves: SolitaireMove[] | null;
  nodes: number;
}

/**
 * Löst eine Klondike-Stellung, in der alle Karten bekannt sind (keine null-Einträge).
 * Ohne `timeBudgetMs` hängt das Ergebnis nur vom Knotenlimit ab – wichtig fürs Austeilen,
 * das aus dem Seed immer gleich ausfallen muss.
 */
export function solveKlondike(state: KlondikeState, options: { maxNodes: number; timeBudgetMs?: number; now?: () => number }): KlondikeSolveResult {
  const now = options.now ?? (() => Date.now());
  const deadline = options.timeBudgetMs === undefined ? Infinity : now() + options.timeBudgetMs;
  const known = (c: CardId | null): number => {
    if (c === null) throw new Error('Der Klondike-Löser braucht alle Karten.');
    return encode(c);
  };
  const start = autoPlay({
    down: state.tableau.map((p) => p.down.map(known)),
    up: state.tableau.map((p) => p.up.map(known)),
    stock: state.stock.map(known),
    waste: state.waste.map(known),
    found: state.foundations.map((f) => f.length),
    parent: null,
    move: null,
    h: 0,
  });
  const done = (n: Node) => n.found.every((f) => f === 13);
  const path = (node: Node): SolitaireMove[] => {
    const moves: SolitaireMove[] = [];
    for (let n: Node | null = node; n?.move; n = n.parent) moves.push(n.move);
    return moves.reverse();
  };
  if (done(start)) return { moves: path(start), nodes: 0 };
  const seen = new Set<string>([key(start)]);
  const open = new Heap<Node>();
  open.push(start);
  let nodes = 0;
  while (open.size > 0) {
    const node = open.pop()!;
    if (++nodes > options.maxNodes || ((nodes & 63) === 0 && now() > deadline)) break;
    for (const next of expand(node, state.draw)) {
      if (done(next)) return { moves: path(next), nodes };
      const k = key(next);
      if (seen.has(k)) continue;
      seen.add(k);
      open.push(next);
    }
  }
  return { moves: null, nodes };
}
