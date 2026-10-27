import type { SeatId } from '@brett-und-blatt/engine';
import {
  FitBox,
  GridBoard,
  usePointerDrag,
  type BoardProps,
  type GameUi,
} from '@brett-und-blatt/ui';
import { useState } from 'react';
import {
  countPieces,
  isDarkSquare,
  squareName,
  type CheckersMove,
  type CheckersPiece,
  type CheckersState,
} from '../rules';
import './styles.css';

const LABELS = ['Weiß', 'Schwarz'];
const FILES = 'abcdefghij';

function PieceView({
  piece,
  isDragged,
  isMustCapture,
  dragTransform,
}: {
  piece: CheckersPiece;
  isDragged?: boolean;
  isMustCapture?: boolean;
  dragTransform?: string;
}) {
  return (
    <span
      className={`dk-piece ${piece.seat === 0 ? 'dk-white' : 'dk-black'} ${isMustCapture ? 'dk-must-capture' : ''} ${isDragged ? 'bub-dragging' : ''}`}
      style={{
        transform: dragTransform,
        position: isDragged ? 'relative' : undefined,
        zIndex: isDragged ? 1000 : undefined,
      }}
      aria-label={`${LABELS[piece.seat]} ${piece.king ? 'Dame' : 'Stein'}`}
    >
      {piece.king && <span className="dk-crown" aria-hidden="true">👑</span>}
    </span>
  );
}

function materialScore(counts: { men: number; kings: number }): number {
  return counts.men * 1 + counts.kings * 3;
}

function CaptureStrip({
  view,
  forWhite,
  lead,
}: {
  view: CheckersState;
  forWhite: boolean;
  lead: number;
}) {
  const initialPerSide = view.size === 10 ? 20 : 12;
  const [whiteCount, blackCount] = countPieces(view.cells);
  // forWhite = true zeigt, was Weiß geschlagen hat (also fehlende schwarze Steine)
  const oppCount = forWhite ? blackCount : whiteCount;
  const takenCount = Math.max(0, initialPerSide - oppCount.total);
  const oppSeat = forWhite ? 1 : 0;

  return (
    <div
      className="dk-strip"
      aria-label={`${forWhite ? 'Weiß' : 'Schwarz'} hat geschlagen: ${takenCount} Steine`}
    >
      <span className="dk-taken-group" aria-hidden="true">
        <span className={`dk-mini-stone ${oppSeat === 0 ? 'dk-mini-white' : 'dk-mini-black'}`} />
        <span>× {takenCount}</span>
      </span>
      {lead > 0 && <span className="dk-lead">+{lead}</span>}
    </div>
  );
}

