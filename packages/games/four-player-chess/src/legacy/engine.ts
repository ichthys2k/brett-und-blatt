// Spiellogik für 4-Spieler-Schach nach den Regeln von chess.com
// („Jeder gegen jeden“ mit Punkten und „Teams“).
//
// Diese Datei kennt weder Bildschirm noch Netzwerk. Der Spielstand ergibt sich
// vollständig aus der Liste der Aktionen (Züge, Aufgaben, Siegansprüche).
// Dadurch kann jedes Gerät denselben Stand selbst nachrechnen.
//
// Felder werden als Zahl 0–195 gespeichert (Zeile * 14 + Spalte). Zeile 0 ist
// oben (Gelb), Zeile 13 unten (Rot), Spalte 0 links (Blau), Spalte 13 rechts (Grün).

export type Color = 'r' | 'b' | 'y' | 'g';
export type PieceType = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';
export type PromoPiece = 'Q' | 'R' | 'B' | 'N';
export type GameMode = 'ffa' | 'teams';

export interface Piece {
  c: Color;
  t: PieceType;
  /** Tot: Figur eines ausgeschiedenen Spielers, bleibt als Hindernis stehen. */
  d?: boolean;
  /** Umgewandelt (zählt beim Schlagen in FFA nur 1 Punkt). */
  pr?: boolean;
}

export interface EnPassant {
  target: number;
  pawn: number;
  color: Color;
}

export interface LogEntry {
  type: string;
  color: Color | null;
  text: string;
  points?: number;
  /** Die Aktion, die diesen Eintrag ausgelöst hat – damit lässt sich jede Stellung nachspielen (fehlt in älteren Spielständen). */
  action?: FourChessAction;
  /** Bei Zügen: die gezogene Figur und – wenn geschlagen wurde – die geschlagene Figur. */
  piece?: PieceType;
  captured?: { c: Color; t: PieceType; dead?: boolean };
}

export interface GameResult {
  reason: string;
  winners: Color[];
  ranking?: Color[];
  loser?: Color;
}

export interface InternalMove {
  from: number;
  to: number;
  double?: boolean;
  promote?: boolean;
  ep?: number;
  castle?: { from: number; to: number };
}

export interface FourChessState {
  mode: GameMode;
  board: (Piece | null)[];
  turn: Color;
  ply: number;
  active: Record<Color, boolean>;
  out: Partial<Record<Color, string>>;
  scores: Record<Color, number>;
  castle: Record<Color, number[]>;
  ep: EnPassant[];
  clock: number;
  lastMoved: Record<Color, number>;
  seen: Record<string, number>;
  log: LogEntry[];
  lastMove: { from: number; to: number; color: Color } | null;
  result: GameResult | null;
  [key: string]: unknown;
}

export type FourChessAction =
  | { t: 'm'; p: Color; f: number; to: number; pr?: PromoPiece }
  | { t: 'resign'; p: Color; time?: boolean }
  | { t: 'claim'; p: Color };

export const SIZE = 14;
export const COLORS: readonly Color[] = ['r', 'b', 'y', 'g']; // Zugreihenfolge im Uhrzeigersinn
export const COLOR_NAMES: Record<Color, string> = { r: 'Rot', b: 'Blau', y: 'Gelb', g: 'Grün' };
export const TEAM_OF: Record<Color, number> = { r: 0, y: 0, b: 1, g: 1 }; // Teampartner sitzen sich gegenüber
export const POINTS: Record<PieceType, number> = { P: 1, N: 3, B: 5, R: 5, Q: 9, K: 20 };
export const GLYPHS: Record<PieceType, string> = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' };
export const PROMOTION_RANK: Record<GameMode, number> = { ffa: 8, teams: 11 };

const FORWARD: Record<Color, [number, number]> = { r: [-1, 0], b: [0, 1], y: [1, 0], g: [0, -1] };
const KNIGHT: [number, number][] = [
  [1, 2],
  [2, 1],
  [-1, 2],
  [-2, 1],
  [1, -2],
  [2, -1],
  [-1, -2],
  [-2, -1],
];
const ORTHO: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const DIAG: [number, number][] = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
const ALL_DIRS: [number, number][] = ORTHO.concat(DIAG);
const PAWN_CAPTURES: Record<Color, [number, number][]> = {
  r: [
    [-1, 1],
    [-1, -1],
  ],
  b: [
    [1, 1],
    [-1, 1],
  ],
  y: [
    [1, 1],
    [1, -1],
  ],
  g: [
    [1, -1],
    [-1, -1],
  ],
};

