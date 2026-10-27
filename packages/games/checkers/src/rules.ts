/**
 * Die Regeln von Dame.
 *
 * Diese Datei ist das Lehrbeispiel für neue Spiele. Jede Funktion ist „rein“:
 * Sie bekommt einen Spielstand und gibt einen neuen zurück, ohne den alten zu
 * verändern. Sie weiß nichts von Bildschirm, Uhr oder Netzwerk – darum läuft
 * derselbe Code im Browser, im Bot-Worker, in den Tests und später auf dem Server.
 */
import type { Actor, GameEvent, MoveResult, Options, Result, SeatId } from '@brett-und-blatt/engine';

export type CheckersVariant = 'german' | 'international' | 'english';

export interface CheckersPiece {
  /** 0 = Weiß (unten, zieht aufwärts), 1 = Schwarz (oben, zieht abwärts). */
  seat: SeatId;
  king: boolean;
}

export interface CheckersState {
  size: number;
  /** Felder zeilenweise von oben links (Index 0 = a8 bzw. a10). */
  cells: (CheckersPiece | null)[];
  turn: SeatId;
  winner: SeatId | null;
  end: 'captured' | 'blocked' | 'repetition' | 'drawMoves' | null;
  /** Wie oft jede Stellung vorkam (für 3-fache Wiederholung). */
  positions: Record<string, number>;
  /** Partieverlauf in algebraischer Schreibweise, z. B. ["c3-d4", "d6-c5", "b2-c3", "c5:e3:g5"]. */
  history: string[];
  lastMove: { from: number; to: number } | null;
  /** Halbzüge ohne Schlagen und ohne Vorrücken eines Steins. */
  sinceCaptureOrAdvance: number;
  variant: CheckersVariant;
  rotate?: boolean;
}

export interface CheckersMove {
  type: 'move';
  from: number;
  to: number;
  /** Zwischenstationen bei Mehrfachsprüngen. */
  path?: number[];
  /** Feld-Indizes der geschlagenen Steine in Schlagreihenfolge. */
  captures?: number[];
  /** Algebraische Notation, z. B. "c3-d4" oder "c3:e5:g7". */
  san: string;
}

const FILES = 'abcdefghij';

export function isDarkSquare(col: number, row: number): boolean {
  return (col + row) % 2 === 1;
}

export function squareName(index: number, size: number): string {
  const col = index % size;
  const row = Math.floor(index / size);
  return `${FILES[col]}${size - row}`;
}

export function squareIndex(name: string, size: number): number {
  const col = FILES.indexOf(name[0] ?? 'a');
  const rank = Number(name.slice(1));
  const row = size - rank;
  return row * size + col;
}

export function positionKey(state: Pick<CheckersState, 'cells' | 'turn'>): string {
  const chars = state.cells.map((c) => {
    if (!c) return '.';
    if (c.seat === 0) return c.king ? 'W' : 'w';
    return c.king ? 'B' : 'b';
  });
  return `${state.turn}:${chars.join('')}`;
}

export function setup(_seats = 2, options: Options = {}): CheckersState {
  const size = options.size === '10' ? 10 : 8;
  const variant: CheckersVariant =
    options.variant === 'international' ? 'international' : options.variant === 'english' ? 'english' : 'german';
  const rotate = options.board !== 'fixed';

  const cells: (CheckersPiece | null)[] = Array(size * size).fill(null);
  const rowsPerSide = size === 10 ? 4 : 3;

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!isDarkSquare(col, row)) continue;
      const index = row * size + col;
      if (row < rowsPerSide) {
        cells[index] = { seat: 1, king: false };
      } else if (row >= size - rowsPerSide) {
        cells[index] = { seat: 0, king: false };
      }
    }
  }

  const initialKey = positionKey({ cells, turn: 0 });

  return {
    size,
    cells,
    turn: 0,
    winner: null,
    end: null,
    positions: { [initialKey]: 1 },
    history: [],
    lastMove: null,
    sinceCaptureOrAdvance: 0,
    variant,
    rotate,
  };
}

export function currentPlayers(state: CheckersState): Actor[] {
  return state.end !== null ? [] : [state.turn];
}

const ALL_DIRECTIONS: readonly [number, number][] = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

function inBounds(col: number, row: number, size: number): boolean {
  return col >= 0 && col < size && row >= 0 && row < size;
}

/**
 * Sucht rekursiv alle vollständigen Schlagketten ausgehend von einem Stein.
 */