function Board({ view, legalMoves, onMove, viewer, activeSeat, hint }: BoardProps<CheckersState, CheckersMove>) {
  const [selected, setSelected] = useState<number | null>(null);
  const [showMoves, setShowMoves] = useState(false);
  const [lastView, setLastView] = useState(view);

  if (lastView !== view) {
    setLastView(view);
    setSelected(null);
  }

  const [anchor, setAnchor] = useState(typeof viewer === 'number' ? viewer : 0);
  if (typeof viewer === 'number' && viewer !== anchor && anchor !== 0) setAnchor(0);

  const seat = view.rotate === false ? anchor : typeof viewer === 'number' ? viewer : activeSeat;
  const flipped = seat === 1;
  const { size } = view;

  // Umrechnung von Bildschirmkoordinaten (dc, dr) zu Brettindex
  const toBoard = (dc: number, dr: number) =>
    flipped ? (size - 1 - dr) * size + (size - 1 - dc) : dr * size + dc;

  const movable = new Set(legalMoves.map((m) => m.from));
  const isCapturing = legalMoves.some((m) => (m.captures?.length ?? 0) > 0);
  const targets = new Set(selected === null ? [] : legalMoves.filter((m) => m.from === selected).map((m) => m.to));
  const last = view.lastMove ? [view.lastMove.from, view.lastMove.to] : [];
  const hinted = hint ? [hint.from, hint.to] : [];

  const { dragState, bindDrag } = usePointerDrag<number>({
    threshold: 6,
    onDrop: (fromIndex, targetId) => {
      if (!targetId) return false;
      const toIndex = Number(targetId);
      const options = legalMoves.filter((m) => m.from === fromIndex && m.to === toIndex);
      if (options[0]) {
        onMove(options[0]);
        return true;
      }
      return false;
    },
  });

  const dragSource = dragState.isDragging && dragState.item !== null ? dragState.item : null;
  const dragTargets = dragSource !== null ? new Set(legalMoves.filter((m) => m.from === dragSource).map((m) => m.to)) : null;
  const effectiveTargets = dragTargets ?? targets;

  const tap = (index: number) => {
    if (selected !== null && targets.has(index)) {
      const options = legalMoves.filter((m) => m.from === selected && m.to === index);
      if (options[0]) onMove(options[0]);
      return;
    }
    setSelected(movable.has(index) && index !== selected ? index : null);
  };

  const [wCount, bCount] = countPieces(view.cells);
  const whiteScore = materialScore(wCount);
  const blackScore = materialScore(bCount);
  const whiteLead = whiteScore - blackScore;
  const blackLead = blackScore - whiteScore;

  // Paarweise Zughistorie formattieren
  const historyPairs: { num: number; white: string; black?: string }[] = [];
  for (let i = 0; i < view.history.length; i += 2) {
    historyPairs.push({
      num: Math.floor(i / 2) + 1,
      white: view.history[i] ?? '',
      black: view.history[i + 1],
    });
  }

  return (
    <FitBox ratio={8 / 9}>
      <div className="dk-wrap">
        <CaptureStrip view={view} forWhite={flipped} lead={flipped ? whiteLead : blackLead} />

        <GridBoard
          cols={size}
          rows={size}
          label="Damebrett"
          className="dk-board"
          renderCell={(dc, dr) => {
            const index = toBoard(dc, dr);
            const piece = view.cells[index];
            const isDragged = (dragState.isDragging || dragState.snapping) && dragState.item === index;
            const pieceTransform = isDragged
              ? `translate3d(${dragState.delta.x}px, ${dragState.delta.y}px, 0)`
              : undefined;

            const isMustCap = isCapturing && movable.has(index) && selected !== index && dragSource !== index;

            return (
              <>
                {piece ? (
                  <PieceView
                    piece={piece}
                    isDragged={isDragged}
                    isMustCapture={isMustCap}
                    dragTransform={pieceTransform}
                  />
                ) : effectiveTargets.has(index) ? (
                  <span className={isCapturing ? 'dk-capture-dot' : 'dk-dot'} />
                ) : null}

                {dc === 0 && (
                  <span className="dk-coord dk-rank">
                    {flipped ? dr + 1 : size - dr}
                  </span>
                )}
                {dr === size - 1 && (
                  <span className="dk-coord dk-file">
                    {flipped ? FILES[size - 1 - dc] : FILES[dc]}
                  </span>
                )}
              </>
            );
          }}
          isActive={(dc, dr) => {
            const index = toBoard(dc, dr);
            return movable.has(index) || effectiveTargets.has(index);
          }}
          onActivate={(dc, dr) => tap(toBoard(dc, dr))}
          cellProps={(dc, dr) => {
            const index = toBoard(dc, dr);
            const isMovable = movable.has(index);
            const isTarget = dragTargets !== null && dragTargets.has(index);
            const isDropActive = isTarget && dragState.targetId === String(index);
            const dragBind = isMovable ? bindDrag(index) : undefined;
            return {
              'data-drop-target': String(index),
              'data-drop-active': isDropActive ? 'true' : undefined,
              ...dragBind,
            };
          }}
          cellClassName={(dc, dr) => {
            const index = toBoard(dc, dr);
            const col = index % size;
            const row = Math.floor(index / size);
            const classes = [isDarkSquare(col, row) ? 'dk-dark' : 'dk-light'];
            if (last.includes(index)) classes.push('dk-last');
            if (index === selected || index === dragSource) classes.push('dk-selected');
            if (hinted.includes(index)) classes.push('dk-hint');
            return classes.join(' ');
          }}
          cellLabel={(dc, dr) => {
            const index = toBoard(dc, dr);
            const piece = view.cells[index];
            const name = squareName(index, size);
            if (!piece) return name;
            return `${name}: ${LABELS[piece.seat]} ${piece.king ? 'Dame' : 'Stein'}`;
          }}
        />

        <div className="dk-bottom">
          <CaptureStrip view={view} forWhite={!flipped} lead={!flipped ? whiteLead : blackLead} />
          {view.history.length > 0 && (
            <button
              type="button"
              className="dk-moves-button"
              onClick={() => setShowMoves(true)}
              aria-label="Partieverlauf anzeigen"
            >
              Züge ({view.history.length})
            </button>
          )}
        </div>

        {showMoves && (
          <div className="dk-moves" role="dialog" aria-modal="true" aria-label="Partieverlauf">
            <h3>Partieverlauf</h3>
            <ol>
              {historyPairs.map((p) => (
                <li key={p.num}>
                  <span>{p.white}</span>
                  {p.black && <span>{p.black}</span>}
                </li>
              ))}
            </ol>
            <button type="button" className="dk-close" onClick={() => setShowMoves(false)}>
              Schließen
            </button>
          </div>
        )}
      </div>
    </FitBox>
  );
}

function SeatSymbol({ seat, className = '' }: { seat: SeatId; className?: string }) {
  return (
    <span className={`dk-symbol ${className}`} aria-hidden="true">
      <span className={`dk-mini-stone ${seat === 0 ? 'dk-mini-white' : 'dk-mini-black'}`} />
    </span>
  );
}

export const gameUi: GameUi<CheckersState, CheckersMove> = {
  Board,
  SeatSymbol,
  sounds: {
    moved: (event) => (event.captured ? 'stein-schlagen' : 'stein-ziehen'),
  },
  seatLabel: (seat) => LABELS[seat] ?? `Platz ${seat + 1}`,
  seatDetail: (view, seat) => {
    const counts = countPieces(view.cells)[seat as 0 | 1];
    if (counts.kings > 0) {
      return `${counts.men} ${counts.men === 1 ? 'Stein' : 'Steine'}, ${counts.kings} ${counts.kings === 1 ? 'Dame' : 'Damen'}`;
    }
    return `${counts.men} ${counts.men === 1 ? 'Stein' : 'Steine'}`;
  },
};