// Grundreihe entlang aufsteigender Spalte (Rot, Gelb) bzw. Zeile (Blau, Grün).
// Die Dame steht jeweils links vom König, jeder König blickt auf die Dame gegenüber.
const BACK_RANK: Record<Color, string> = { r: 'RNBQKBNR', y: 'RNBKQBNR', b: 'RNBQKBNR', g: 'RNBKQBNR' };

// ---------------------------------------------------------------------------
// Koordinaten
// ---------------------------------------------------------------------------

export const idx = (r: number, c: number): number => r * SIZE + c;
export const rowOf = (i: number): number => Math.floor(i / SIZE);
export const colOf = (i: number): number => i % SIZE;

/** Liegt das Feld auf dem kreuzförmigen Brett (die 3×3-Ecken fehlen)? */
export function onBoard(r: number, c: number): boolean {
  if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return false;
  return !((r < 3 || r > 10) && (c < 3 || c > 10));
}

/** Feldname aus Sicht von Rot: Linien a–n von links, Reihen 1–14 von unten. */
export function squareName(i: number): string {
  return String.fromCharCode(97 + colOf(i)) + (SIZE - rowOf(i));
}

/** Reihe eines Feldes aus Sicht einer Farbe (1 = eigene Grundreihe). */
export function relRank(color: Color, i: number): number {
  switch (color) {
    case 'r':
      return SIZE - rowOf(i);
    case 'y':
      return rowOf(i) + 1;
    case 'b':
      return colOf(i) + 1;
    default:
      return SIZE - colOf(i);
  }
}

export function isEnemy(mode: GameMode, a: Color, b: Color): boolean {
  return a !== b && (mode !== 'teams' || TEAM_OF[a] !== TEAM_OF[b]);
}

export function teamMates(color: Color): Color[] {
  return (COLORS as Color[]).filter((c) => TEAM_OF[c] === TEAM_OF[color]);
}

// ---------------------------------------------------------------------------
// Spielstart
// ---------------------------------------------------------------------------

function initialBoard(): (Piece | null)[] {
  const board: (Piece | null)[] = new Array(SIZE * SIZE).fill(null);
  for (let k = 0; k < 8; k++) {
    board[idx(13, 3 + k)] = { c: 'r', t: BACK_RANK.r[k] as PieceType };
    board[idx(12, 3 + k)] = { c: 'r', t: 'P' };
    board[idx(0, 3 + k)] = { c: 'y', t: BACK_RANK.y[k] as PieceType };
    board[idx(1, 3 + k)] = { c: 'y', t: 'P' };
    board[idx(3 + k, 0)] = { c: 'b', t: BACK_RANK.b[k] as PieceType };
    board[idx(3 + k, 1)] = { c: 'b', t: 'P' };
    board[idx(3 + k, 13)] = { c: 'g', t: BACK_RANK.g[k] as PieceType };
    board[idx(3 + k, 12)] = { c: 'g', t: 'P' };
  }
  return board;
}

/**
 * Neuer Spielstand. Figuren sind Objekte { c: Farbe, t: Typ, d: tot?, pr: umgewandelt? }.
 * Figuren ausgeschiedener Spieler bleiben als graue („tote“) Hindernisse liegen.
 */
export function newGame(mode: GameMode = 'ffa'): FourChessState {
  const state: FourChessState = {
    mode: mode === 'teams' ? 'teams' : 'ffa',
    board: initialBoard(),
    turn: 'r',
    ply: 0,
    active: { r: true, b: true, y: true, g: true },
    out: {}, // Grund des Ausscheidens je Farbe
    scores: { r: 0, b: 0, y: 0, g: 0 },
    castle: {
      // Türme, mit denen noch rochiert werden darf
      r: [idx(13, 3), idx(13, 10)],
      y: [idx(0, 3), idx(0, 10)],
      b: [idx(3, 0), idx(10, 0)],
      g: [idx(3, 13), idx(10, 13)],
    },
    ep: [], // offene En-passant-Möglichkeiten
    clock: 0, // Halbzüge seit dem letzten Schlagen/Bauernzug
    lastMoved: { r: -1, b: -1, y: -1, g: -1 },
    seen: {}, // Stellungszähler für dreifache Wiederholung
    log: [],
    lastMove: null,
    result: null,
  };
  state.seen[positionKey(state)] = 1;
  return state;
}

