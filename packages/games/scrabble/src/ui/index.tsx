import type { BoardProps, GameUi } from '@brett-und-blatt/ui';
import type { ScrabbleMove } from '../rules';
import './styles.css';

function Board({ view }: BoardProps<any, ScrabbleMove>) {
  const v = view as any;
  const board = v.board || [];
  const rack = v.rack || [];
  const scores = v.scores || [];
  const turn = v.turn || 0;
  const bagCount = v.bagCount || 0;
  const size = 15;
  return (
    <div className="scrabble">
      <div className="scrabble-header">
        <div>Am Zug: Spieler {(turn as number) + 1} | Punkte: {(scores as number[]).join(' : ')} | Steine: {bagCount}</div>
      </div>
      <div className="scrabble-layout">
        <div className="scrabble-board-wrap">
          <div className="scrabble-board" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
            {Array.from({ length: size * size }).map((_, idx) => {
              const row = Math.floor(idx / size);
              const col = idx % size;
              const isCenter = row === 7 && col === 7;
              const cell = (board as any[])[idx];
              let cls = 'scrabble-cell';
              if (isCenter && !cell) cls += ' scrabble-star';
              return (
                <div key={idx} className={cls} title={`${String.fromCharCode(65 + col)}${row + 1}`}>
                  {cell ? (
                    <div className={`scrabble-tile ${cell.isBlank ? 'scrabble-blank' : ''}`}>
                      <span className="scrabble-letter">{cell.letter}</span>
                      {!cell.isBlank && <span className="scrabble-value">{cell.value || '?'}</span>}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
        <div className="scrabble-sidebar">
          <div className="scrabble-rack">
            <div className="scrabble-rack-label">Dein Bänkchen</div>
            <div className="scrabble-rack-tiles">
              {(rack as any[]).map((t: any, i: number) => (
                <button key={i} className="scrabble-rack-tile">
                  <span className="scrabble-letter">{typeof t === 'string' ? (t === '?' ? ' ' : t) : t.letter}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="scrabble-actions">
            <button>Legen</button>
            <button>Passen</button>
            <button>Tauschen</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const gameUi: GameUi<any, ScrabbleMove> = {
  Board,
  SeatSymbol: () => <span>📝</span>,
  seatLabel: (seat: number) => `Spieler ${seat + 1}`,
};
