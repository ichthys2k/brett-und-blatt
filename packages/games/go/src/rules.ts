import { Rng, type Actor, type GameEvent, type MoveResult, type Options, type Result, type SeatId } from '@brett-und-blatt/engine';
import { areaScore, BLACK, EMPTY, geometry, groupAt, guessDead, hashAfter, labelGroups, placeStone, positionHash, WHITE, type Color } from './board';

export type GoVariant = 'go' | 'atari';

export interface GoEnd {
  reason: 'score' | 'resign' | 'time' | 'capture' | 'passes';
  winner: SeatId | null;
  /** Flächenwertung: Punkte von Schwarz und Weiß (Weiß mit Komi). */
  black?: number;
  white?: number;
}

export interface GoState {
  size: number;
  variant: GoVariant;
  komi: number;
  /** Punkte zeilenweise von oben links: 0 frei, 1 Schwarz (Platz 0), 2 Weiß (Platz 1). */
  board: number[];
  turn: SeatId;
  phase: 'play' | 'scoring' | 'over';
  /** Passen in Folge. */
  passes: number;
  /** Steine, die Schwarz bzw. Weiß geschlagen hat. */
  captures: [number, number];
  /** Prüfsummen aller bisherigen Stellungen (Positional Superko). */
  history: string[];
  /** Letzter Zug: Punkt, −1 für Passen, null am Anfang. */
  lastMove: number | null;
  /** Punkt, den der Gegner wegen Ko gerade nicht besetzen darf (nur zur Anzeige). */
  ko: number | null;
  /** Vorgabesteine von Schwarz. */
  handicapStones: number[];
  /** Alle Züge der Partie (Punkt oder −1 für Passen) – für den Partieverlauf und SGF. */
  record: number[];
  /** Auszählphase: als tot markierte Steine (aufsteigend). */
  dead: number[];
  /** Auszählphase: Wer hat der aktuellen Markierung zugestimmt? */
  accepted: [boolean, boolean];
  /** Gebiet während der Partie einblenden (Lernhilfe). */
  showTerritory: boolean;
  end: GoEnd | null;
}

export type GoMove =
  | { type: 'place'; point: number }
  | { type: 'pass' }
  /** Auszählphase: Gruppe als tot bzw. lebend markieren. */
  | { type: 'toggleDead'; point: number }
  | { type: 'acceptScore' }
  /** Auszählung abbrechen und weiterspielen. */
  | { type: 'resume' }
  /** Aufgeben bzw. Zeit abgelaufen – nicht in `legalMoves`. */
  | { type: 'resign'; seat: SeatId; time?: boolean };

const colorOf = (seat: SeatId): Color => (seat === 0 ? BLACK : WHITE);

/** Sternpunkte für Vorgabesteine in der üblichen Reihenfolge. */
export function handicapPoints(size: number, count: number): number[] {
  if (count < 2) return [];
  const edge = size >= 13 ? 3 : 2;
  const lo = edge;
  const hi = size - 1 - edge;
  const mid = (size - 1) / 2;
  const at = (r: number, c: number) => r * size + c;
  const corners = [at(lo, hi), at(hi, lo), at(hi, hi), at(lo, lo)];
  const sides = [at(mid, lo), at(mid, hi), at(lo, mid), at(hi, mid)];
  const center = at(mid, mid);
  const points = corners.slice(0, Math.min(count, 4));
  if (count === 5 || count === 7 || count === 9) points.push(center);
  if (count >= 6) points.push(sides[0]!, sides[1]!);
  if (count >= 8) points.push(sides[2]!, sides[3]!);
  return points;
}

export function setup(_seats: number, options: Options): GoState {
  const size = Number(options.size ?? 9);
  const variant: GoVariant = options.variant === 'atari' ? 'atari' : 'go';
  const handicap = variant === 'go' ? Number(options.handicap ?? 0) : 0;
  const komi = variant === 'atari' ? 0 : handicap >= 2 ? 0.5 : Number(options.komi ?? 7.5);
  const board: number[] = Array(size * size).fill(EMPTY);
  const handicapStones = handicapPoints(size, handicap);
  for (const p of handicapStones) board[p] = BLACK;
  return {
    size,
    variant,
    komi,
    board,
    turn: handicapStones.length > 0 ? 1 : 0,
    phase: 'play',
    passes: 0,
    captures: [0, 0],
    history: [positionHash(board)],
    lastMove: null,
    ko: null,
    handicapStones,
    record: [],
    dead: [],
    accepted: [false, false],
    showTerritory: options.territory === 'on',
    end: null,
  };
}