/** Spielt eine Liste von Aktionen von Anfang an nach. Ungültige Aktionen werden übersprungen. */
export function replay(mode: GameMode, actions: FourChessAction[]): FourChessState {
  const state = newGame(mode);
  for (const a of actions) applyAction(state, a);
  return state;
}

// ---------------------------------------------------------------------------
// Angriffe und Schach
// ---------------------------------------------------------------------------

export interface AttackerInfo {
  sq: number;
  piece: Piece;
}

/**
 * Alle lebenden Figuren, die ein Feld angreifen und deren Farbe isAttacker(farbe) erfüllt.
 * Tote Figuren greifen nicht an, versperren aber den Weg.
 */
export function attackers(board: (Piece | null)[], sq: number, isAttacker: (c: Color) => boolean, firstOnly = false): AttackerInfo[] {
  const found: AttackerInfo[] = [];
  const r = rowOf(sq),
    c = colOf(sq);
  const hit = (i: number, p: Piece): boolean => {
    found.push({ sq: i, piece: p });
    return firstOnly;
  };

  for (const [dr, dc] of KNIGHT) {
    if (!onBoard(r + dr, c + dc)) continue;
    const i = idx(r + dr, c + dc),
      p = board[i];
    if (p && !p.d && p.t === 'N' && isAttacker(p.c) && hit(i, p)) return found;
  }
  for (const [dr, dc] of ALL_DIRS) {
    const diagonal = dr !== 0 && dc !== 0;
    let rr = r + dr,
      cc = c + dc,
      dist = 1;
    while (onBoard(rr, cc)) {
      const i = idx(rr, cc),
        p = board[i];
      if (p) {
        if (!p.d && isAttacker(p.c)) {
          const t = p.t;
          if ((t === 'Q' || t === (diagonal ? 'B' : 'R') || (t === 'K' && dist === 1)) && hit(i, p)) return found;
        }
        break;
      }
      rr += dr;
      cc += dc;
      dist++;
    }
  }
  for (const color of COLORS) {
    if (!isAttacker(color)) continue;
    for (const [dr, dc] of PAWN_CAPTURES[color]) {
      if (!onBoard(r - dr, c - dc)) continue;
      const i = idx(r - dr, c - dc),
        p = board[i];
      if (p && !p.d && p.t === 'P' && p.c === color && hit(i, p)) return found;
    }
  }
  return found;
}

export function isAttacked(board: (Piece | null)[], sq: number, isAttacker: (c: Color) => boolean): boolean {
  return attackers(board, sq, isAttacker, true).length > 0;
}

export function findKing(board: (Piece | null)[], color: Color): number {
  for (let i = 0; i < board.length; i++) {
    const p = board[i];
    if (p && !p.d && p.t === 'K' && p.c === color) return i;
  }
  return -1;
}

/** Prüffunktion: Gehört eine Farbe zu den noch aktiven Gegnern von color? */
export function enemiesOf(state: FourChessState, color: Color): (c: Color) => boolean {
  return (x: Color) => x !== color && state.active[x] && isEnemy(state.mode, color, x);
}

export function inCheck(state: FourChessState, color: Color): boolean {
  const king = findKing(state.board, color);
  return king >= 0 && isAttacked(state.board, king, enemiesOf(state, color));
}

// ---------------------------------------------------------------------------
// Zuggenerierung
// ---------------------------------------------------------------------------

/** Führt einen Zug auf einem Brett-Array aus (ohne Regelprüfung und Punkte). */
export function applyToBoard(board: (Piece | null)[], m: InternalMove, promoType: PromoPiece = 'Q'): void {
  const piece = board[m.from];
  if (!piece) return;
  board[m.to] = m.promote ? { c: piece.c, t: promoType, pr: true } : piece;
  board[m.from] = null;
  if (m.ep !== undefined) board[m.ep] = null;
  if (m.castle) {
    board[m.castle.to] = board[m.castle.from];
    board[m.castle.from] = null;
  }
}

