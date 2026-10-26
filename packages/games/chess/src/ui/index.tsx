import type { SeatId } from '@brett-und-blatt/engine';
import { FitBox, GridBoard, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import { useState } from 'react';
import type { ChessMove, ChessState, Promotion } from '../rules';
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

function Board({ view, legalMoves, onMove, viewer, activeSeat, hint }: BoardProps<ChessState, ChessMove>) {
  const [selected, setSelected] = useState<number | null>(null);
  const [promotion, setPromotion] = useState<ChessMove[] | null>(null);
  const [showMoves, setShowMoves] = useState(false);
  const [lastView, setLastView] = useState(view);
  if (lastView !== view) {
    setLastView(view);
    setSelected(null);
    setPromotion(null);
  }
  // Bei festem Brett: Wechselt der Betrachter zwischen beiden Farben (zwei Menschen), bleibt Weiß unten.
  const [anchor, setAnchor] = useState(typeof viewer === 'number' ? viewer : 0);
  if (typeof viewer === 'number' && viewer !== anchor && anchor !== 0) setAnchor(0);

  // Wer Schwarz spielt, sieht das Brett von der schwarzen Seite.
  const seat = view.rotate === false ? anchor : typeof viewer === 'number' ? viewer : activeSeat;
  const flipped = seat === 1;
  const toBoard = (dc: number, dr: number) => (flipped ? (7 - dr) * 8 + (7 - dc) : dr * 8 + dc);

  const board = parseBoard(view.fen);
  const whiteToMove = view.fen.split(' ')[1] === 'w';
  const moves = legalMoves.map((m) => ({ move: m, from: squareIndex(m.from), to: squareIndex(m.to) }));
  const movable = new Set(moves.map((m) => m.from));
  const targets = new Set(selected === null ? [] : moves.filter((m) => m.from === selected).map((m) => m.to));
  const last = view.lastMove ? [squareIndex(view.lastMove.from), squareIndex(view.lastMove.to)] : [];
  const hinted = hint ? [squareIndex(hint.from), squareIndex(hint.to)] : [];
  const checkedKing = view.inCheck ? board.findIndex((p) => p?.type === 'k' && p.white === whiteToMove) : -1;

  const tap = (index: number) => {
    if (selected !== null && targets.has(index)) {
      const options = moves.filter((m) => m.from === selected && m.to === index).map((m) => m.move);
      if (options.length > 1) setPromotion(PROMOTIONS.map((p) => options.find((o) => o.promotion === p)).filter((o): o is ChessMove => !!o));
      else if (options[0]) onMove(options[0]);
      return;
    }
    setSelected(movable.has(index) && index !== selected ? index : null);
  };

  return (
    <FitBox ratio={8 / 9}>
      <div className="ch-wrap">
        <CaptureStrip board={board} white={flipped} lead={materialLead(view.fen, flipped)} />
        <GridBoard
          cols={8}
          rows={8}
          label="Schachbrett"
          className="ch-board"
          renderCell={(dc, dr) => {
            const index = toBoard(dc, dr);
            const piece = board[index];
            return (
              <>
                {piece ? <span className={`ch-piece ${piece.white ? 'ch-white' : 'ch-black'}`}>{GLYPHS[piece.type]}</span> : targets.has(index) ? <span className="ch-dot" /> : null}
                {dc === 0 && <span className="ch-coord ch-rank">{8 - Math.floor(index / 8)}</span>}
                {dr === 7 && <span className="ch-coord ch-file">{FILES[index % 8]}</span>}
              </>
            );
          }}
          isActive={(dc, dr) => {
            const index = toBoard(dc, dr);
            return movable.has(index) || targets.has(index);
          }}
          onActivate={(dc, dr) => tap(toBoard(dc, dr))}
          cellClassName={(dc, dr) => {
            const index = toBoard(dc, dr);
            const classes = [(Math.floor(index / 8) + (index % 8)) % 2 === 0 ? 'ch-light' : 'ch-dark'];
            if (last.includes(index)) classes.push('ch-last');
            if (index === checkedKing) classes.push('ch-check');
            if (index === selected) classes.push('ch-selected');
            if (targets.has(index) && board[index]) classes.push('ch-capture');
            if (hinted.includes(index)) classes.push('ch-hint');
            return classes.join(' ');
          }}
          cellLabel={(dc, dr) => {
            const index = toBoard(dc, dr);
            const piece = board[index];
            return `${squareName(index)}: ${piece ? `${piece.white ? 'weißer' : 'schwarzer'} ${PIECE_NAMES[piece.type]}` : 'frei'}`;
          }}
        />
        <div className="ch-bottom">
          <CaptureStrip board={board} white={!flipped} lead={materialLead(view.fen, !flipped)} />
          {view.history.length > 0 && (
            <button type="button" className="ch-moves-button" onClick={() => setShowMoves(true)} aria-label="Alle Züge anzeigen">
              {Math.ceil(view.history.length / 2)}.{view.history.length % 2 === 0 ? '…' : ''} {germanSan(view.history.at(-1) ?? '')} 📜
            </button>
          )}
        </div>
        {showMoves && (
          <div className="ch-moves" role="dialog" aria-label="Partieverlauf">
            <ol>
              {Array.from({ length: Math.ceil(view.history.length / 2) }, (_, i) => (
                <li key={i}>
                  <span>{germanSan(view.history[2 * i] ?? '')}</span>
                  <span>{germanSan(view.history[2 * i + 1] ?? '')}</span>
                </li>
              ))}
            </ol>
            <button type="button" onClick={() => setShowMoves(false)}>
              Schließen
            </button>
          </div>
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

function SeatSymbol({ seat, className = '' }: { seat: SeatId; className?: string }) {
  return <span className={`ch-symbol ch-piece ${seat === 0 ? 'ch-white' : 'ch-black'} ${className}`}>{GLYPHS.k}</span>;
}

/** Materialvorsprung einer Seite in Bauerneinheiten (Dame 9, Turm 5, Läufer/Springer 3). */
function materialLead(fen: string, white: boolean): number {
  return parseBoard(fen).reduce((sum, p) => (p ? sum + (p.white === white ? VALUES[p.type] : -VALUES[p.type]) : sum), 0);
}

export const gameUi: GameUi<ChessState, ChessMove> = {
  Board,
  SeatSymbol,
  sounds: {
    moved: (event) => [event.captured ? 'stein-schlagen' : 'stein-ziehen', ...(event.check ? (['schach'] as const) : [])],
  },
  seatLabel: (seat) => (seat === 0 ? 'Weiß' : 'Schwarz'),
  seatDetail: (view, seat) => {
    const white = seat === 0;
    const parts = [white ? 'Weiß' : 'Schwarz'];
    const toMove = (view.fen.split(' ')[1] === 'w') === white;
    if (view.inCheck && toMove && !view.end) parts.push('Schach!');
    if (view.end === 'checkmate' && toMove) parts.push('matt');
    return parts.join(' · ');
  },
};