/** Ergebnis eines Steins, ohne den Spielstand zu ändern – oder null, wenn er nicht erlaubt ist. */
export function tryPlace(state: GoState, point: number, seat: SeatId, seen?: ReadonlySet<string>): { board: number[]; captured: number[]; hash: string } | null {
  if (point < 0 || point >= state.board.length || state.board[point] !== EMPTY) return null;
  const board = state.board.slice();
  const captured = placeStone(board, geometry(state.size), point, colorOf(seat));
  if (!captured) return null;
  const hash = hashAfter(state.history[state.history.length - 1]!, board.length, point, colorOf(seat), captured);
  if (seen ? seen.has(hash) : state.history.includes(hash)) return null;
  return { board, captured, hash };
}

export function currentPlayers(state: GoState): Actor[] {
  if (state.phase === 'over') return [];
  if (state.phase === 'scoring') return ([0, 1] as const).filter((seat) => !state.accepted[seat]);
  return [state.turn];
}

/**
 * Erlaubte Züge. In der Auszählphase stehen hier nur Zustimmen und Weiterspielen;
 * das Markieren einzelner Gruppen prüft `isLegal` (sonst würden Zufallspartien ewig markieren).
 */
export function legalMoves(state: GoState, actor: Actor): GoMove[] {
  if (actor === 'system' || !currentPlayers(state).includes(actor)) return [];
  if (state.phase === 'scoring') return [{ type: 'acceptScore' }, { type: 'resume' }];
  const moves: GoMove[] = [];
  const seen = new Set(state.history);
  const geo = geometry(state.size);
  const { label, liberties } = labelGroups(state.board, geo);
  const color = colorOf(actor);
  const hash = state.history[state.history.length - 1]!;
  for (let p = 0; p < state.board.length; p++) {
    if (state.board[p] !== EMPTY) continue;
    // Schnellprüfung über die Freiheiten der Nachbargruppen; nur wenn geschlagen wird, wird der Zug ausgeführt.
    let captures = false;
    let breathes = false;
    for (const n of geo.neighbors[p]!) {
      const v = state.board[n];
      if (v === EMPTY) breathes = true;
      else if (v === color) breathes ||= liberties[label[n]!]! > 1;
      else if (liberties[label[n]!] === 1) captures = true;
    }
    const legal = captures ? tryPlace(state, p, actor, seen) !== null : breathes && !seen.has(hashAfter(hash, geo.points, p, color, []));
    if (legal) moves.push({ type: 'place', point: p });
  }
  moves.push({ type: 'pass' });
  return moves;
}

export function isLegal(state: GoState, actor: Actor, move: GoMove): boolean {
  if (actor === 'system') return false;
  if (move.type === 'resign') return move.seat === actor && state.phase !== 'over';
  if (!currentPlayers(state).includes(actor)) return false;
  switch (move.type) {
    case 'place':
      return state.phase === 'play' && Number.isInteger(move.point) && tryPlace(state, move.point, actor) !== null;
    case 'pass':
      return state.phase === 'play';
    case 'toggleDead':
      return state.phase === 'scoring' && Number.isInteger(move.point) && move.point >= 0 && move.point < state.board.length && state.board[move.point] !== EMPTY;
    case 'acceptScore':
    case 'resume':
      return state.phase === 'scoring';
    default:
      return false;
  }
}

/** Punkte nach Flächenwertung mit den markierten toten Steinen. */
export function scoreOf(state: Pick<GoState, 'board' | 'size' | 'komi' | 'dead'>): { black: number; white: number; owner: number[] } {
  const { black, white, owner } = areaScore(state.board, geometry(state.size), state.dead);
  return { black, white: white + state.komi, owner };
}

function finish(state: GoState, end: GoEnd, events: GameEvent[]): GoState {
  events.push({ type: 'over', reason: end.reason, winner: end.winner });
  return { ...state, phase: 'over', end };
}

