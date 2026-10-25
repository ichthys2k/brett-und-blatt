import { cardRank, type CardId } from '@brett-und-blatt/engine';
import { foundationIndex } from '../common';
import type { FreeCellState, SolitaireMove } from '../types';

/**
 * Löser für FreeCell. Alle Karten liegen offen, deshalb lässt sich eine Partie
 * vollständig durchrechnen. Verfahren: Bestensuche – immer die Stellung zuerst
 * ausbauen, die nach einer Schätzung dem Ziel am nächsten ist – mit einer Liste
 * schon gesehener Stellungen. Sichere Ablagezüge werden sofort ausgeführt.
 *
 * Intern ist jede Karte eine Zahl: Farbe × 16 + Rang, damit die Suche schnell bleibt.
 */

interface Node {
  cols: number[][];
  cells: number[];
  found: number[];
  parent: Node | null;
  move: SolitaireMove | null;
  /** Schätzung, wie weit es noch zum Ziel ist (kleiner ist besser). */
  h: number;
}

const rank = (c: number) => c & 15;
const suit = (c: number) => c >> 4;
// Farbreihenfolge wie SUITS (Kreuz, Karo, Herz, Pik): Karo und Herz sind rot.
const red = (c: number) => suit(c) === 1 || suit(c) === 2;

function encode(card: CardId): number {
  return foundationIndex(card) * 16 + cardRank(card);
}

/** Passt `card` in einer Spalte auf `target`? (absteigend, Farben wechseln) */
function fits(target: number | undefined, card: number): boolean {
  return target === undefined || (red(target) !== red(card) && rank(target) === rank(card) + 1);
}

function heuristic(n: Pick<Node, 'cols' | 'cells' | 'found'>): number {
  let h = 0;
  for (const f of n.found) h += (13 - f) * 4;
  for (const c of n.cells) if (c >= 0) h += 2;
  for (const col of n.cols) {
    // Karten, die über einer niedrigeren Karte liegen, versperren den Weg.
    let lowest = 99;
    for (const c of col) {
      if (rank(c) > lowest) h += 1;
      else lowest = rank(c);
    }
  }
  return h;
}

function key(n: Pick<Node, 'cols' | 'cells' | 'found'>): string {
  // Reihenfolge der Spalten und Zellen spielt keine Rolle.
  return n.cols.map((c) => c.join(',')).sort().join('|') + '#' + [...n.cells].sort((a, b) => a - b).join(',') + '#' + n.found.join(',');
}

function movableCount(cells: number[], cols: number[][], toEmpty: boolean): number {
  const free = cells.filter((c) => c < 0).length;
  const empty = cols.filter((c) => c.length === 0).length - (toEmpty ? 1 : 0);
  return (free + 1) * 2 ** Math.max(0, empty);
}

function child(n: Node, cols: number[][], cells: number[], found: number[], move: SolitaireMove): Node {
  const c: Node = { cols, cells, found, parent: n, move, h: 0 };
  return autoPlay(c);
}

/** Sichere Ablagezüge: Eine Karte wird nie mehr gebraucht, wenn beide andersfarbigen Karten eins darunter schon abgelegt sind. */
function autoPlay(n: Node): Node {
  let node = n;
  for (;;) {
    const safe = (c: number) => {
      if (node.found[suit(c)] !== rank(c) - 1) return false;
      if (rank(c) <= 2) return true;
      const opposite = red(c) ? [0, 3] : [1, 2];
      return opposite.every((s) => (node.found[s] ?? 0) >= rank(c) - 1);
    };
    let moved = false;
    for (let i = 0; i < node.cols.length && !moved; i++) {
      const col = node.cols[i]!;
      const top = col[col.length - 1];
      if (top !== undefined && safe(top)) {
        const cols = node.cols.map((c, j) => (j === i ? c.slice(0, -1) : c));
        const found = node.found.map((f, s) => (s === suit(top) ? f + 1 : f));
        node = { cols, cells: node.cells, found, parent: node, move: { type: 'move', from: { kind: 'tableau', index: i }, to: { kind: 'foundation', index: suit(top) }, count: 1 }, h: 0 };
        moved = true;
      }
    }
    for (let i = 0; i < node.cells.length && !moved; i++) {
      const card = node.cells[i]!;
      if (card >= 0 && safe(card)) {
        const cells = node.cells.map((c, j) => (j === i ? -1 : c));
        const found = node.found.map((f, s) => (s === suit(card) ? f + 1 : f));
        node = { cols: node.cols, cells, found, parent: node, move: { type: 'move', from: { kind: 'cell', index: i }, to: { kind: 'foundation', index: suit(card) }, count: 1 }, h: 0 };
        moved = true;
      }
    }
    if (!moved) break;
  }
  node.h = heuristic(node);
  return node;
}

