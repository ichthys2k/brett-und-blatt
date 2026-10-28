import { BOARD_SIZE, CENTER } from './board';
import { forEachEdge, ROOT, step, type DictNode } from './dict';
import type { Letter, Tile } from './letters';
import type { BoardCell, PlacedTile } from './rules';

/**
 * Zuggenerator nach Appel & Jacobson: Für jedes Ankerfeld (frei, neben einem Stein) werden
 * linke Teile aus dem Bänkchen gebildet und nach rechts durch den Präfixbaum verlängert.
 * Querprüfungen sorgen dafür, dass auch alle senkrecht entstehenden Wörter gültig sind.
 * Senkrechte Legungen entstehen auf dem gespiegelten Brett.
 */

const N = BOARD_SIZE;
type Grid = (Letter | null)[];

/** Darf auf diesem freien Feld ein Buchstabe liegen, ohne ein ungültiges Querwort zu bilden? */
function crossChecks(grid: Grid): (Set<string> | null)[] {
  const checks: (Set<string> | null)[] = Array(N * N).fill(null);
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (grid[r * N + c]) continue;
      let up = '';
      for (let rr = r - 1; rr >= 0 && grid[rr * N + c]; rr--) up = grid[rr * N + c] + up;
      let down = '';
      for (let rr = r + 1; rr < N && grid[rr * N + c]; rr++) down += grid[rr * N + c];
      if (!up && !down) continue;
      // Präfix „up“ im Graphen suchen, dann jeden Buchstaben samt „down“ prüfen.
      const allowed = new Set<string>();
      let node: DictNode | null = ROOT;
      for (const ch of up) node = node === null ? null : (step(node, ch)?.node ?? null);
      if (node !== null) {
        forEachEdge(node, (ch, child, endHere) => {
          let n: DictNode = child;
          let end = endHere;
          for (const d of down) {
            const next = step(n, d);
            if (!next) return;
            n = next.node;
            end = next.end;
          }
          if (end) allowed.add(ch);
        });
      }
      checks[r * N + c] = allowed;
    }
  }
  return checks;
}

function generateRows(grid: Grid, rack: Tile[], emptyBoard: boolean, emit: (row: number, cells: { col: number; letter: Letter; blank: boolean }[]) => void) {
  const checks = crossChecks(grid);
  const counts = new Map<string, number>();
  for (const t of rack) counts.set(t, (counts.get(t) ?? 0) + 1);
  const at = (r: number, c: number) => (c >= 0 && c < N ? grid[r * N + c] : null);

  for (let r = 0; r < N; r++) {
    const isAnchor = (c: number) =>
      !at(r, c) &&
      (emptyBoard
        ? r === CENTER && c === CENTER
        : !!at(r, c - 1) || !!at(r, c + 1) || (r > 0 && !!grid[(r - 1) * N + c]) || (r < N - 1 && !!grid[(r + 1) * N + c]));
    const placed: { col: number; letter: Letter; blank: boolean }[] = [];

    const use = (tile: string) => {
      counts.set(tile, counts.get(tile)! - 1);
    };
    const unuse = (tile: string) => {
      counts.set(tile, counts.get(tile)! + 1);
    };

    // `end`: Endet mit dem zuletzt gelegten Buchstaben ein Wort?
    const extendRight = (node: DictNode, end: boolean, col: number, anchor: number) => {
      const here = at(r, col);
      if (col >= N || !here) {
        if (end && col > anchor && placed.length > 0) emit(r, placed.map((p) => ({ ...p })));
        if (col >= N) return;
        const allowed = checks[r * N + col];
        forEachEdge(node, (ch, child, childEnd) => {
          if (allowed && !allowed.has(ch)) return;
          if ((counts.get(ch) ?? 0) > 0) {
            use(ch);
            placed.push({ col, letter: ch as Letter, blank: false });
            extendRight(child, childEnd, col + 1, anchor);
            placed.pop();
            unuse(ch);
          }
          if ((counts.get('?') ?? 0) > 0) {
            use('?');
            placed.push({ col, letter: ch as Letter, blank: true });
            extendRight(child, childEnd, col + 1, anchor);
            placed.pop();
            unuse('?');
          }
        });
      } else {
        const next = step(node, here);
        if (next) extendRight(next.node, next.end, col + 1, anchor);
      }
    };

    // Linke Teile aus dem Bänkchen auf freie Felder ohne Nachbarn links vom Anker.
    const leftPart = (node: DictNode, end: boolean, limit: number, anchor: number) => {
      extendRight(node, end, anchor, anchor);
      if (limit <= 0) return;
      forEachEdge(node, (ch, child, childEnd) => {
        for (const tile of [ch, '?']) {
          if ((counts.get(tile) ?? 0) <= 0) continue;
          use(tile);
          // Vorne einfügen: alle bisherigen linken Steine rücken eins nach links.
          for (const p of placed) p.col -= 1;
          placed.push({ col: anchor - 1, letter: ch as Letter, blank: tile === '?' });
          leftPart(child, childEnd, limit - 1, anchor);
          placed.pop();
          for (const p of placed) p.col += 1;
          unuse(tile);
        }
      });
    };

    for (let c = 0; c < N; c++) {
      if (!isAnchor(c)) continue;
      if (at(r, c - 1)) {
        // Links liegt schon ein Wortanfang: der ist fest.
        let start = c - 1;
        while (at(r, start - 1)) start--;
        let node: DictNode | null = ROOT;
        let end = false;
        for (let k = start; k < c && node !== null; k++) {
          const next = step(node, at(r, k)!);
          node = next?.node ?? null;
          end = next?.end ?? false;
        }
        if (node !== null) extendRight(node, end, c, c);
      } else {
        let limit = 0;
        while (c - limit - 1 >= 0 && !at(r, c - limit - 1) && !isAnchor(c - limit - 1)) limit++;
        leftPart(ROOT, false, Math.min(limit, rack.length - 1), c);
      }
    }
  }
}

/** Alle gültigen Legungen für dieses Bänkchen (ohne Doppelte). */
export function generatePlays(board: readonly (BoardCell | null)[], rack: Tile[]): PlacedTile[][] {
  if (rack.length === 0) return [];
  const grid: Grid = board.map((c) => c?.letter ?? null);
  const transposed: Grid = Array(N * N).fill(null);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) transposed[c * N + r] = grid[r * N + c]!;
  const emptyBoard = grid.every((c) => c === null);
  const seen = new Set<string>();
  const plays: PlacedTile[][] = [];
  const add = (tiles: PlacedTile[]) => {
    const key = tiles
      .map((t) => `${t.row}.${t.col}${t.blank ? '*' : ''}${t.letter}`)
      .sort()
      .join('|');
    if (seen.has(key)) return;
    seen.add(key);
    plays.push(tiles);
  };
  generateRows(grid, rack, emptyBoard, (row, cells) => add(cells.map(({ col, letter, blank }) => ({ row, col, letter, ...(blank ? { blank } : {}) }))));
  generateRows(transposed, rack, emptyBoard, (row, cells) => add(cells.map(({ col, letter, blank }) => ({ row: col, col: row, letter, ...(blank ? { blank } : {}) }))));
  return plays;
}
