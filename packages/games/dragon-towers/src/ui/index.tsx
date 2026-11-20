import type { SeatId } from '@brett-und-blatt/engine';
import { FitBox, GridBoard, useGridMoveAnimation, usePointerDrag, type BoardProps, type CellSlideProps, type GameUi } from '@brett-und-blatt/ui';
import { useRef, useState, type CSSProperties } from 'react';
import { describeMove } from '../describe';
import { BOARD_COLORS, COLOR_NAMES, SIZE, distance, movableSquares, squareName, type DragonTowersMove, type DragonTowersState, type Tower } from '../rules';
import './styles.css';

const LABELS = ['Schwarz', 'Gold'];
const FILES = 'abcdefgh';

/** Gleitdauer je nach Weg: kurze Züge flink, weite Züge sichtbar über das Brett. */
export function glideMs(fields: number): number {
  return 160 + 75 * Math.max(1, fields);
}

const colorVar = (color: number) => ({ '--dt-color': `var(--dt-c${color})` }) as CSSProperties;

function TowerView({
  tower,
  required,
  dragTransform,
  isDragged,
  slide,
}: {
  tower: Tower;
  required: boolean;
  dragTransform?: string;
  isDragged?: boolean;
  slide?: CellSlideProps;
}) {
  const classes = ['dt-tower', tower.seat === 0 ? 'dt-black' : 'dt-gold'];
  if (required) classes.push('dt-required');
  if (slide?.isSliding) classes.push('dt-gliding');
  if (isDragged) classes.push('bub-dragging');
  if (slide?.pieceClassName) classes.push(slide.pieceClassName);
  return (
    <span
      // Neuer Schlüssel beim Gleiten startet die Animation sicher neu.
      key={slide?.isSliding ? 'glide' : undefined}
      className={classes.join(' ')}
      style={{
        ...colorVar(tower.color),
        ...slide?.style,
        transform: dragTransform,
        zIndex: isDragged ? 1000 : undefined,
      }}
      onAnimationEnd={(event) => {
        // Nur das Ende des Gleitens räumt auf, nicht das Pulsieren des Pflicht-Turms.
        if (event.animationName === 'bub-piece-slide') slide?.onAnimationEnd?.();
      }}
      aria-hidden="true"
    >
      <span className="dt-body">
        <span className="dt-cap" />
      </span>
    </span>
  );
}

function StatusBar({ view, seatNames, canPass, onPass }: { view: DragonTowersState; seatNames: string[]; canPass: boolean; onPass: () => void }) {
  const name = (seat: SeatId) => seatNames[seat] || LABELS[seat] || `Platz ${seat + 1}`;
  if (view.end !== null && view.winner !== null) {
    return (
      <div className="dt-status" role="status">
        <span className={`dt-mini ${view.winner === 0 ? 'dt-black' : 'dt-gold'}`} />
        <span>
          {name(view.winner)} gewinnt{view.end === 'deadlock' ? ' – die Gegenseite hat alles blockiert.' : '!'}
        </span>
      </div>
    );
  }
  if (view.required === null) {
    return (
      <div className="dt-status" role="status">
        <span>{name(view.turn)} wählt den ersten Turm frei.</span>
      </div>
    );
  }
  return (
    <div className="dt-status" role="status">
      <span className="dt-swatch" style={colorVar(view.required)} aria-hidden="true" />
      <span>
        {canPass ? (
          <>
            Der Turm in {COLOR_NAMES[view.required]} von {name(view.turn)} ist eingesperrt.
          </>
        ) : (
          <>
            {name(view.turn)} zieht den Turm in {COLOR_NAMES[view.required]}.
          </>
        )}
      </span>
      {canPass && (
        <button type="button" className="dt-pass" onClick={onPass}>
          Aussetzen
        </button>
      )}
    </div>
  );
}