function expand(n: Node): Node[] {
  const out: Node[] = [];
  const { cols, cells, found } = n;
  const freeCell = cells.indexOf(-1);
  const firstEmpty = cols.findIndex((c) => c.length === 0);

  // Auf die Ablage
  cols.forEach((col, i) => {
    const top = col[col.length - 1];
    if (top !== undefined && found[suit(top)] === rank(top) - 1) {
      out.push(child(n, cols.map((c, j) => (j === i ? c.slice(0, -1) : c)), cells, found.map((f, s) => (s === suit(top) ? f + 1 : f)), { type: 'move', from: { kind: 'tableau', index: i }, to: { kind: 'foundation', index: suit(top) }, count: 1 }));
    }
  });
  cells.forEach((card, i) => {
    if (card >= 0 && found[suit(card)] === rank(card) - 1) {
      out.push(child(n, cols, cells.map((c, j) => (j === i ? -1 : c)), found.map((f, s) => (s === suit(card) ? f + 1 : f)), { type: 'move', from: { kind: 'cell', index: i }, to: { kind: 'foundation', index: suit(card) }, count: 1 }));
    }
  });

  // Zelle → Spalte
  cells.forEach((card, i) => {
    if (card < 0) return;
    cols.forEach((target, j) => {
      if (target.length === 0 && j !== firstEmpty) return;
      if (target.length > 0 && !fits(target[target.length - 1], card)) return;
      out.push(child(n, cols.map((c, k) => (k === j ? [...c, card] : c)), cells.map((c, k) => (k === i ? -1 : c)), found, { type: 'move', from: { kind: 'cell', index: i }, to: { kind: 'tableau', index: j }, count: 1 }));
    });
  });

  // Spalte → Spalte (ganze Folgen, so weit erlaubt)
  cols.forEach((col, i) => {
    if (col.length === 0) return;
    let runLength = 1;
    while (runLength < col.length && fits(col[col.length - runLength - 1], col[col.length - runLength]!)) runLength++;
    cols.forEach((target, j) => {
      if (j === i) return;
      if (target.length === 0) {
        if (j !== firstEmpty) return;
        // In eine leere Spalte die längste mögliche Folge, aber nie die ganze Spalte.
        const count = Math.min(runLength, movableCount(cells, cols, true));
        if (count >= col.length) return;
        out.push(child(n, cols.map((c, k) => (k === i ? c.slice(0, -count) : k === j ? col.slice(-count) : c)), cells, found, { type: 'move', from: { kind: 'tableau', index: i }, to: { kind: 'tableau', index: j }, count }));
        return;
      }
      const top = target[target.length - 1]!;
      // Die Folge muss genau an die Zielkarte anschließen.
      const count = rank(top) - rank(col[col.length - 1]!);
      if (count < 1 || count > runLength || count > movableCount(cells, cols, false)) return;
      if (!fits(top, col[col.length - count]!)) return;
      out.push(child(n, cols.map((c, k) => (k === i ? c.slice(0, -count) : k === j ? [...c, ...col.slice(-count)] : c)), cells, found, { type: 'move', from: { kind: 'tableau', index: i }, to: { kind: 'tableau', index: j }, count }));
    });
  });

  // Spalte → freie Zelle
  if (freeCell >= 0) {
    cols.forEach((col, i) => {
      const top = col[col.length - 1];
      if (top === undefined) return;
      out.push(child(n, cols.map((c, j) => (j === i ? c.slice(0, -1) : c)), cells.map((c, j) => (j === freeCell ? top : c)), found, { type: 'move', from: { kind: 'tableau', index: i }, to: { kind: 'cell', index: freeCell }, count: 1 }));
    });
  }
  return out;
}

