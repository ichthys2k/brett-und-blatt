import { BOARD_SIZE, CENTER } from './board';
import { trieRoot, type TrieNode } from './dict';
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
      // Präfix „up“ im Baum suchen, dann jeden Buchstaben samt „down“ prüfen.
      const allowed = new Set<string>();
      let node: TrieNode | undefined = trieRoot;
      for (const ch of up) node = node?.next.get(ch);
      if (node) {
        for (const [ch, child] of node.next) {
          let n: TrieNode | undefined = child;
          for (const d of down) n = n?.next.get(d);
          if (n?.end) allowed.add(ch);
        }
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

    const extendRight = (node: TrieNode, col: number, anchor: number) => {
      const here = at(r, col);
      if (col >= N || !here) {
        if (node.end && col > anchor && placed.length > 0) emit(r, placed.map((p) => ({ ...p })));
        if (col >= N) return;
        const allowed = checks[r * N + col];
        for (const [ch, child] of node.next) {
          if (allowed && !allowed.has(ch)) continue;
          if ((counts.get(ch) ?? 0) > 0) {
            use(ch);
            placed.push({ col, letter: ch as Letter, blank: false });
            extendRight(child, col + 1, anchor);
            placed.pop();
            unuse(ch);
          }
          if ((counts.get('?') ?? 0) > 0) {
            use('?');
            placed.push({ col, letter: ch as Letter, blank: true });
            extendRight(child, col + 1, anchor);
            placed.pop();
            unuse('?');
          }
        }
      } else {
        const child = node.next.get(here);
        if (child) extendRight(child, col + 1, anchor);
      }
    };

    // Linke Teile aus dem Bänkchen auf freie Felder ohne Nachbarn links vom Anker.
    const leftPart = (node: TrieNode, limit: number, anchor: number, length: number) => {
      // Die bisher gelegten linken Steine liegen auf anchor-length … anchor-1.
      extendRight(node, anchor, anchor);
      if (limit <= 0) return;
      for (const [ch, child] of node.next) {
        for (const tile of [ch, '?']) {
          if ((counts.get(tile) ?? 0) <= 0) continue;
          use(tile);
          // Vorne einfügen: alle bisherigen linken Steine rücken eins nach links.
          for (const p of placed) p.col -= 1;
          placed.push({ col: anchor - 1, letter: ch as Letter, blank: tile === '?' });
          leftPart(child, limit - 1, anchor, length + 1);
          placed.pop();
          for (const p of placed) p.col += 1;
          unuse(tile);
        }
      }
    };

    for (let c = 0; c < N; c++) {
      if (!isAnchor(c)) continue;
      if (at(r, c - 1)) {
        // Links liegt schon ein Wortanfang: der ist fest.
        let start = c - 1;
        while (at(r, start - 1)) start--;
        let node: TrieNode | undefined = trieRoot;
        for (let k = start; k < c; k++) node = node?.next.get(at(r, k)!);
        if (node) extendRight(node, c, c);
      } else {
        let limit = 0;
        while (c - limit - 1 >= 0 && !at(r, c - limit - 1) && !isAnchor(c - limit - 1)) limit++;
        leftPart(trieRoot, Math.min(limit, rack.length - 1), c, 0);
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