function collectCaptures(
  cells: (CheckersPiece | null)[],
  size: number,
  variant: CheckersVariant,
  from: number,
  current: number,
  piece: CheckersPiece,
  captured: number[],
  path: number[],
  results: CheckersMove[],
): void {
  const col = current % size;
  const row = Math.floor(current / size);
  const capturedSet = new Set(captured);
  const forwardDr = piece.seat === 0 ? -1 : 1;
  const isFlying = piece.king && variant !== 'english';

  let foundExtension = false;

  if (!piece.king) {
    // Einfacher Stein
    const dirs: readonly [number, number][] =
      variant === 'international' ? ALL_DIRECTIONS : [[forwardDr, -1], [forwardDr, 1]];

    for (const [dr, dc] of dirs) {
      const midR = row + dr;
      const midC = col + dc;
      const landR = row + 2 * dr;
      const landC = col + 2 * dc;

      if (!inBounds(landC, landR, size)) continue;

      const midIdx = midR * size + midC;
      const landIdx = landR * size + landC;

      const midPiece = cells[midIdx];
      if (!midPiece || midPiece.seat === piece.seat || capturedSet.has(midIdx)) continue;

      // Landefeld muss frei sein oder das ursprüngliche Startfeld der Sprungkette
      if (cells[landIdx] !== null && landIdx !== from) continue;

      foundExtension = true;
      const nextCaptured = [...captured, midIdx];
      const nextPath = [...path, landIdx];

      // Prüfen, ob der Stein auf der Grundlinie ankommt
      const reachesCrown =
        (piece.seat === 0 && landR === 0) || (piece.seat === 1 && landR === size - 1);

      if (reachesCrown) {
        // Standard (deutsch/international): Auf der Grundreihe endet der Zug, Stein wird gekrönt
        const san = [squareName(from, size), ...nextPath.map((p) => squareName(p, size))].join(':');
        results.push({ type: 'move', from, to: landIdx, path: nextPath, captures: nextCaptured, san });
      } else {
        collectCaptures(cells, size, variant, from, landIdx, piece, nextCaptured, nextPath, results);
      }
    }
  } else if (!isFlying) {
    // Kurze Dame (Englisch)
    for (const [dr, dc] of ALL_DIRECTIONS) {
      const midR = row + dr;
      const midC = col + dc;
      const landR = row + 2 * dr;
      const landC = col + 2 * dc;

      if (!inBounds(landC, landR, size)) continue;

      const midIdx = midR * size + midC;
      const landIdx = landR * size + landC;

      const midPiece = cells[midIdx];
      if (!midPiece || midPiece.seat === piece.seat || capturedSet.has(midIdx)) continue;
      if (cells[landIdx] !== null && landIdx !== from) continue;

      foundExtension = true;
      const nextCaptured = [...captured, midIdx];
      const nextPath = [...path, landIdx];
      collectCaptures(cells, size, variant, from, landIdx, piece, nextCaptured, nextPath, results);
    }
  } else {
    // Fliegende Dame (Klassisch Deutsch / International)
    for (const [dr, dc] of ALL_DIRECTIONS) {
      let r = row + dr;
      let c = col + dc;

      // Leere Felder vor dem geschlagenen Stein überspringen
      while (inBounds(c, r, size) && (cells[r * size + c] === null || r * size + c === from)) {
        r += dr;
        c += dc;
      }

      if (!inBounds(c, r, size)) continue;

      const midIdx = r * size + c;
      const midPiece = cells[midIdx];
      if (!midPiece || midPiece.seat === piece.seat || capturedSet.has(midIdx)) continue;

      // Nach dem gegnerischen Stein: freie Landefelder dahinter durchsuchen
      let landR = r + dr;
      let landC = c + dc;

      while (inBounds(landC, landR, size) && (cells[landR * size + landC] === null || landR * size + landC === from)) {
        foundExtension = true;
        const landIdx = landR * size + landC;
        const nextCaptured = [...captured, midIdx];
        const nextPath = [...path, landIdx];
        collectCaptures(cells, size, variant, from, landIdx, piece, nextCaptured, nextPath, results);

        landR += dr;
        landC += dc;
      }
    }
  }

  // Wenn keine Verlängerung möglich war, aber zuvor bereits geschlagen wurde, ist dies ein fertiger Schlagzug!
  if (!foundExtension && captured.length > 0) {
    const san = [squareName(from, size), ...path.map((p) => squareName(p, size))].join(':');
    results.push({ type: 'move', from, to: current, path, captures: captured, san });
  }
}

/**
 * Ermittelt alle legalen Züge.
 * Bei Schlagpflicht: Gibt es Schlagzüge, DÜRFEN nur Schlagzüge ausgeführt werden.
 */
