import type { SeatId } from '@brett-und-blatt/engine';
import { FitBox, GridBoard, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import { countStones, type ReversiMove, type ReversiState } from '../rules';
import './styles.css';

const LABELS = ['Schwarz', 'Weiß'];

function Stone({ seat, flipDelay, plop }: { seat: SeatId; flipDelay?: number; plop?: boolean }) {
  return (
    <span
      className={`rv-stone rv-${seat === 0 ? 'black' : 'white'} ${flipDelay !== undefined ? 'rv-flip' : ''} ${plop ? 'bub-plop' : ''}`}
      style={flipDelay !== undefined ? { animationDelay: `${flipDelay * 60}ms` } : undefined}
    />
  );
}

function Board({ view, legalMoves, onMove, hint }: BoardProps<ReversiState, ReversiMove>) {
  const playable = new Set(legalMoves.map((m) => m.cell));
  const flipOrder = new Map(view.flipped.map((cell, i) => [cell, i]));
  const letters = 'abcdefghij';

  return (
    <FitBox ratio={1}>
      <GridBoard
        cols={view.size}
        rows={view.size}
        label="Spielbrett"
        className="rv-board"
        renderCell={(col, row) => {
          const cell = row * view.size + col;
          const seat = view.cells[cell];
          if (seat === null || seat === undefined) return playable.has(cell) ? <span className="rv-dot" /> : null;
          return <Stone key={`${cell}-${seat}`} seat={seat} flipDelay={flipOrder.get(cell)} plop={cell === view.lastMove} />;
        }}
        isActive={(col, row) => playable.has(row * view.size + col)}
        onActivate={(col, row) => onMove({ type: 'place', cell: row * view.size + col })}
        cellClassName={(col, row) => {
          const cell = row * view.size + col;
          return [cell === view.lastMove ? 'rv-last' : '', hint?.cell === cell ? 'rv-hint' : ''].join(' ');
        }}
        cellLabel={(col, row) => {
          const seat = view.cells[row * view.size + col];
          return `${letters[col]}${row + 1}: ${seat === null || seat === undefined ? 'frei' : LABELS[seat]}`;
        }}
      />
    </FitBox>
  );
}

function SeatSymbol({ seat, className = '' }: { seat: SeatId; className?: string }) {
  return (
    <span className={`rv-symbol ${className}`}>
      <Stone seat={seat} />
    </span>
  );
}

export const gameUi: GameUi<ReversiState, ReversiMove> = {
  Board,
  SeatSymbol,
  sounds: { placed: (event) => ((event.flipped as unknown[] | undefined)?.length ? ['stein-setzen', 'steine-wenden'] : 'stein-setzen') },
  seatLabel: (seat) => LABELS[seat] ?? `Platz ${seat + 1}`,
  seatDetail: (view, seat) => `${LABELS[seat]} · ${countStones(view)[seat as 0 | 1]} Steine`,
};
