import type { SeatId } from '@brett-und-blatt/engine';
import { DrawOfferBar, FitBox, GridBoard, useGridMoveAnimation, usePointerDrag, type BoardProps, type GameUi, type MoveAnimationItem } from '@brett-und-blatt/ui';
import { Chess, type Move, type Square } from 'chess.js';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { START_FEN, toPgn, type BoardMove, type ChessMove, type ChessState, type Promotion } from '../rules';
import { PgnSetup } from './PgnSetup';
import { getCheckWarning, type CheckWarning } from './checkWarning';
import './styles.css';

type PieceType = 'k' | 'q' | 'r' | 'b' | 'n' | 'p';
interface Piece {
  type: PieceType;
  white: boolean;
}

/** Schachfiguren als Textzeichen; ︎ verhindert, dass Handys sie als bunte Emojis zeigen. */
const GLYPHS: Record<PieceType, string> = { k: '♚︎', q: '♛︎', r: '♜︎', b: '♝︎', n: '♞︎', p: '♟︎' };
const PIECE_NAMES: Record<PieceType, string> = { k: 'König', q: 'Dame', r: 'Turm', b: 'Läufer', n: 'Springer', p: 'Bauer' };
const VALUES: Record<PieceType, number> = { k: 0, q: 9, r: 5, b: 3, n: 3, p: 1 };
const PROMOTIONS: Promotion[] = ['q', 'r', 'b', 'n'];
const FILES = 'abcdefgh';

/** Liest die Figurenstellung aus dem FEN-Text; Index 0 = a8, 63 = h1. */
function parseBoard(fen: string): (Piece | null)[] {
  const board: (Piece | null)[] = [];
  for (const ch of fen.split(' ')[0] ?? '') {
    if (ch === '/') continue;
    if (ch >= '1' && ch <= '8') for (let i = 0; i < Number(ch); i++) board.push(null);
    else board.push({ type: ch.toLowerCase() as PieceType, white: ch === ch.toUpperCase() });
  }
  return board;
}

function squareName(index: number): string {
  return `${FILES[index % 8]}${8 - Math.floor(index / 8)}`;
}

function squareIndex(name: string): number {
  return (8 - Number(name[1])) * 8 + FILES.indexOf(name[0] ?? 'a');
}

/** Englische Figurenbuchstaben in deutsche: Springer, Läufer, Turm, Dame. */
export function germanSan(san: string): string {
  return san.replace(/[QRBN]/g, (ch) => ({ Q: 'D', R: 'T', B: 'L', N: 'S' })[ch] ?? ch);
}

const START_COUNT: Record<PieceType, number> = { k: 1, q: 1, r: 2, b: 2, n: 2, p: 8 };
const CAPTURE_ORDER: PieceType[] = ['q', 'r', 'b', 'n', 'p'];

/** Die Figuren, die eine Seite schon geschlagen hat (also dem Gegner fehlen). */
function capturedBy(board: (Piece | null)[], white: boolean): PieceType[] {
  const left: Record<PieceType, number> = { k: 0, q: 0, r: 0, b: 0, n: 0, p: 0 };
  for (const p of board) if (p && p.white !== white) left[p.type]++;
  // Umgewandelte Bauern zählen als Bauer, der fehlt: zusätzliche Damen usw. gleichen das aus.
  let promoted = 0;
  for (const type of ['q', 'r', 'b', 'n'] as const) promoted += Math.max(0, left[type] - START_COUNT[type]);
  const missingPawns = Math.max(0, START_COUNT.p - left.p - promoted);
  return CAPTURE_ORDER.flatMap((type) => Array.from({ length: type === 'p' ? missingPawns : Math.max(0, START_COUNT[type] - left[type]) }, () => type));
}

function CaptureStrip({ board, white, lead }: { board: (Piece | null)[]; white: boolean; lead: number }) {
  const taken = capturedBy(board, white);
  return (
    <div className="ch-strip" aria-label={`${white ? 'Weiß' : 'Schwarz'} hat geschlagen: ${taken.length ? taken.map((t) => PIECE_NAMES[t]).join(', ') : 'nichts'}`}>
      <span className={`ch-taken ${white ? 'ch-black' : 'ch-white'}`} aria-hidden="true">
        {taken.map((t) => GLYPHS[t]).join('')}
      </span>
      {lead > 0 && <span className="ch-lead">+{lead}</span>}
    </div>
  );
}