/** Beginnt die Auszählphase mit einem Vorschlag für tote Steine. */
function startScoring(state: GoState): GoState {
  // Der Vorschlag hängt nur von der Stellung ab: gleiche Partie, gleicher Vorschlag.
  const rng = Rng.fromSeed(state.history[state.history.length - 1]!, 'tote-steine');
  const dead = guessDead(state.board, state.size, colorOf(state.turn), state.komi, rng);
  return { ...state, phase: 'scoring', dead, accepted: [false, false] };
}

export function applyMove(state: GoState, actor: Actor, move: GoMove): MoveResult<GoState> {
  if (!isLegal(state, actor, move)) throw new Error('Dieser Zug ist nicht erlaubt.');
  const seat = actor as SeatId;
  const events: GameEvent[] = [];

  switch (move.type) {
    case 'resign': {
      const winner = 1 - seat;
      events.push({ type: 'resigned', seat });
      return { state: finish(state, { reason: move.time ? 'time' : 'resign', winner }, events), events };
    }

    case 'place': {
      const placed = tryPlace(state, move.point, seat)!;
      const captures: [number, number] = [...state.captures];
      captures[seat] += placed.captured.length;
      let next: GoState = {
        ...state,
        board: placed.board,
        turn: 1 - seat,
        passes: 0,
        captures,
        history: [...state.history, placed.hash],
        lastMove: move.point,
        record: [...state.record, move.point],
        ko: null,
      };
      // Ko-Punkt anzeigen: Ein einzelner geschlagener Stein, den der Gegner nicht sofort zurückschlagen darf.
      if (placed.captured.length === 1) {
        const p = placed.captured[0]!;
        if (next.board[p] === EMPTY && !tryPlace(next, p, 1 - seat)) {
          const retake = next.board.slice();
          if (placeStone(retake, geometry(state.size), p, colorOf(1 - seat))) next.ko = p;
        }
      }
      events.push({ type: 'placed', point: move.point, seat, captured: placed.captured });
      if (placed.captured.length > 0) events.push({ type: 'captured', seat, points: placed.captured });
      if (state.variant === 'atari' && placed.captured.length > 0) {
        next = finish(next, { reason: 'capture', winner: seat }, events);
      }
      return { state: next, events };
    }

    case 'pass': {
      const passes = state.passes + 1;
      let next: GoState = { ...state, turn: 1 - seat, passes, lastMove: -1, record: [...state.record, -1], ko: null };
      events.push({ type: 'passed', seat });
      if (passes >= 2) {
        if (state.variant === 'atari') {
          // Atari-Go ohne Schlag: Wer mehr Fläche hat, gewinnt.
          const { black, white } = scoreOf(next);
          next = finish(next, { reason: 'passes', winner: black === white ? null : black > white ? 0 : 1, black, white }, events);
        } else {
          next = startScoring(next);
          events.push({ type: 'scoring' });
        }
      }
      return { state: next, events };
    }

    case 'toggleDead': {
      const group = groupAt(state.board, geometry(state.size), move.point).stones;
      const dead = new Set(state.dead);
      const nowDead = !dead.has(move.point);
      for (const p of group) {
        if (nowDead) dead.add(p);
        else dead.delete(p);
      }
      events.push({ type: 'marked', seat, points: group, dead: nowDead });
      return { state: { ...state, dead: [...dead].sort((a, b) => a - b), accepted: [false, false] }, events };
    }

    case 'acceptScore': {
      const accepted: [boolean, boolean] = [...state.accepted];
      accepted[seat] = true;
      let next: GoState = { ...state, accepted };
      events.push({ type: 'accepted', seat });
      if (accepted[0] && accepted[1]) {
        const { black, white } = scoreOf(next);
        // Die Endstellung ohne tote Steine; geschlagene Tote zählen als Gefangene.
        const board = next.board.slice();
        const captures: [number, number] = [...next.captures];
        for (const p of next.dead) {
          captures[board[p] === BLACK ? 1 : 0]++;
          board[p] = EMPTY;
        }
        next = finish({ ...next, board, captures }, { reason: 'score', winner: black === white ? null : black > white ? 0 : 1, black, white }, events);
      }
      return { state: next, events };
    }

    case 'resume': {
      events.push({ type: 'resumed', seat });
      return { state: { ...state, phase: 'play', passes: 0, dead: [], accepted: [false, false] }, events };
    }
  }
}