export function legalMoves(state: CheckersState, actor: Actor): CheckersMove[] {
  if (state.end !== null || actor !== state.turn) return [];

  const { cells, size, variant } = state;
  const allCaptures: CheckersMove[] = [];

  for (let i = 0; i < cells.length; i++) {
    const piece = cells[i];
    if (piece && piece.seat === actor) {
      collectCaptures(cells, size, variant, i, i, piece, [], [], allCaptures);
    }
  }

  // Deduplizieren (falls durch Wegverzweigung identische Züge entstanden)
  const uniqueCaptures = deduplicateMoves(allCaptures);

  if (uniqueCaptures.length > 0) {
    if (variant === 'international') {
      // Mehrheitszwang: Nur Züge mit der maximalen Anzahl geschlagener Steine sind erlaubt
      const maxCap = Math.max(...uniqueCaptures.map((m) => m.captures?.length ?? 0));
      return uniqueCaptures.filter((m) => (m.captures?.length ?? 0) === maxCap);
    }
    return uniqueCaptures;
  }

  // Keine Schläge möglich: Einfache Züge
  const simpleMoves: CheckersMove[] = [];
  const forwardDr = actor === 0 ? -1 : 1;

  for (let i = 0; i < cells.length; i++) {
    const piece = cells[i];
    if (!piece || piece.seat !== actor) continue;

    const col = i % size;
    const row = Math.floor(i / size);

    if (!piece.king) {
      for (const dc of [-1, 1]) {
        const nextCol = col + dc;
        const nextRow = row + forwardDr;
        if (!inBounds(nextCol, nextRow, size)) continue;
        const to = nextRow * size + nextCol;
        if (cells[to] === null) {
          simpleMoves.push({
            type: 'move',
            from: i,
            to,
            san: `${squareName(i, size)}-${squareName(to, size)}`,
          });
        }
      }
    } else if (variant === 'english') {
      // Kurze Dame
      for (const [dr, dc] of ALL_DIRECTIONS) {
        const nextCol = col + dc;
        const nextRow = row + dr;
        if (!inBounds(nextCol, nextRow, size)) continue;
        const to = nextRow * size + nextCol;
        if (cells[to] === null) {
          simpleMoves.push({
            type: 'move',
            from: i,
            to,
            san: `${squareName(i, size)}-${squareName(to, size)}`,
          });
        }
      }
    } else {
      // Fliegende Dame
      for (const [dr, dc] of ALL_DIRECTIONS) {
        let r = row + dr;
        let c = col + dc;
        while (inBounds(c, r, size) && cells[r * size + c] === null) {
          const to = r * size + c;
          simpleMoves.push({
            type: 'move',
            from: i,
            to,
            san: `${squareName(i, size)}-${squareName(to, size)}`,
          });
          r += dr;
          c += dc;
        }
      }
    }
  }

  return simpleMoves;
}

function deduplicateMoves(moves: CheckersMove[]): CheckersMove[] {
  const seen = new Set<string>();
  const list: CheckersMove[] = [];
  for (const m of moves) {
    const key = `${m.from}->${m.to}:${(m.captures ?? []).join(',')}:${(m.path ?? []).join(',')}`;
    if (!seen.has(key)) {
      seen.add(key);
      list.push(m);
    }
  }
  return list;
}

