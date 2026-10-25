import type { SeatId } from '@brett-und-blatt/engine';
import { FitBox, GridBoard, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import { useState, type CSSProperties } from 'react';
import type { FourInARowMove, FourInARowState } from '../rules';
import './styles.css';

const LABELS = ['Rot', 'Gelb'];

/** Fünfzackiger Stern als Zusatzzeichen für Gelb – Farben allein reichen nicht (Farbenblindheit). */
const STAR = Array.from({ length: 10 }, (_, i) => {
  const angle = (-90 + i * 36) * (Math.PI / 180);
  const radius = i % 2 === 0 ? 27 : 11;
  return `${(50 + radius * Math.cos(angle)).toFixed(1)},${(50 + radius * Math.sin(angle)).toFixed(1)}`;
}).join(' ');

function Disc({ seat, ghost = false, win = false, dropRows = 0 }: { seat: SeatId; ghost?: boolean; win?: boolean; dropRows?: number }) {
  return (
    <span
      className={`c4-disc c4-seat-${seat} ${ghost ? 'c4-ghost' : ''} ${win ? 'c4-win' : ''} ${dropRows > 0 ? 'c4-drop' : ''}`}
      style={dropRows > 0 ? ({ '--c4-drop': dropRows } as CSSProperties) : undefined}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true">
        {seat === 0 ? <circle cx="50" cy="50" r="20" className="c4-symbol c4-ring" /> : <polygon points={STAR} className="c4-symbol" />}
      </svg>
    </span>
  );
}

function Board({ view, legalMoves, onMove, events, activeSeat }: BoardProps<FourInARowState, FourInARowMove>) {
  const [hover, setHover] = useState<number | null>(null);
  const drops = new Set(legalMoves.filter((m) => m.type === 'drop').map((m) => m.column));
  const pops = new Set(legalMoves.filter((m) => m.type === 'pop').map((m) => m.column));
  const dropped = events.find((e) => e.type === 'dropped') as { column: number; row: number } | undefined;
  const winning = new Set(view.winLines.flat());
  const columns = Array.from({ length: view.cols }, (_, col) => col);
  const popRow = view.popOut ? 0.8 : 0;

  return (
    <FitBox ratio={view.cols / (view.rows + 1 + popRow)}>
      <div className="c4-layout" style={{ gridTemplateRows: `1fr ${view.rows}fr${view.popOut ? ` ${popRow}fr` : ''}` }}>
        <div className="c4-strip" style={{ gridTemplateColumns: `repeat(${view.cols}, 1fr)` }} aria-hidden="true">
          {columns.map((col) => (
            <span key={col} className="c4-strip-cell">
              {hover === col && drops.has(col) && activeSeat !== null ? <Disc seat={activeSeat} ghost /> : null}
            </span>
          ))}
        </div>

        <GridBoard
          cols={view.cols}
          rows={view.rows}
          label="Spielbrett"
          className="c4-board"
          renderCell={(col, displayRow) => {
            const row = view.rows - 1 - displayRow;
            const index = col * view.rows + row;
            const seat = view.cells[index];
            const isNew = dropped !== undefined && dropped.column === col && dropped.row === row;
            return (
              <span className="c4-hole">
                {seat !== null && seat !== undefined && <Disc key={isNew ? `neu-${view.moveCount}` : 'liegt'} seat={seat} win={winning.has(index)} dropRows={isNew ? displayRow + 1 : 0} />}
              </span>
            );
          }}
          isActive={(col) => drops.has(col)}
          onActivate={(col) => onMove({ type: 'drop', column: col })}
          onHoverColumn={setHover}
          cellClassName={(col) => (hover === col && drops.has(col) ? 'c4-column-hover' : '')}
          cellLabel={(col, displayRow) => {
            const seat = view.cells[col * view.rows + (view.rows - 1 - displayRow)];
            const content = seat === null || seat === undefined ? 'frei' : LABELS[seat];
            return `Spalte ${col + 1}, Reihe ${view.rows - displayRow}: ${content}`;
          }}
        />

        {view.popOut && (
          <div className="c4-strip" style={{ gridTemplateColumns: `repeat(${view.cols}, 1fr)` }}>
            {columns.map((col) =>
              pops.has(col) ? (
                <button key={col} type="button" className="c4-pop" onClick={() => onMove({ type: 'pop', column: col })} aria-label={`Unteren Stein aus Spalte ${col + 1} herausziehen`}>
                  ⤓
                </button>
              ) : (
                <span key={col} />
              ),
            )}
          </div>
        )}
      </div>
    </FitBox>
  );
}

function SeatSymbol({ seat, className = '' }: { seat: SeatId; className?: string }) {
  return (
    <span className={className}>
      <Disc seat={seat} />
    </span>
  );
}

export const gameUi: GameUi<FourInARowState, FourInARowMove> = {
  Board,
  SeatSymbol,
  seatLabel: (seat) => LABELS[seat] ?? `Platz ${seat + 1}`,
};