function pseudoMoves(state: FourChessState, from: number, out: InternalMove[]): void {
  const board = state.board,
    piece = board[from];
  if (!piece) return;
  const color = piece.c;
  const r = rowOf(from),
    c = colOf(from);
  const canTake = (p: Piece) => p.d || isEnemy(state.mode, color, p.c);
  const add = (to: number, extra: Partial<InternalMove> = {}) => out.push(Object.assign({ from, to }, extra));

  if (piece.t === 'P') {
    const [fr, fc] = FORWARD[color];
    const promoRank = PROMOTION_RANK[state.mode];
    const addPawn = (to: number, extra: Partial<InternalMove> = {}) =>
      add(to, relRank(color, to) === promoRank ? { ...extra, promote: true } : extra);

    if (onBoard(r + fr, c + fc) && !board[idx(r + fr, c + fc)]) {
      addPawn(idx(r + fr, c + fc));
      const r2 = r + 2 * fr,
        c2 = c + 2 * fc;
      if (relRank(color, from) === 2 && onBoard(r2, c2) && !board[idx(r2, c2)]) {
        addPawn(idx(r2, c2), { double: true });
      }
    }
    for (const [dr, dc] of PAWN_CAPTURES[color]) {
      if (!onBoard(r + dr, c + dc)) continue;
      const to = idx(r + dr, c + dc),
        target = board[to];
      if (target) {
        if (canTake(target)) addPawn(to);
        continue;
      }
      const ep = state.ep.find((e) => e.target === to && isEnemy(state.mode, color, e.color));
      const victim = ep ? board[ep.pawn] : null;
      if (victim && !victim.d && victim.t === 'P' && ep && victim.c === ep.color) addPawn(to, { ep: ep.pawn });
    }
    return;
  }

  if (piece.t === 'N' || piece.t === 'K') {
    for (const [dr, dc] of piece.t === 'N' ? KNIGHT : ALL_DIRS) {
      if (!onBoard(r + dr, c + dc)) continue;
      const to = idx(r + dr, c + dc),
        target = board[to];
      if (!target || canTake(target)) add(to);
    }
    if (piece.t === 'K') castlingMoves(state, from, add);
    return;
  }

  const dirs = piece.t === 'R' ? ORTHO : piece.t === 'B' ? DIAG : ALL_DIRS;
  for (const [dr, dc] of dirs) {
    let rr = r + dr,
      cc = c + dc;
    while (onBoard(rr, cc)) {
      const to = idx(rr, cc),
        target = board[to];
      if (target) {
        if (canTake(target)) add(to);
        break;
      }
      add(to);
      rr += dr;
      cc += dc;
    }
  }
}

function castlingMoves(state: FourChessState, from: number, add: (to: number, extra?: Partial<InternalMove>) => void): void {
  const board = state.board,
    piece = board[from];
  if (!piece) return;
  const color = piece.c;
  const rights = state.castle[color];
  if (!rights || !rights.length) return;
  const enemy = enemiesOf(state, color);
  if (isAttacked(board, from, enemy)) return; // nicht aus dem Schach heraus

  for (const rookSq of rights) {
    const rook = board[rookSq];
    if (!rook || rook.d || rook.t !== 'R' || rook.c !== color) continue;
    const step = Math.sign(rowOf(rookSq) - rowOf(from)) * SIZE + Math.sign(colOf(rookSq) - colOf(from));
    let clear = true;
    for (let s = from + step; s !== rookSq; s += step) {
      if (board[s]) {
        clear = false;
        break;
      }
    }
    // Der König darf kein angegriffenes Feld überqueren.
    if (!clear || isAttacked(board, from + step, enemy) || isAttacked(board, from + 2 * step, enemy)) continue;
    add(from + 2 * step, { castle: { from: rookSq, to: from + step } });
  }
}

/** Lässt der Zug den eigenen König unangegriffen? */
function isSafe(state: FourChessState, color: Color, m: InternalMove): boolean {
  const board = state.board.slice();
  const victim = board[m.to];
  applyToBoard(board, m);
  const king = findKing(board, color);
  if (king < 0) return true;
  // Wer durch diesen Zug seinen König verliert, scheidet aus und greift nicht mehr an.
  const lostKing = victim && !victim.d && victim.t === 'K' ? victim.c : null;
  const enemy = enemiesOf(state, color);
  return !isAttacked(board, king, (x) => x !== lostKing && enemy(x));
}

