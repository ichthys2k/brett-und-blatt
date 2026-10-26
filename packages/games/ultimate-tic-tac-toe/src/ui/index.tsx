import type { SeatId } from '@brett-und-blatt/engine';
import { FitBox, GridBoard, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import { playableBoards, type UltimateMove, type UltimateState } from '../rules';
import './styles.css';

const LABELS = ['Kreuz', 'Kreis'];

function Mark({ seat, className = '' }: { seat: SeatId; className?: string }) {
  return seat === 0 ? (
    <svg viewBox="0 0 100 100" className={`ut-mark ut-x ${className}`} aria-hidden="true">
      <path d="M24 24 L76 76" />
      <path d="M76 24 L24 76" />
    </svg>
  ) : (
    <svg viewBox="0 0 100 100" className={`ut-mark ut-o ${className}`} aria-hidden="true">
      <circle cx="50" cy="50" r="28" />
    </svg>
  );
}

/** Bildschirmzeile/-spalte (0–8) → kleines Feld und Zelle darin. */
function locate(col: number, row: number) {
  return { board: Math.floor(row / 3) * 3 + Math.floor(col / 3), cell: (row % 3) * 3 + (col % 3) };
}

function Board({ view, legalMoves, onMove, hint }: BoardProps<UltimateState, UltimateMove>) {
  const playable = new Set(legalMoves.map((m) => m.board * 9 + m.cell));
  const activeBoards = new Set(legalMoves.length > 0 ? legalMoves.map((m) => m.board) : view.winner === null && !view.draw ? playableBoards(view) : []);
  const winning = new Set(view.winLine ?? []);
  const last = view.lastMove;

  return (
    <FitBox ratio={1}>
      <div className="ut-wrap">
        <GridBoard
          cols={9}
          rows={9}
          label="Spielfeld"
          className="ut-board"
          renderCell={(col, row) => {
            const { board, cell } = locate(col, row);
            const seat = view.cells[board * 9 + cell];
            return seat === null || seat === undefined ? null : <Mark seat={seat} />;
          }}
          isActive={(col, row) => {
            const { board, cell } = locate(col, row);
            return playable.has(board * 9 + cell);
          }}
          onActivate={(col, row) => onMove({ type: 'place', ...locate(col, row) })}
          cellClassName={(col, row) => {
            const { board, cell } = locate(col, row);
            const classes = [];
            if (col % 3 === 2 && col < 8) classes.push('ut-edge-right');
            if (row % 3 === 2 && row < 8) classes.push('ut-edge-bottom');
            if (activeBoards.has(board)) classes.push('ut-active');
            if (last && last.board === board && last.cell === cell) classes.push('ut-last');
            if (hint && hint.board === board && hint.cell === cell) classes.push('ut-hint');
            return classes.join(' ');
          }}
          cellLabel={(col, row) => {
            const { board, cell } = locate(col, row);
            const seat = view.cells[board * 9 + cell];
            return `Feld ${board + 1}, Zelle ${cell + 1}: ${seat === null || seat === undefined ? 'frei' : LABELS[seat]}`;
          }}
        />
        <div className="ut-overlay" aria-hidden="true">
          {view.boards.map((owner, board) => (
            <span key={board} className={`ut-big ${winning.has(board) ? 'ut-big-win' : ''}`}>
              {owner === 0 || owner === 1 ? <Mark seat={owner} className="ut-big-mark" /> : owner === 'draw' ? <span className="ut-draw">=</span> : null}
            </span>
          ))}
        </div>
      </div>
    </FitBox>
  );
}

function SeatSymbol({ seat, className = '' }: { seat: SeatId; className?: string }) {
  return (
    <span className={className}>
      <Mark seat={seat} />
    </span>
  );
}

export const gameUi: GameUi<UltimateState, UltimateMove> = {
  Board,
  SeatSymbol,
  sounds: { placed: 'stein-setzen', boardWon: 'muehle' },
  seatLabel: (seat) => LABELS[seat] ?? `Platz ${seat + 1}`,
  seatDetail: (view, seat) => {
    const won = view.boards.filter((owner) => owner === seat).length;
    return `${LABELS[seat]} · ${won} ${won === 1 ? 'Feld' : 'Felder'}`;
  },
};