function Board({ view, legalMoves, onMove, viewer, activeSeat, hint, seatNames }: BoardProps<DragonTowersState, DragonTowersMove>) {
  const boardMoves = legalMoves.filter((m): m is Extract<DragonTowersMove, { type: 'move' }> => m.type === 'move');
  const passMove = legalMoves.find((m) => m.type === 'pass');
  const hinted = hint?.type === 'move' ? [hint.from, hint.to] : [];

  const [picked, setPicked] = useState<number | null>(null);
  const [lastView, setLastView] = useState(view);
  if (lastView !== view) {
    setLastView(view);
    setPicked(null);
  }

  // Ausrichtung wie bei Dame: fest beim ersten Betrachter oder zum Spieler am Zug gedreht.
  const [anchor, setAnchor] = useState(typeof viewer === 'number' ? viewer : 0);
  if (typeof viewer === 'number' && viewer !== anchor && anchor !== 0) setAnchor(0);
  const seat = view.rotate === false ? anchor : typeof viewer === 'number' ? viewer : (activeSeat ?? 0);
  const flipped = seat === 1;
  const toBoard = (dc: number, dr: number) => (flipped ? (SIZE - 1 - dr) * SIZE + (SIZE - 1 - dc) : dr * SIZE + dc);

  const movable = new Set(boardMoves.map((m) => m.from));
  // Nach dem ersten Zug darf nur ein Turm ziehen – er ist sofort gewählt.
  const selected = picked ?? (movable.size === 1 ? [...movable][0]! : null);
  const targets = new Set(selected === null ? [] : boardMoves.filter((m) => m.from === selected).map((m) => m.to));
  const requiredSquare = view.end === null && view.required !== null ? movableSquares(view, view.turn)[0] ?? null : null;

  const wasDraggedRef = useRef(false);
  const wasDragged = wasDraggedRef.current;
  wasDraggedRef.current = false;

  const { getSlideProps } = useGridMoveAnimation({
    lastMove: view.lastMove,
    toDisplayCoord: (pos) => {
      const index = Number(pos);
      if (!(index >= 0 && index < SIZE * SIZE)) return null;
      const r = Math.floor(index / SIZE);
      const c = index % SIZE;
      return flipped ? { col: SIZE - 1 - c, row: SIZE - 1 - r } : { col: c, row: r };
    },
    durationMs: view.lastMove ? glideMs(distance(view.lastMove.from, view.lastMove.to)) : undefined,
    wasDragged,
    // Aussetzen zählt mit, bewegt aber nichts: Der Schlüssel ist der letzte echte Zug.
    moveKey: view.lastMove ? `${view.lastMove.from}-${view.lastMove.to}-${view.plies - view.passChain.length}` : undefined,
  });

  const { dragState, bindDrag } = usePointerDrag<number>({
    threshold: 6,
    onDrop: (from, targetId) => {
      if (!targetId) return false;
      const move = boardMoves.find((m) => m.from === from && m.to === Number(targetId));
      if (!move) return false;
      wasDraggedRef.current = true;
      onMove(move);
      return true;
    },
  });
  const dragSource = dragState.isDragging && dragState.item !== null ? dragState.item : null;
  const shown = dragSource !== null ? new Set(boardMoves.filter((m) => m.from === dragSource).map((m) => m.to)) : targets;

  const tap = (index: number) => {
    if (selected !== null && targets.has(index)) {
      const move = boardMoves.find((m) => m.from === selected && m.to === index);
      if (move) onMove(move);
      return;
    }
    setPicked(movable.has(index) && index !== picked ? index : null);
  };

  const last = view.lastMove ? [view.lastMove.from, view.lastMove.to] : [];

  return (
    <FitBox ratio={8 / 9} className="dt-fit">
      <div className="dt-wrap">
        <StatusBar view={view} seatNames={seatNames} canPass={passMove !== undefined} onPass={() => passMove && onMove(passMove)} />
        <GridBoard
          cols={SIZE}
          rows={SIZE}
          label="Drachentürme-Brett"
          className="dt-board"
          renderCell={(dc, dr) => {
            const index = toBoard(dc, dr);
            const tower = view.towers[index];
            const isDragged = (dragState.isDragging || dragState.snapping) && dragState.item === index;
            return (
              <>
                {tower ? (
                  <TowerView
                    tower={tower}
                    required={index === requiredSquare && selected !== index}
                    isDragged={isDragged}
                    dragTransform={isDragged ? `translate3d(${dragState.delta.x}px, ${dragState.delta.y}px, 0)` : undefined}
                    slide={getSlideProps(index)}
                  />
                ) : shown.has(index) ? (
                  <span className="dt-target" />
                ) : null}
                {dc === 0 && <span className="dt-coord dt-rank">{flipped ? dr + 1 : SIZE - dr}</span>}
                {dr === SIZE - 1 && <span className="dt-coord dt-file">{flipped ? FILES[SIZE - 1 - dc] : FILES[dc]}</span>}
              </>
            );
          }}
          isActive={(dc, dr) => {
            const index = toBoard(dc, dr);
            return movable.has(index) || shown.has(index);
          }}
          onActivate={(dc, dr) => tap(toBoard(dc, dr))}
          cellProps={(dc, dr) => {
            const index = toBoard(dc, dr);
            return {
              style: colorVar(BOARD_COLORS[index]!),
              'data-drop-target': String(index),
              'data-drop-active': dragSource !== null && shown.has(index) && dragState.targetId === String(index) ? 'true' : undefined,
              ...(movable.has(index) ? bindDrag(index) : undefined),
            };
          }}
          cellClassName={(dc, dr) => {
            const index = toBoard(dc, dr);
            const classes = ['dt-cell'];
            const slide = getSlideProps(index);
            if (slide.cellClassName) classes.push(slide.cellClassName);
            if (index === view.lastMove?.from) classes.push('dt-last-from');
            if (index === view.lastMove?.to) classes.push('dt-last-to');
            if (index === selected || index === dragSource) classes.push('dt-selected');
            if (hinted.includes(index)) classes.push('dt-hint');
            return classes.join(' ');
          }}
          cellLabel={(dc, dr) => {
            const index = toBoard(dc, dr);
            const tower = view.towers[index];
            const field = `${squareName(index)}, Feld ${COLOR_NAMES[BOARD_COLORS[index]!]}`;
            const where = tower ? `${field}: Turm ${COLOR_NAMES[tower.color]} von ${LABELS[tower.seat]}` : field;
            const toHere = selected !== null && targets.has(index) ? boardMoves.find((m) => m.from === selected && m.to === index) : undefined;
            return toHere ? `${where} – ${describeMove(view, toHere)}` : last.includes(index) && !tower ? `${where} (letzter Zug)` : where;
          }}
        />
      </div>
    </FitBox>
  );
}

function SeatSymbol({ seat, className = '' }: { seat: SeatId; className?: string }) {
  return <span className={`dt-mini ${seat === 0 ? 'dt-black' : 'dt-gold'} ${className}`} aria-hidden="true" />;
}

export const gameUi: GameUi<DragonTowersState, DragonTowersMove> = {
  Board,
  SeatSymbol,
  sounds: {
    moved: 'stein-ziehen',
  },
  seatLabel: (seat) => LABELS[seat] ?? `Platz ${seat + 1}`,
  seatDetail: (view, seat) => {
    if (view.end !== null || view.turn !== seat || view.required === null) return null;
    return `muss ${COLOR_NAMES[view.required]} ziehen`;
  },
};