const PIECE_DATIVE: Record<PieceType, string> = { k: 'vom König', q: 'von der Dame', r: 'vom Turm', b: 'vom Läufer', n: 'vom Springer', p: 'vom Bauern' };

/** Die Partie Zug für Zug nachgespielt: ausführliche Züge und die Stellung nach jedem Zug. */
function replay(history: string[]): { moves: Move[]; fens: string[] } | null {
  try {
    const chess = new Chess(START_FEN);
    const moves: Move[] = [];
    const fens: string[] = [];
    for (const san of history) {
      moves.push(chess.move(san));
      fens.push(chess.fen());
    }
    return { moves, fens };
  } catch {
    return null;
  }
}

/** Angreifer des Königs, der gerade am Zug ist und im Schach steht. */
function checkAttackers(fen: string): { king: number; attackers: { sq: number; type: PieceType }[] } | null {
  try {
    const chess = new Chess(fen);
    if (!chess.inCheck()) return null;
    const turn = chess.turn();
    const board = chess.board();
    let king: Square | null = null;
    for (const row of board) for (const p of row) if (p && p.type === 'k' && p.color === turn) king = p.square;
    if (!king) return null;
    const found = chess.attackers(king, turn === 'w' ? 'b' : 'w');
    return { king: squareIndex(king), attackers: found.map((sq) => ({ sq: squareIndex(sq), type: (chess.get(sq)?.type ?? 'p') as PieceType })) };
  } catch {
    return null;
  }
}

/** Mögliche Züge einer Farbe, die gerade nicht am Zug ist – für das Vorziehen. */
function premoveCandidates(fen: string, white: boolean): { from: number; to: number }[] {
  const parts = fen.split(' ');
  parts[1] = white ? 'w' : 'b';
  parts[3] = '-';
  try {
    return new Chess(parts.join(' '), { skipValidation: true }).moves({ verbose: true }).map((m) => ({ from: squareIndex(m.from), to: squareIndex(m.to) }));
  } catch {
    return [];
  }
}

function MoveText({ move }: { move: Move }) {
  const white = move.color === 'w';
  const castle = move.san.startsWith('O-O');
  return (
    <span className="ch-log-move">
      <span className={`ch-log-glyph ${white ? 'ch-white' : 'ch-black'}`}>{GLYPHS[move.piece as PieceType]}</span>
      <span className="ch-log-san">{germanSan(move.san)}</span>
      {castle ? (
        <span className="ch-log-note">{move.san.startsWith('O-O-O') ? 'lange Rochade' : 'kurze Rochade'}</span>
      ) : move.captured ? (
        <span className="ch-log-capture">
          schlägt <span className={`ch-log-glyph ${white ? 'ch-black' : 'ch-white'}`}>{GLYPHS[move.captured as PieceType]}</span>
          <span className="ch-log-note">{PIECE_NAMES[move.captured as PieceType]}</span>
        </span>
      ) : null}
      {move.san.includes('#') ? <span className="ch-log-check">Matt</span> : move.san.includes('+') ? <span className="ch-log-check">Schach</span> : null}
    </span>
  );
}

