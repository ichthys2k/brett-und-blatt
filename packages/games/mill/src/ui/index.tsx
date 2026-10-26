import type { SeatId } from '@brett-und-blatt/engine';
import { FitBox, NetBoard, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import { useState } from 'react';
import { LINES, POINTS, pointName } from '../board';
import { phaseOf, stonesOnBoard, type MillMove, type MillState } from '../rules';
import './styles.css';

const LABELS = ['Weiß', 'Schwarz'];

function Stone({ seat, className = '' }: { seat: SeatId; className?: string }) {
  return <span className={`ml-stone ml-${seat === 0 ? 'white' : 'black'} ${className}`} />;
}

interface Selection {
  /** Gewählter eigener Stein (Ziehen/Springen). */
  from: number | null;
  /** Gewähltes Ziel, nach dem noch weggenommen werden muss. */
  to: number | null;
  removed: number[];
}

const EMPTY: Selection = { from: null, to: null, removed: [] };

/**
 * Bedienung in Schritten: Stein wählen (beim Ziehen), Ziel antippen – und wenn
 * eine Mühle entsteht, den gegnerischen Stein antippen, der weg soll.
 */
function Board({ view, legalMoves, onMove, hint }: BoardProps<MillState, MillMove>) {
  const [sel, setSel] = useState<Selection>(EMPTY);
  const [lastView, setLastView] = useState(view);
  if (lastView !== view) {
    // Neuer Spielstand: angefangene Auswahl verwerfen.
    setLastView(view);
    setSel(EMPTY);
  }

  const fromOf = (m: MillMove) => (m.type === 'move' ? m.from : null);
  const forFrom = legalMoves.filter((m) => fromOf(m) === sel.from);
  const removing = sel.to !== null;
  const candidates = removing ? forFrom.filter((m) => m.to === sel.to && sel.removed.every((r) => m.remove.includes(r))) : [];

  const selectable = new Set(legalMoves.flatMap((m) => (m.type === 'move' ? [m.from] : [])));
  const targets = new Set(removing ? [] : forFrom.map((m) => m.to));
  const removableNow = new Set(candidates.flatMap((m) => m.remove.filter((r) => !sel.removed.includes(r))));

  const finish = (moves: MillMove[], next: Selection) => {
    const done = moves.find((m) => m.remove.length === next.removed.length);
    if (done && (moves.length === 1 || next.removed.length > 0 || done.remove.length === 0)) {
      onMove(done);
      setSel(EMPTY);
    } else {
      setSel(next);
    }
  };

  const tap = (point: number) => {
    if (removing) {
      if (!removableNow.has(point)) return;
      const next = { ...sel, removed: [...sel.removed, point] };
      finish(
        candidates.filter((m) => m.remove.includes(point)),
        next,
      );
      return;
    }
    if (targets.has(point)) {
      const moves = forFrom.filter((m) => m.to === point);
      const next = { ...sel, to: point };
      if (moves.every((m) => m.remove.length === 0)) finish(moves, next);
      else setSel(next);
      return;
    }
    if (selectable.has(point)) setSel({ ...EMPTY, from: point === sel.from ? null : point });
  };

  const shown = [...view.cells];
  if (sel.from !== null && sel.to !== null) shown[sel.from] = null;
  if (sel.to !== null) shown[sel.to] = view.turn;
  const hintPoints = new Set(hint ? [hint.to, ...(hint.type === 'move' ? [hint.from] : []), ...hint.remove] : []);
  const last = view.lastMove;

  return (
    <FitBox ratio={1 / 1.12}>
      <div className="ml-layout">
        <div className="ml-hands" aria-label="Steine im Vorrat">
          {[0, 1].map((seat) => (
            <span key={seat} className="ml-hand">
              {Array.from({ length: view.inHand[seat as 0 | 1] }, (_, i) => (
                <Stone key={i} seat={seat} className="ml-small" />
              ))}
            </span>
          ))}
        </div>
        <div className="ml-board">
          <NetBoard
            points={POINTS}
            lines={LINES}
            label="Mühlebrett"
            renderPoint={(point) => {
              const owner = shown[point];
              const removed = sel.removed.includes(point);
              if (owner === null || owner === undefined) return <span className={`ml-dot ${targets.has(point) ? 'ml-target' : ''}`} />;
              return <Stone seat={owner} className={`${removed ? 'ml-removed' : ''} ${point === sel.from ? 'ml-selected' : ''} ${point === sel.to ? 'ml-pending' : ''}`} />;
            }}
            isActive={(point) => (removing ? removableNow.has(point) : targets.has(point) || selectable.has(point))}
            onActivate={tap}
            pointClassName={(point) =>
              [
                removableNow.has(point) ? 'ml-can-remove' : '',
                hintPoints.has(point) ? 'ml-hint' : '',
                last && (last.to === point || (last.type === 'move' && last.from === point)) ? 'ml-last' : '',
              ].join(' ')
            }
            pointLabel={(point) => {
              const owner = view.cells[point];
              return `${pointName(point)}: ${owner === null || owner === undefined ? 'frei' : LABELS[owner]}`;
            }}
          />
        </div>
        <p className="ml-help" aria-live="polite">
          {removing && removableNow.size > 0 ? 'Mühle! Tippe einen gegnerischen Stein an, der weg soll.' : sel.from !== null ? 'Wohin soll der Stein?' : ''}
        </p>
      </div>
    </FitBox>
  );
}

function SeatSymbol({ seat, className = '' }: { seat: SeatId; className?: string }) {
  return (
    <span className={`ml-symbol ${className}`}>
      <Stone seat={seat} />
    </span>
  );
}

export const gameUi: GameUi<MillState, MillMove> = {
  Board,
  SeatSymbol,
  sounds: { placed: 'stein-setzen', moved: 'stein-ziehen', mill: 'muehle', removed: 'stein-schlagen' },
  seatLabel: (seat) => LABELS[seat] ?? `Platz ${seat + 1}`,
  seatDetail: (view, seat) => {
    const phase = phaseOf(view, seat);
    const onBoard = stonesOnBoard(view.cells, seat);
    if (phase === 'place') return `${LABELS[seat]} · noch ${view.inHand[seat as 0 | 1]} setzen`;
    return `${LABELS[seat]} · ${onBoard} Steine${phase === 'fly' ? ' · springt' : ''}`;
  },
};