export function result(state: GoState): Result | null {
  if (state.phase !== 'over' || !state.end) return null;
  const reasons: Record<GoEnd['reason'], string> = {
    score: 'Auszählung',
    resign: 'Aufgabe',
    time: 'Zeit abgelaufen',
    capture: 'erster Schlag',
    passes: 'beide haben gepasst',
  };
  if (state.end.winner === null) return { kind: 'draw', reason: reasons[state.end.reason] };
  return { kind: 'win', winners: [state.end.winner], reason: reasons[state.end.reason] };
}

/**
 * Aufgeben und abgelaufene Zeit. In der Auszählphase gilt bei Zeitablauf
 * der aktuelle Vorschlag als bestätigt, statt die Partie zu verlieren.
 */
export function resignMove(state: GoState, seat: SeatId, reason: 'resign' | 'time' = 'resign'): GoMove | null {
  if (state.phase === 'over') return null;
  if (reason === 'time' && state.phase === 'scoring') return state.accepted[seat] ? null : { type: 'acceptScore' };
  return reason === 'time' ? { type: 'resign', seat, time: true } : { type: 'resign', seat };
}

const SGF_LETTERS = 'abcdefghijklmnopqrstuvwxyz';

function sgfPoint(point: number, size: number): string {
  if (point < 0) return '';
  return `${SGF_LETTERS[point % size]}${SGF_LETTERS[Math.floor(point / size)]}`;
}

/** Partie im Smart Game Format, z. B. zum Nachspielen in anderen Go-Programmen. */
export function toSgf(state: GoState, names: [string, string] = ['Schwarz', 'Weiß']): string {
  const esc = (text: string) => text.replace(/\\/g, '\\\\').replace(/]/g, '\\]');
  let head = `(;GM[1]FF[4]CA[UTF-8]AP[Brett und Blatt]SZ[${state.size}]KM[${state.komi}]RU[Chinese]PB[${esc(names[0])}]PW[${esc(names[1])}]`;
  if (state.handicapStones.length > 0) head += `HA[${state.handicapStones.length}]AB${state.handicapStones.map((p) => `[${sgfPoint(p, state.size)}]`).join('')}`;
  if (state.end) {
    const { winner, reason, black, white } = state.end;
    const margin = black !== undefined && white !== undefined ? String(Math.abs(black - white)) : reason === 'resign' ? 'R' : reason === 'time' ? 'T' : '';
    head += `RE[${winner === null ? '0' : `${winner === 0 ? 'B' : 'W'}+${margin}`}]`;
  }
  let color = state.handicapStones.length > 0 ? 1 : 0;
  const moves = state.record.map((p) => {
    const node = `;${color === 0 ? 'B' : 'W'}[${sgfPoint(p, state.size)}]`;
    color = 1 - color;
    return node;
  });
  return `${head}${moves.join('')})`;
}

/** Liest Brettgröße, Komi, Vorgabe und Züge aus einer SGF-Datei (Hauptvariante). */
export function parseSgf(sgf: string): { size: number; komi: number; handicapStones: number[]; moves: number[] } {
  const prop = (name: string) => new RegExp(`(?:^|[;\\s\\]])${name}((?:\\[(?:[^\\]\\\\]|\\\\.)*\\])+)`).exec(sgf)?.[1];
  const values = (raw: string | undefined) => (raw ? [...raw.matchAll(/\[((?:[^\]\\]|\\.)*)\]/g)].map((m) => m[1]!) : []);
  const size = Number(values(prop('SZ'))[0] ?? 19);
  const toPoint = (v: string) => (v.length < 2 || (v === 'tt' && size <= 19) ? -1 : SGF_LETTERS.indexOf(v[1]!) * size + SGF_LETTERS.indexOf(v[0]!));
  const komi = Number(values(prop('KM'))[0] ?? 0);
  const handicapStones = values(prop('AB')).map(toPoint);
  const moves = [...sgf.matchAll(/;\s*[BW]\[([a-z]{0,2})\]/g)].map((m) => toPoint(m[1]!));
  return { size, komi, handicapStones, moves };
}