interface Fly {
  key: number;
  type: PieceType;
  white: boolean;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

function Board({ view, legalMoves: allMoves, onMove, viewer, activeSeat, hint: anyHint, seatNames }: BoardProps<ChessState, ChessMove>) {
  // Remis-Züge haben kein Feld; das Brett kennt nur Brettzüge.
  const legalMoves = allMoves.filter((m): m is BoardMove => m.type === 'move');
  const hint = anyHint?.type === 'move' ? anyHint : null;
  const [selected, setSelected] = useState<number | null>(null);
  const [promotion, setPromotion] = useState<BoardMove[] | null>(null);
  const [showMoves, setShowMoves] = useState(false);
  const [warning, setWarning] = useState<CheckWarning | null>(null);
  /** Vorgezogener Zug: wird ausgeführt, sobald man am Zug ist. */
  const [premove, setPremove] = useState<{ from: number; to: number } | null>(null);
  /** Rückblick: Halbzug (0-basiert), dessen Stellung gezeigt wird – oder null für die laufende Partie. */
  const [review, setReview] = useState<number | null>(null);
  const [fly, setFly] = useState<Fly | null>(null);
  const [lastView, setLastView] = useState(view);
  if (lastView !== view) {
    setLastView(view);
    setSelected(null);
    setPromotion(null);
    setWarning(null);
  }

  useEffect(() => {
    if (!warning) return;
    const id = window.setTimeout(() => setWarning(null), 6000);
    return () => window.clearTimeout(id);
  }, [warning]);

  // Bei festem Brett: Wechselt der Betrachter zwischen beiden Farben (zwei Menschen), bleibt Weiß unten.
  const [anchor, setAnchor] = useState(typeof viewer === 'number' ? viewer : 0);
  if (typeof viewer === 'number' && viewer !== anchor && anchor !== 0) setAnchor(0);

  // Wer Schwarz spielt, sieht das Brett von der schwarzen Seite.
  const seat = view.rotate === false ? anchor : typeof viewer === 'number' ? viewer : activeSeat;
  const flipped = seat === 1;
  const toBoard = (dc: number, dr: number) => (flipped ? (7 - dr) * 8 + (7 - dc) : dr * 8 + dc);

  const played = useMemo(() => replay(view.history), [view.history]);
  const reviewing = review !== null && played !== null && review < played.moves.length;
  const fen = reviewing ? (played.fens[review] ?? view.fen) : view.fen;
  const shownLast = reviewing ? played.moves[review] : null;
  const lastMove = reviewing ? (shownLast ? { from: shownLast.from, to: shownLast.to } : null) : view.lastMove;

  const board = parseBoard(fen);
  const whiteToMove = fen.split(' ')[1] === 'w';
  const moves = reviewing ? [] : legalMoves.map((m) => ({ move: m, from: squareIndex(m.from), to: squareIndex(m.to) }));
  const movable = new Set(moves.map((m) => m.from));

  // Vorziehen: Wer nicht am Zug ist, darf eine eigene Figur und ein Ziel vormerken.
  const myWhite = typeof viewer === 'number' ? viewer === 0 : null;
  const canPremove = !reviewing && myWhite !== null && !view.end && whiteToMove !== myWhite && moves.length === 0;
  const preMoves = useMemo(() => (canPremove && myWhite !== null ? premoveCandidates(view.fen, myWhite) : []), [canPremove, myWhite, view.fen]);
  const preMovable = new Set(preMoves.map((m) => m.from));

  const targets = new Set(
    selected === null ? [] : canPremove ? preMoves.filter((m) => m.from === selected).map((m) => m.to) : moves.filter((m) => m.from === selected).map((m) => m.to),
  );
  const last = lastMove ? [squareIndex(lastMove.from), squareIndex(lastMove.to)] : [];
  const hinted = hint && !reviewing ? [squareIndex(hint.from), squareIndex(hint.to)] : [];
  const check = checkAttackers(fen);
  const checkedKing = check?.king ?? -1;
  const checkers = new Set(check?.attackers.map((a) => a.sq) ?? []);

  // Sobald man am Zug ist: vorgemerkten Zug ausführen – oder verwerfen, wenn er nicht mehr geht.
  useEffect(() => {
    if (!premove || moves.length === 0) return;
    const options = moves.filter((m) => m.from === premove.from && m.to === premove.to).map((m) => m.move);
    setPremove(null);
    const move = options.find((m) => m.promotion === 'q') ?? options[0];
    if (move) onMove(move);
    else setWarning({ text: 'Dein vorgezogener Zug ist nicht mehr möglich – zieh bitte neu.' });
  });
  if (premove && view.end) setPremove(null);

  const wasDraggedRef = useRef(false);
  const wasDragged = wasDraggedRef.current;
  wasDraggedRef.current = false;

  const lastMoveObj = lastMove ? { from: squareIndex(lastMove.from), to: squareIndex(lastMove.to) } : null;

  let extraMoves: MoveAnimationItem[] | undefined;
  if (lastMoveObj) {
    const from = lastMoveObj.from;
    const to = lastMoveObj.to;
    // Rochade (Castling): König zieht 2 Felder waagerecht, Turm gleitet mit
    const kingMoved = board[to]?.type === 'k';
    if (kingMoved && from === 60 && to === 62) {
      extraMoves = [{ from: 63, to: 61 }];
    } else if (kingMoved && from === 60 && to === 58) {
      extraMoves = [{ from: 56, to: 59 }];
    } else if (kingMoved && from === 4 && to === 6) {
      extraMoves = [{ from: 7, to: 5 }];
    } else if (kingMoved && from === 4 && to === 2) {
      extraMoves = [{ from: 0, to: 3 }];
    }
  }

  const toDisplayCoord = (pos: number | string) => {
    const index = typeof pos === 'string' ? squareIndex(pos) : pos;
    if (index < 0 || index >= 64) return null;
    const r = Math.floor(index / 8);
    const c = index % 8;
    return flipped ? { col: 7 - c, row: 7 - r } : { col: c, row: r };
  };

  const { getSlideProps } = useGridMoveAnimation({
    lastMove: lastMoveObj,
    extraMoves,
    toDisplayCoord,
    wasDragged,
    moveKey: reviewing ? `r${review}` : view.history.length,
  });

  // Schlagen: Die geschlagene Figur rutscht in die Leiste dessen, der geschlagen hat.
  const lastLength = useRef(view.history.length);
  useEffect(() => {
    const before = lastLength.current;
    lastLength.current = view.history.length;
    if (view.history.length !== before + 1 || !played) return;
    const move = played.moves.at(-1);
    if (!move?.captured) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const at = toDisplayCoord(move.to);
    if (!at) return;
    const capturerWhite = move.color === 'w';
    const bottom = capturerWhite === !flipped;
    const taken = capturedBy(parseBoard(view.fen), capturerWhite).length;
    // Brett 8 Einheiten breit, Leisten je eine halbe Einheit hoch (Seitenverhältnis 8 : 9).
    setFly({
      key: view.history.length,
      type: move.captured as PieceType,
      white: !capturerWhite,
      from: { x: ((at.col + 0.5) / 8) * 100, y: ((at.row + 1) / 9) * 100 },
      to: { x: Math.min(4 + taken * 4, 60), y: bottom ? 97.2 : 2.8 },
    });
  }, [view.history.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const { dragState, bindDrag } = usePointerDrag<number>({
    threshold: 6,
    onDrop: (fromIndex, targetId) => {
      if (!targetId) return false;
      const toIndex = Number(targetId);
      if (canPremove) {
        if (preMoves.some((m) => m.from === fromIndex && m.to === toIndex)) {
          setPremove({ from: fromIndex, to: toIndex });
          setSelected(null);
        }
        return false;
      }
      const options = moves.filter((m) => m.from === fromIndex && m.to === toIndex).map((m) => m.move);
      if (options.length > 1) {
        setWarning(null);
        setPromotion(PROMOTIONS.map((p) => options.find((o) => o.promotion === p)).filter((o): o is BoardMove => !!o));
        return true;
      } else if (options[0]) {
        wasDraggedRef.current = true;
        setWarning(null);
        onMove(options[0]);
        return true;
      }
      const warn = getCheckWarning(view.fen, fromIndex, toIndex, legalMoves);
      if (warn) setWarning(warn);
      return false;
    },
  });

  const dragSource = dragState.isDragging && dragState.item !== null ? dragState.item : null;
  const dragList = canPremove ? preMoves : moves;
  const dragTargets = dragSource !== null ? new Set(dragList.filter((m) => m.from === dragSource).map((m) => m.to)) : null;
  const effectiveTargets = dragTargets ?? targets;

  // Pfeiltasten im Rückblick.
  useEffect(() => {
    if (!reviewing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') step(-1);
      else if (event.key === 'ArrowRight') step(1);
      else if (event.key === 'Escape') setReview(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const step = (delta: number) => {
    if (review === null) return;
    const next = review + delta;
    if (next < 0) return;
    if (next >= view.history.length) setReview(null);
    else setReview(next);
  };

  const tap = (index: number) => {
    if (reviewing) return;
    if (canPremove) {
      if (selected !== null && targets.has(index)) {
        setPremove({ from: selected, to: index });
        setSelected(null);
      } else if (preMovable.has(index) && index !== selected) {
        setSelected(index);
      } else {
        setSelected(null);
        setPremove(null);
      }
      return;
    }

    // 1. Zielfeld für bereits ausgewählte Figur angetippt
    if (selected !== null && targets.has(index)) {
      setWarning(null);
      const options = moves.filter((m) => m.from === selected && m.to === index).map((m) => m.move);
      if (options.length > 1) setPromotion(PROMOTIONS.map((p) => options.find((o) => o.promotion === p)).filter((o): o is BoardMove => !!o));
      else if (options[0]) onMove(options[0]);
      return;
    }

    // 2. Ungültiges Zielfeld für bereits ausgewählte Figur angetippt?
    if (selected !== null && index !== selected) {
      const ownPiece = board[index]?.white === whiteToMove;
      // Falls es eine andere eigene Figur ist, die selbst ziehen kann: neue Figur auswählen
      if (ownPiece && movable.has(index)) {
        setWarning(null);
        setSelected(index);
        return;
      }
      // Prüfen, ob der Zugversuch von 'selected' nach 'index' am Schachgebot scheitert
      const warn = getCheckWarning(view.fen, selected, index, legalMoves);
      if (warn) {
        setWarning(warn);
        return;
      }
      // Andernfalls: Klick auf unbewegliche eigene Figur prüfen
      if (ownPiece) {
        const pieceWarn = getCheckWarning(view.fen, index, null, legalMoves);
        if (pieceWarn) {
          setWarning(pieceWarn);
          setSelected(null);
          return;
        }
      }
      setWarning(null);
      setSelected(null);
      return;
    }

    // 3. Wenn dieselbe Figur erneut angetippt wird: abwählen
    if (index === selected) {
      setSelected(null);
      setWarning(null);
      return;
    }

    // 4. Neue eigene Figur angetippt
    if (movable.has(index)) {
      setWarning(null);
      setSelected(index);
      return;
    }

    // 5. Eigene Figur angetippt, die sich nicht bewegen darf: Erklärung ermitteln
    const piece = board[index];
    if (piece && piece.white === whiteToMove) {
      const warn = getCheckWarning(view.fen, index, null, legalMoves);
      if (warn) {
        setWarning(warn);
        setSelected(null);
        return;
      }
    }

    setSelected(null);
    setWarning(null);
  };

  // Schach in Worten: Wer greift den König an?
  const ownKing = myWhite === null || myWhite === whiteToMove;
  const checkText = check
    ? `${view.end === 'checkmate' && !reviewing ? 'Schachmatt!' : 'Schach!'} ${ownKing && myWhite !== null ? 'Dein König' : `Der ${whiteToMove ? 'weiße' : 'schwarze'} König`} wird ${check.attackers.map((a) => `${PIECE_DATIVE[a.type]} auf ${squareName(a.sq)}`).join(' und ')} angegriffen.`
    : null;

  // 8 : 10 – Brett, Leisten darüber und darunter und die Remis-Zeile.
  return (
    <FitBox ratio={8 / 10}>
      <div className="ch-wrap">
        {reviewing ? (
          <div className="ch-review">
            <button type="button" onClick={() => step(-1)} disabled={review === 0} aria-label="Zug zurück" title="Zug zurück (←)">
              ◀
            </button>
            <span>
              Rückblick · Zug {Math.floor(review / 2) + 1}
              {review % 2 === 1 ? ' (Schwarz)' : ' (Weiß)'}
            </span>
            <button type="button" onClick={() => step(1)} aria-label="Zug vor" title="Zug vor (→)">
              ▶
            </button>
            <button type="button" className="ch-review-back" onClick={() => setReview(null)} title="Zurück zur Partie (Esc)">
              Zur Partie
            </button>
          </div>
        ) : (
          <CaptureStrip board={board} white={flipped} lead={materialLead(fen, flipped)} />
        )}
        <div className="ch-board-area">
          <GridBoard
            cols={8}
            rows={8}
            label="Schachbrett"
            className={`ch-board ${reviewing ? 'ch-reviewing' : ''}`}
            renderCell={(dc, dr) => {
              const index = toBoard(dc, dr);
              const piece = board[index];
              const slide = getSlideProps(index);
              const isDragged = (dragState.isDragging || dragState.snapping) && dragState.item === index;
              const pieceTransform = isDragged ? `translate3d(${dragState.delta.x}px, ${dragState.delta.y}px, 0)` : undefined;
              return (
                <>
                  {piece ? (
                    <span
                      key={slide.isSliding ? `slide-${index}` : undefined}
                      className={`ch-piece ${piece.white ? 'ch-white' : 'ch-black'} ${isDragged ? 'bub-dragging' : ''} ${dragState.snapping && isDragged ? 'bub-snapping' : ''} ${slide.pieceClassName ?? ''}`}
                      style={{
                        ...slide.style,
                        transform: pieceTransform,
                        position: isDragged ? 'relative' : undefined,
                        zIndex: isDragged ? 1000 : undefined,
                      }}
                      onAnimationEnd={slide.onAnimationEnd}
                    >
                      {GLYPHS[piece.type]}
                    </span>
                  ) : effectiveTargets.has(index) ? (
                    <span className={canPremove ? 'ch-dot ch-dot-pre' : 'ch-dot'} />
                  ) : null}
                  {dc === 0 && <span className="ch-coord ch-rank">{8 - Math.floor(index / 8)}</span>}
                  {dr === 7 && <span className="ch-coord ch-file">{FILES[index % 8]}</span>}
                </>
              );
            }}
            isActive={(dc, dr) => {
              if (reviewing) return false;
              const index = toBoard(dc, dr);
              if (canPremove) return preMovable.has(index) || effectiveTargets.has(index) || selected !== null || premove !== null;
              const piece = board[index];
              const isOwnPiece = piece && piece.white === whiteToMove;
              return movable.has(index) || effectiveTargets.has(index) || Boolean(isOwnPiece) || selected !== null;
            }}
            onActivate={(dc, dr) => tap(toBoard(dc, dr))}
            cellProps={(dc, dr) => {
              const index = toBoard(dc, dr);
              if (reviewing) return {};
              const piece = board[index];
              const isTarget = dragTargets !== null && dragTargets.has(index);
              const isDropActive = isTarget && dragState.targetId === String(index);
              const draggable = canPremove ? preMovable.has(index) : movable.has(index) || (piece && piece.white === whiteToMove);
              const dragBind = draggable ? bindDrag(index) : undefined;
              return {
                'data-drop-target': String(index),
                'data-drop-active': isDropActive ? 'true' : undefined,
                ...dragBind,
              };
            }}
            cellClassName={(dc, dr) => {
              const index = toBoard(dc, dr);
              const slide = getSlideProps(index);
              const classes = [(Math.floor(index / 8) + (index % 8)) % 2 === 0 ? 'ch-light' : 'ch-dark'];
              if (slide.cellClassName) classes.push(slide.cellClassName);
              if (last.includes(index)) classes.push('ch-last');
              if (index === checkedKing) classes.push('ch-check');
              if (checkers.has(index)) classes.push('ch-checker');
              if (index === selected || index === dragSource) classes.push(canPremove ? 'ch-selected-pre' : 'ch-selected');
              if (effectiveTargets.has(index) && board[index]) classes.push(canPremove ? 'ch-capture-pre' : 'ch-capture');
              if (premove && (premove.from === index || premove.to === index)) classes.push('ch-premove');
              if (hinted.includes(index)) classes.push('ch-hint');
              if (warning?.pinnedSquare === index) classes.push('ch-pinned');
              if (warning?.kingSquare === index) classes.push('ch-warn-king');
              if (warning?.attackerSquares?.includes(index)) classes.push('ch-warn-attacker');
              return classes.join(' ');
            }}
            cellLabel={(dc, dr) => {
              const index = toBoard(dc, dr);
              const piece = board[index];
              return `${squareName(index)}: ${piece ? `${piece.white ? 'weißer' : 'schwarzer'} ${PIECE_NAMES[piece.type]}` : 'frei'}${index === checkedKing ? ' – steht im Schach' : ''}`;
            }}
          />
          {check && (
            <svg className="ch-arrows" viewBox="0 0 8 8" aria-hidden="true">
              <defs>
                <marker id="ch-arrowhead" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" className="ch-arrowhead" />
                </marker>
              </defs>
              {check.attackers.map((a) => {
                const from = toDisplayCoord(a.sq);
                const to = toDisplayCoord(check.king);
                if (!from || !to) return null;
                const x1 = from.col + 0.5;
                const y1 = from.row + 0.5;
                const x2 = to.col + 0.5;
                const y2 = to.row + 0.5;
                const len = Math.hypot(x2 - x1, y2 - y1) || 1;
                return <line key={a.sq} className="ch-arrow" x1={x1} y1={y1} x2={x2 - ((x2 - x1) / len) * 0.3} y2={y2 - ((y2 - y1) / len) * 0.3} markerEnd="url(#ch-arrowhead)" />;
              })}
            </svg>
          )}
        </div>
        {warning && (
          <div className="ch-warning-banner" role="alert" aria-live="polite">
            <span className="ch-warning-icon">⚠️</span>
            <span className="ch-warning-text">{warning.text}</span>
            <button type="button" className="ch-warning-close" onClick={() => setWarning(null)} aria-label="Hinweis schließen" title="Schließen">
              ✕
            </button>
          </div>
        )}
        {!reviewing && (
          <DrawOfferBar
            offer={view.drawOffer}
            legalMoves={allMoves}
            onMove={onMove}
            turn={view.fen.split(' ')[1] === 'w' ? 0 : 1}
            ply={view.history.length}
            seatNames={seatNames}
            ended={view.end !== null}
          />
        )}
        <div className="ch-bottom">
          {/* Ein Hinweis liegt über dieser Leiste – dann bleibt sie leer, damit sich nichts überdeckt. */}
          {warning ? (
            <span />
          ) : checkText ? (
            <span className="ch-check-pill" role="status">
              ⚠️ {checkText}
            </span>
          ) : premove ? (
            <span className="ch-premove-text">
              ⏳ Vorgemerkt: {squareName(premove.from)}–{squareName(premove.to)}
            </span>
          ) : (
            <CaptureStrip board={board} white={!flipped} lead={materialLead(fen, !flipped)} />
          )}
          {view.history.length > 0 && (
            <button type="button" className="ch-moves-button" onClick={() => setShowMoves(true)} aria-label="Chronik anzeigen" title="Chronik">
              {Math.ceil(view.history.length / 2)}.{view.history.length % 2 === 0 ? '…' : ''} {germanSan(view.history.at(-1) ?? '')} 📜
            </button>
          )}
        </div>
        {fly && (
          <span
            key={fly.key}
            className={`ch-fly ${fly.white ? 'ch-white' : 'ch-black'}`}
            style={{ '--x0': `${fly.from.x}%`, '--y0': `${fly.from.y}%`, '--x1': `${fly.to.x}%`, '--y1': `${fly.to.y}%` } as CSSProperties}
            onAnimationEnd={() => setFly(null)}
            aria-hidden="true"
          >
            {GLYPHS[fly.type]}
          </span>
        )}
        {showMoves && (
          <Chronicle
            moves={played?.moves ?? null}
            history={view.history}
            pgn={() => toPgn(view, [seatNames[0] ?? 'Weiß', seatNames[1] ?? 'Schwarz'])}
            onPick={(ply) => {
              setShowMoves(false);
              setReview(ply);
            }}
            onClose={() => setShowMoves(false)}
          />
        )}
        {promotion && (
          <div className="ch-promotion" role="dialog" aria-label="Umwandlung wählen">
            {promotion.map((m) => (
              <button key={m.promotion} type="button" onClick={() => onMove(m)} aria-label={PIECE_NAMES[m.promotion ?? 'q']}>
                <span className={`ch-piece ${whiteToMove ? 'ch-white' : 'ch-black'}`}>{GLYPHS[m.promotion ?? 'q']}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </FitBox>
  );
}

/** Speichert Text als Datei (z. B. die Partie als .pgn). */
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/x-chess-pgn' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function Chronicle({
  moves,
  history,
  pgn,
  onPick,
  onClose,
}: {
  moves: Move[] | null;
  history: string[];
  pgn: () => string;
  onPick: (ply: number) => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<'ok' | 'failed' | null>(null);
  // Ist die Zwischenablage gesperrt (manche Schulrechner), steht die Partie zum Kopieren von Hand da.
  const copy = () => {
    const fail = () => setCopied('failed');
    if (!navigator.clipboard) return fail();
    navigator.clipboard.writeText(pgn()).then(() => setCopied('ok'), fail);
  };
  const listRef = useRef<HTMLOListElement>(null);
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);
  const cell = (ply: number) => {
    const move = moves?.[ply];
    if (!move) return <span className="ch-log-cell">{germanSan(history[ply] ?? '')}</span>;
    return (
      <button type="button" className={`ch-log-cell ${move.captured ? 'ch-log-hit' : ''}`} onClick={() => onPick(ply)} title="Stellung ansehen">
        <MoveText move={move} />
      </button>
    );
  };
  return (
    <div className="ch-moves" role="dialog" aria-label="Chronik">
      <div className="ch-log-head">
        <strong>📜 Chronik</strong>
        <span>Zug antippen, um die Stellung zu sehen</span>
      </div>
      <ol ref={listRef}>
        {Array.from({ length: Math.ceil(history.length / 2) }, (_, i) => (
          <li key={i}>
            {cell(2 * i)}
            {2 * i + 1 < history.length ? cell(2 * i + 1) : <span className="ch-log-cell" />}
          </li>
        ))}
      </ol>
      {copied === 'failed' && (
        <textarea className="ch-log-pgn" readOnly value={pgn()} aria-label="PGN-Partie zum Kopieren" onFocus={(e) => e.currentTarget.select()} autoFocus />
      )}
      <div className="ch-log-actions">
        <button type="button" className="ch-log-close" onClick={copy} title="Partie im PGN-Format in die Zwischenablage kopieren">
          {copied === 'ok' ? '✅ Kopiert' : copied === 'failed' ? '⬆️ Oben markieren und kopieren' : '📋 PGN kopieren'}
        </button>
        <button type="button" className="ch-log-close" onClick={() => download('schach.pgn', pgn())} title="Partie als PGN-Datei speichern">
          💾 Speichern
        </button>
        <button type="button" className="ch-log-close" onClick={onClose}>
          Schließen
        </button>
      </div>
    </div>
  );
}

function SeatSymbol({ seat, className = '' }: { seat: SeatId; className?: string }) {
  return <span className={`ch-symbol ch-piece ${seat === 0 ? 'ch-white' : 'ch-black'} ${className}`}>{GLYPHS.k}</span>;
}

/** Materialvorsprung einer Seite in Bauerneinheiten (Dame 9, Turm 5, Läufer/Springer 3). */
function materialLead(fen: string, white: boolean): number {
  return parseBoard(fen).reduce((sum, p) => (p ? sum + (p.white === white ? VALUES[p.type] : -VALUES[p.type]) : sum), 0);
}

export const gameUi: GameUi<ChessState, ChessMove> = {
  Board,
  SetupExtra: PgnSetup,
  SeatSymbol,
  sounds: {
    moved: (event) => [
      /=/.test(String(event.san)) ? 'schach-umwandlung' : /^O-O/.test(String(event.san)) ? 'schach-rochade' : event.captured ? 'stein-schlagen' : 'stein-ziehen',
      ...(event.check && !event.mate ? (['ruf-schach'] as const) : []),
    ],
    over: (event) => (event.end === 'checkmate' ? ['schach-matt', 'ruf-matt'] : event.end === 'stalemate' ? 'ruf-patt' : null),
  },
  seatLabel: (seat) => (seat === 0 ? 'Weiß' : 'Schwarz'),
  seatDetail: (view, seat) => {
    const white = seat === 0;
    const parts = [white ? 'Weiß' : 'Schwarz'];
    const toMove = (view.fen.split(' ')[1] === 'w') === white;
    if (view.inCheck && toMove && !view.end) {
      const check = checkAttackers(view.fen);
      parts.push(check?.attackers[0] ? `Schach durch ${PIECE_NAMES[check.attackers[0].type]}!` : 'Schach!');
    }
    if (view.end === 'checkmate' && toMove) parts.push('matt');
    return parts.join(' · ');
  },
};