/** Einfache Vorrangwarteschlange (binärer Heap) nach Schätzwert. */
class Heap {
  private items: Node[] = [];
  get size() {
    return this.items.length;
  }
  push(node: Node) {
    const a = this.items;
    a.push(node);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p]!.h <= a[i]!.h) break;
      [a[p], a[i]] = [a[i]!, a[p]!];
      i = p;
    }
  }
  pop(): Node | undefined {
    const a = this.items;
    const top = a[0];
    const end = a.pop();
    if (a.length > 0 && end) {
      a[0] = end;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l]!.h < a[m]!.h) m = l;
        if (r < a.length && a[r]!.h < a[m]!.h) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i]!, a[m]!];
        i = m;
      }
    }
    return top;
  }
}

export interface SolveResult {
  /** Die Züge bis zum Sieg (in den Regeln der Spielleitung) oder null, wenn keine Lösung gefunden wurde. */
  moves: SolitaireMove[] | null;
  nodes: number;
}

/** Genaue Lage (mit Spalten- und Zellennummern) – für den Zwischenspeicher, denn Züge nennen Nummern. */
function exactKey(n: Pick<Node, 'cols' | 'cells' | 'found'>): string {
  return n.cols.map((c) => c.join(',')).join('|') + '#' + n.cells.join(',') + '#' + n.found.join(',');
}

/** Zuletzt gefundene Lösung: Stellung → restliche Züge. Wer dem Tipp folgt, bekommt den nächsten sofort. */
let cache = new Map<string, SolitaireMove[]>();

function remember(node: Node): SolitaireMove[] {
  const chain: Node[] = [];
  for (let n: Node | null = node; n; n = n.parent) chain.push(n);
  chain.reverse();
  const moves = chain.slice(1).map((n) => n.move as SolitaireMove);
  cache = new Map();
  chain.forEach((n, i) => {
    if (i < moves.length) cache.set(exactKey(n), moves.slice(i));
  });
  return moves;
}

export function solveFreeCell(state: FreeCellState, options: { timeBudgetMs: number; now?: () => number; maxNodes?: number }): SolveResult {
  const now = options.now ?? (() => Date.now());
  const deadline = now() + options.timeBudgetMs;
  const maxNodes = options.maxNodes ?? 200_000;
  const start: Node = {
    cols: state.tableau.map((col) => col.map(encode)),
    cells: state.cells.map((c) => (c === null ? -1 : encode(c))),
    found: state.foundations.map((f) => f.length),
    parent: null,
    move: null,
    h: 0,
  };
  start.h = heuristic(start);
  const known = cache.get(exactKey(start));
  if (known) return { moves: known, nodes: 0 };
  const seen = new Set<string>([key(start)]);
  const open = new Heap();
  open.push(start);
  let nodes = 0;
  while (open.size > 0) {
    const node = open.pop()!;
    if (node.found.every((f) => f === 13)) return { moves: remember(node), nodes };
    if (++nodes > maxNodes || ((nodes & 63) === 0 && now() > deadline)) break;
    for (const next of expand(node)) {
      if (next.found.every((f) => f === 13)) return { moves: remember(next), nodes };
      const k = key(next);
      if (seen.has(k)) continue;
      seen.add(k);
      open.push(next);
    }
  }
  return { moves: null, nodes };
}