/** Alle regelgerechten Züge einer Farbe in der aktuellen Stellung. */
export function legalMoves(state: FourChessState, color: Color = state.turn): InternalMove[] {
  if (state.result || !state.active[color]) return [];
  const out: InternalMove[] = [];
  state.board.forEach((p, i) => {
    if (p && !p.d && p.c === color) pseudoMoves(state, i, out);
  });
  return out.filter((m) => isSafe(state, color, m));
}

// ---------------------------------------------------------------------------
// Aktionen ausführen
// ---------------------------------------------------------------------------

/**
 * Führt eine Aktion aus und verändert dabei den Spielstand.
 *   { t: 'm', p: Farbe, f: von, to: nach, pr?: 'Q'|'R'|'B'|'N' }   Zug
 *   { t: 'resign', p: Farbe, time?: true }                       Aufgeben (jederzeit; time: Zeit abgelaufen)
 *   { t: 'claim', p: Farbe }                                     Sieg beanspruchen
 * Gibt false zurück, wenn die Aktion nicht erlaubt ist.
 */
export function applyAction(state: FourChessState, action: FourChessAction): boolean {
  if (!action || state.result) return false;
  if (action.t === 'm') return applyMove(state, action);
  if (action.t === 'resign') return applyResign(state, action.p, action.time ? 'time' : 'resign');
  if (action.t === 'claim') return applyClaim(state, action.p);
  return false;
}

function applyMove(state: FourChessState, a: Extract<FourChessAction, { t: 'm' }>): boolean {
  const color = a.p;
  if (color !== state.turn) return false;
  const m = legalMoves(state, color).find((x) => x.from === a.f && x.to === a.to);
  if (!m) return false;

  const ffa = state.mode === 'ffa';
  const board = state.board,
    piece = board[m.from];
  if (!piece) return false;
  const victim = m.ep !== undefined ? board[m.ep] : board[m.to];
  // In „Jeder gegen jeden“ wird immer automatisch zur Dame umgewandelt.
  const promoType: PromoPiece = m.promote && !ffa && a.pr && ['Q', 'R', 'B', 'N'].includes(a.pr) ? a.pr : 'Q';

  applyToBoard(board, m, promoType);

  if (piece.t === 'K') state.castle[color] = [];
  for (const c of COLORS) state.castle[c] = state.castle[c].filter((s) => s !== m.from && s !== m.to);
  state.ep = state.ep.filter((e) => e.color !== color);
  if (m.double) state.ep.push({ target: (m.from + m.to) / 2, pawn: m.to, color });
  state.clock = piece.t === 'P' || victim ? 0 : state.clock + 1;
  state.lastMoved[color] = state.ply++;
  state.lastMove = { from: m.from, to: m.to, color };

  const entry: LogEntry = { type: 'move', color, text: moveText(piece, m, victim, promoType), points: 0, action: { ...a }, piece: piece.t };
  if (victim) entry.captured = victim.d ? { c: victim.c, t: victim.t, dead: true } : { c: victim.c, t: victim.t };
  state.log.push(entry);
  if (victim && !victim.d) entry.points = (entry.points ?? 0) + (victim.t === 'K' ? POINTS.K : victim.pr ? 1 : POINTS[victim.t]);

  if (victim && !victim.d && victim.t === 'K') {
    eliminate(state, victim.c, 'king');
    logEvent(state, victim.c, `Der König von ${COLOR_NAMES[victim.c]} wurde geschlagen`);
    if (!ffa) {
      state.result = { reason: 'king', winners: teamMates(color), loser: victim.c };
      return true;
    }
  }

  const checks = checksBy(state, color);
  if (checks.length) entry.text += '+';
  if (ffa) {
    if (checks.length >= 2) {
      const queens = checks.every((c) => c.queensOnly);
      entry.points = (entry.points ?? 0) + (checks.length === 2 ? (queens ? 1 : 5) : queens ? 5 : 20);
    }
    state.scores[color] += entry.points ?? 0;
  } else {
    entry.points = 0;
  }

  advance(state);
  if (!state.result) checkDraw(state);
  return true;
}