export function applyMove(state: CheckersState, actor: Actor, move: CheckersMove): MoveResult<CheckersState> {
  if (state.end !== null || actor !== state.turn) throw new Error('Du bist nicht am Zug.');

  const moves = legalMoves(state, actor);
  const legal = moves.find(
    (m) =>
      m.from === move.from &&
      m.to === move.to &&
      JSON.stringify(m.captures ?? []) === JSON.stringify(move.captures ?? []) &&
      JSON.stringify(m.path ?? []) === JSON.stringify(move.path ?? []),
  );

  if (!legal) {
    throw new Error('Dieser Zug ist nicht erlaubt.');
  }

  const { size } = state;
  const nextCells = [...state.cells];
  const piece = nextCells[move.from];
  if (!piece) throw new Error('Keine Figur auf dem Startfeld.');

  // Figur vom Startfeld nehmen
  nextCells[move.from] = null;

  // Geschlagene Steine entfernen
  const events: GameEvent[] = [];
  const opponent: SeatId = (1 - actor) as SeatId;

  if (move.captures && move.captures.length > 0) {
    for (const cap of move.captures) {
      nextCells[cap] = null;
      events.push({ type: 'captured', cell: cap, seat: opponent });
    }
  }

  // Dame-Werdung prüfen
  const toRow = Math.floor(move.to / size);
  const isCrowned =
    piece.king ||
    (actor === 0 && toRow === 0) ||
    (actor === 1 && toRow === size - 1);

  nextCells[move.to] = { seat: piece.seat, king: isCrowned };

  events.push({
    type: 'moved',
    from: move.from,
    to: move.to,
    seat: actor,
    san: legal.san,
    captured: move.captures?.length ?? 0,
  });

  if (!piece.king && isCrowned) {
    events.push({ type: 'promoted', cell: move.to, seat: actor });
  }

  // Halbzüge für Remiszähler: Nullstellen bei Schlagen oder einfachem Vorrücken
  const advancedMan = !piece.king;
  const hasCapture = (move.captures?.length ?? 0) > 0;
  const nextSinceAdvance = hasCapture || advancedMan ? 0 : state.sinceCaptureOrAdvance + 1;

  // Stellungsschlüssel für Wiederholungsprüfung
  const nextTurn = opponent;
  const key = positionKey({ cells: nextCells, turn: nextTurn });
  const nextPositions = { ...state.positions, [key]: (state.positions[key] ?? 0) + 1 };

  let nextEnd: CheckersState['end'] = null;
  let nextWinner: SeatId | null = null;

  // Prüfen, ob der Gegner noch Steine hat
  const opponentHasPieces = nextCells.some((c) => c?.seat === opponent);
  if (!opponentHasPieces) {
    nextEnd = 'captured';
    nextWinner = actor as SeatId;
  } else {
    // Nächsten Zustand vorbereiten, um zu prüfen, ob der Gegner Züge hat
    const candidateState: CheckersState = {
      ...state,
      cells: nextCells,
      turn: nextTurn,
      history: [...state.history, legal.san],
      lastMove: { from: move.from, to: move.to },
      positions: nextPositions,
      sinceCaptureOrAdvance: nextSinceAdvance,
      end: null,
      winner: null,
    };

    const nextLegal = legalMoves(candidateState, opponent);
    if (nextLegal.length === 0) {
      // Gegner ist blockiert
      nextEnd = 'blocked';
      nextWinner = actor as SeatId;
    } else if ((nextPositions[key] ?? 0) >= 3) {
      nextEnd = 'repetition';
    } else if (nextSinceAdvance >= 40) {
      nextEnd = 'drawMoves';
    }
  }

  if (nextEnd) {
    events.push({ type: 'over', end: nextEnd, winner: nextWinner });
  }

  return {
    state: {
      ...state,
      cells: nextCells,
      turn: nextTurn,
      winner: nextWinner,
      end: nextEnd,
      positions: nextPositions,
      history: [...state.history, legal.san],
      lastMove: { from: move.from, to: move.to },
      sinceCaptureOrAdvance: nextSinceAdvance,
    },
    events,
  };
}

export function result(state: CheckersState): Result | null {
  if (state.winner !== null) return { kind: 'win', winners: [state.winner], reason: state.end ?? undefined };
  if (state.end === 'repetition' || state.end === 'drawMoves') return { kind: 'draw', reason: state.end };
  return null;
}

/** Zählt vorhandene Steine und Damen beider Parteien. */
export function countPieces(cells: readonly (CheckersPiece | null)[]): [
  { men: number; kings: number; total: number },
  { men: number; kings: number; total: number },
] {
  const counts = [
    { men: 0, kings: 0, total: 0 },
    { men: 0, kings: 0, total: 0 },
  ];
  for (const p of cells) {
    if (!p) continue;
    if (p.king) counts[p.seat].kings++;
    else counts[p.seat].men++;
    counts[p.seat].total++;
  }
  return [counts[0], counts[1]];
}

export function evaluate(state: CheckersState, seat: SeatId): number {
  if (state.winner === seat) return 100_000;
  if (state.winner !== null) return -100_000;
  if (state.end === 'repetition' || state.end === 'drawMoves') return 0;

  const opponent = (1 - seat) as SeatId;
  const [whiteCount, blackCount] = countPieces(state.cells);
  const ownCount = seat === 0 ? whiteCount : blackCount;
  const oppCount = seat === 0 ? blackCount : whiteCount;

  // Material: Stein = 100, Dame = 320
  let score = (ownCount.men - oppCount.men) * 100 + (ownCount.kings - oppCount.kings) * 320;

  // Positioneller Bonus für das Vorrücken einfacher Steine & Kantenabsicherung
  const { size } = state;
  state.cells.forEach((piece, idx) => {
    if (!piece) return;
    const r = Math.floor(idx / size);
    const c = idx % size;
    const isOwn = piece.seat === seat;
    const mult = isOwn ? 1 : -1;

    if (!piece.king) {
      // Je näher an der gegnerischen Grundreihe, desto wertvoller
      const distFromStart = piece.seat === 0 ? size - 1 - r : r;
      score += mult * distFromStart * 6;
      // Grundreihen-Verteidigung: Schutz vor frühen feindlichen Damen
      const isHomeRow = (piece.seat === 0 && r === size - 1) || (piece.seat === 1 && r === 0);
      if (isHomeRow) score += mult * 12;
    } else {
      // Dame im Zentrum ist agiler
      const centerDist = Math.abs(r - (size - 1) / 2) + Math.abs(c - (size - 1) / 2);
      score += mult * (10 - centerDist * 2);
    }

    // Randsteine können nicht von der Seite geschlagen werden
    if (c === 0 || c === size - 1) {
      score += mult * 4;
    }
  });

  return score;
}