function applyResign(state: FourChessState, color: Color, reason: 'resign' | 'time' = 'resign'): boolean {
  if (!state.active[color]) return false;
  const wasTurn = state.turn === color;
  eliminate(state, color, reason);
  logEvent(state, color, reason === 'time' ? `${COLOR_NAMES[color]} hat keine Zeit mehr` : `${COLOR_NAMES[color]} gibt auf`, reason === 'time' ? { t: 'resign', p: color, time: true } : { t: 'resign', p: color });
  if (state.mode === 'teams') {
    state.result = { reason, winners: (COLORS as Color[]).filter((c) => TEAM_OF[c] !== TEAM_OF[color]), loser: color };
  } else if (wasTurn) {
    advance(state);
  } else if (activeColors(state).length <= 1) {
    finishFfa(state, 'last');
  }
  if (!state.result) checkDraw(state);
  return true;
}

/** FFA: Bei zwei verbleibenden Spielern darf, wer 21+ Punkte vorn liegt, den Sieg beanspruchen. */
export function canClaim(state: FourChessState, color: Color): boolean {
  if (state.mode !== 'ffa' || state.result || !state.active[color]) return false;
  const alive = activeColors(state);
  if (alive.length !== 2) return false;
  const other = alive.find((c) => c !== color);
  if (!other) return false;
  return state.scores[color] >= state.scores[other] + 21;
}

function applyClaim(state: FourChessState, color: Color): boolean {
  if (!canClaim(state, color)) return false;
  const other = activeColors(state).find((c) => c !== color);
  if (!other) return false;
  state.scores[other] += 20;
  logEvent(state, color, `${COLOR_NAMES[color]} beansprucht den Sieg (+20 für ${COLOR_NAMES[other]})`, { t: 'claim', p: color });
  finishFfa(state, 'claim');
  return true;
}

// ---------------------------------------------------------------------------
// Zugwechsel, Matt, Patt, Spielende
// ---------------------------------------------------------------------------

export function activeColors(state: FourChessState): Color[] {
  return (COLORS as Color[]).filter((c) => state.active[c]);
}

export function nextActive(state: FourChessState, from: Color): Color {
  const start = COLORS.indexOf(from);
  for (let k = 1; k <= 4; k++) {
    const c = COLORS[(start + k) % 4] as Color;
    if (state.active[c]) return c;
  }
  return from;
}

/**
 * Gibt den Zug an die nächste aktive Farbe weiter. Matt und Patt werden erst
 * festgestellt, wenn die betroffene Farbe am Zug ist – bis dahin kann ein
 * anderer Spieler die Lage noch ändern.
 */
function advance(state: FourChessState): void {
  while (!state.result) {
    if (state.mode === 'ffa' && activeColors(state).length <= 1) {
      finishFfa(state, 'last');
      return;
    }
    state.turn = nextActive(state, state.turn);
    const color = state.turn;
    if (legalMoves(state, color).length) return;

    if (inCheck(state, color)) {
      const by = mateCredit(state, color);
      eliminate(state, color, 'mate');
      if (state.mode === 'teams') {
        logEvent(state, color, `${COLOR_NAMES[color]} ist schachmatt`);
        state.result = { reason: 'mate', winners: (COLORS as Color[]).filter((c) => TEAM_OF[c] !== TEAM_OF[color]), loser: color };
        return;
      }
      state.scores[by] += 20;
      logEvent(state, color, `${COLOR_NAMES[color]} ist schachmatt (+20 für ${COLOR_NAMES[by]})`);
    } else {
      if (state.mode === 'teams') {
        logEvent(state, color, `${COLOR_NAMES[color]} ist patt – unentschieden`);
        state.result = { reason: 'stalemate', winners: [] };
        return;
      }
      eliminate(state, color, 'stalemate');
      state.scores[color] += 20;
      logEvent(state, color, `${COLOR_NAMES[color]} ist patt (+20 für ${COLOR_NAMES[color]})`);
    }
  }
}

/** Die 20 Mattpunkte bekommt, wer Schach gibt – bei mehreren, wer zuletzt gezogen hat. */
function mateCredit(state: FourChessState, color: Color): Color {
  const king = findKing(state.board, color);
  const att = attackers(state.board, king, enemiesOf(state, color));
  let best = att[0].piece.c;
  for (const a of att) {
    if (state.lastMoved[a.piece.c] > state.lastMoved[best]) best = a.piece.c;
  }
  return best;
}

/** Welche Gegner stehen durch Figuren von color im Schach? */
function checksBy(state: FourChessState, color: Color): { color: Color; queensOnly: boolean }[] {
  const result: { color: Color; queensOnly: boolean }[] = [];
  for (const other of COLORS) {
    if (!enemiesOf(state, color)(other)) continue;
    const king = findKing(state.board, other);
    if (king < 0) continue;
    const att = attackers(state.board, king, (x) => x === color);
    if (att.length) result.push({ color: other, queensOnly: att.every((a) => a.piece.t === 'Q') });
  }
  return result;
}

function eliminate(state: FourChessState, color: Color, reason: string): void {
  state.active[color] = false;
  state.out[color] = reason;
  const board = state.board;
  for (let i = 0; i < board.length; i++) {
    const p = board[i];
    if (p && p.c === color && !p.d) board[i] = { ...p, d: true };
  }
  state.ep = state.ep.filter((e) => e.color !== color);
  state.castle[color] = [];
}

function checkDraw(state: FourChessState): void {
  const key = positionKey(state);
  state.seen[key] = (state.seen[key] || 0) + 1;
  const alive = activeColors(state);
  let reason: 'repetition' | 'fifty' | 'material' | null = null;
  if (state.seen[key] >= 3) reason = 'repetition';
  else if (state.clock >= 50 * alive.length) reason = 'fifty';
  else if (state.board.every((p) => !p || p.d || p.t === 'K')) reason = 'material';
  if (!reason) return;

  const texts: Record<'repetition' | 'fifty' | 'material', string> = {
    repetition: 'Dreifache Stellungswiederholung',
    fifty: '50-Züge-Regel',
    material: 'Nur noch Könige auf dem Brett',
  };
  if (state.mode === 'ffa') {
    for (const c of alive) state.scores[c] += 10;
    logEvent(state, null, `${texts[reason]} – +10 für alle aktiven Spieler`);
    finishFfa(state, reason);
  } else {
    logEvent(state, null, `${texts[reason]} – unentschieden`);
    state.result = { reason, winners: [] };
  }
}

/** Spieler, die aufgegeben haben oder deren Zeit abgelaufen ist, haben verwirkt. */
function isForfeited(state: FourChessState, c: Color): boolean {
  return state.out[c] === 'resign' || state.out[c] === 'time';
}

function finishFfa(state: FourChessState, reason: string): void {
  const ranking = [...COLORS].sort((a, b) => {
    // Nicht-aufgebende Spieler vor aufgebenden Spielern, danach nach Punkten
    const forfeitA = isForfeited(state, a) ? 1 : 0;
    const forfeitB = isForfeited(state, b) ? 1 : 0;
    if (forfeitA !== forfeitB) return forfeitA - forfeitB;
    return state.scores[b] - state.scores[a];
  });
  const eligible = (COLORS as Color[]).filter((c) => !isForfeited(state, c));
  if (eligible.length === 0) {
    state.result = { reason, winners: [], ranking };
    return;
  }
  const top = Math.max(...eligible.map((c) => state.scores[c]));
  state.result = { reason, winners: eligible.filter((c) => state.scores[c] === top), ranking };
}

function logEvent(state: FourChessState, color: Color | null, text: string, action?: FourChessAction): void {
  state.log.push(action ? { type: 'event', color, text, action } : { type: 'event', color, text });
}

function positionKey(state: FourChessState): string {
  let key = state.turn as string;
  for (const p of state.board) key += p ? (p.d ? 'x' : p.c) + p.t : '.';
  return key + JSON.stringify(state.castle) + state.ep.map((e) => e.target).join(',');
}

function moveText(piece: Piece, m: InternalMove, victim: Piece | null, promoType: PromoPiece): string {
  if (m.castle) {
    const long = Math.abs(m.castle.from - m.from) === 4 * Math.abs(m.castle.to - m.from);
    return long ? 'O-O-O' : 'O-O';
  }
  const name = piece.t === 'P' ? '' : GLYPHS[piece.t];
  const promo = m.promote ? '=' + GLYPHS[promoType] : '';
  return `${name}${squareName(m.from)}${victim ? '×' : '–'}${squareName(m.to)}${promo}`;
}
