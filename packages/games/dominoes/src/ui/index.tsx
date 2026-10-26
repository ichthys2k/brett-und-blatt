import type { SeatId } from '@brett-und-blatt/engine';
import { type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import { useState } from 'react';
import { isDouble, pipsOf, STONES, type DominoMove, type DominoState, type StoneId } from '../rules';
import './styles.css';

/** Augenpositionen in einem Feld von 100 × 100. */
const PIPS: Record<number, [number, number][]> = {
  0: [],
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
};

function Half({ n, x }: { n: number; x: number }) {
  return (
    <g transform={`translate(${x} 0)`}>
      {PIPS[n]!.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="9" className="dm-pip" />
      ))}
    </g>
  );
}

/** Ein Dominostein, waagerecht mit `left` links; Pasche stehen quer (`upright`). */
export function Stone({ left, right, upright, className = '', label }: { left: number; right: number; upright?: boolean; className?: string; label?: string }) {
  return (
    <svg viewBox="0 0 200 100" className={`dm-stone ${upright ? 'dm-upright' : ''} ${className}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <rect x="2" y="2" width="196" height="96" rx="14" className="dm-face" />
      <line x1="100" y1="12" x2="100" y2="88" className="dm-bar" />
      <Half n={left} x={0} />
      <Half n={right} x={100} />
    </svg>
  );
}

const stoneName = (s: StoneId) => `[${STONES[s]![0]}|${STONES[s]![1]}]`;

function Board({ view, legalMoves, onMove, viewer, hint, seatNames }: BoardProps<DominoState, DominoMove>) {
  const seat = typeof viewer === 'number' ? viewer : null;
  const hand = seat !== null ? (view.hands[seat] ?? []).filter((s): s is StoneId => s !== null) : [];
  const [selected, setSelected] = useState<StoneId | null>(null);
  const [lastView, setLastView] = useState(view);
  if (lastView !== view) {
    setLastView(view);
    setSelected(null);
  }
  const plays = legalMoves.filter((m): m is Extract<DominoMove, { type: 'play' }> => m.type === 'play');
  const playable = new Set(plays.map((m) => m.stone));
  const endsFor = (stone: StoneId) => plays.filter((m) => m.stone === stone);
  const draw = legalMoves.find((m) => m.type === 'draw');
  const pass = legalMoves.find((m) => m.type === 'pass');
  const hintStone = hint?.type === 'play' ? hint.stone : null;

  const tapStone = (stone: StoneId) => {
    const options = endsFor(stone);
    if (options.length === 1) onMove(options[0]!);
    else if (options.length > 1) setSelected(selected === stone ? null : stone);
  };
  const choices = selected !== null ? endsFor(selected) : [];
  const endButton = (end: 'left' | 'right' | 'up' | 'down') => {
    const move = choices.find((m) => m.end === end);
    if (!move) return null;
    const labels = {
      left: 'Links anlegen',
      right: 'Rechts anlegen',
      up: 'Oben anlegen',
      down: 'Unten anlegen',
    };
    const symbols = {
      left: '◀',
      right: '▶',
      up: '▲',
      down: '▼',
    };
    return (
      <button type="button" className={`dm-end dm-end-${end}`} onClick={() => onMove(move)} aria-label={labels[end]}>
        {symbols[end]}
      </button>
    );
  };

  const summary = view.lastRound && view.chain.length === 0 ? view.lastRound : null;
  const name = (s: SeatId) => seatNames[s] ?? `Platz ${s + 1}`;

  return (
    <div className="dm-layout">
      <div className="dm-table">
        {summary && (
          <div className="dm-summary" role="status">
            <strong>
              Runde {summary.round}: {summary.winner === null ? 'gesperrt, niemand punktet' : `${name(summary.winner)} gewinnt +${summary.points}`}
              {summary.blocked && summary.winner !== null ? ' (gesperrt, wenigste Augen)' : ''}
            </strong>
            <div className="dm-reveal">
              {summary.hands.map((h, s) =>
                h.length === 0 ? null : (
                  <span key={s} className="dm-reveal-row">
                    {name(s)}: {h.map((st) => stoneName(st)).join(' ')} ({h.reduce((sum, st) => sum + pipsOf(st), 0)} Augen)
                  </span>
                ),
              )}
            </div>
          </div>
        )}
        <div className="dm-chain" aria-label="Kette">
          {endButton('left')}
          {view.chain.map((c, i) => {
            const isSpinner = view.spinnerIndex === i;
            const stoneEl = (
              <Stone
                key={`${c.stone}-${i}`}
                left={c.left}
                right={c.right}
                upright={isDouble(c.stone)}
                className={`${view.lastPlayed?.stone === c.stone ? 'dm-last' : ''} ${isSpinner ? 'dm-spinner' : ''}`}
                label={`${c.left} und ${c.right}`}
              />
            );
            if (!isSpinner || (!view.upBranch?.length && !view.downBranch?.length && !choices.some((m) => m.end === 'up' || m.end === 'down'))) {
              return stoneEl;
            }
            return (
              <div key={`spinner-col-${i}`} className="dm-spinner-col">
                {endButton('up')}
                {view.upBranch?.slice().reverse().map((b, bi) => (
                  <Stone key={`up-${b.stone}-${bi}`} left={b.right} right={b.left} upright className={view.lastPlayed?.stone === b.stone ? 'dm-last' : ''} />
                ))}
                {stoneEl}
                {view.downBranch?.map((b, bi) => (
                  <Stone key={`down-${b.stone}-${bi}`} left={b.left} right={b.right} upright className={view.lastPlayed?.stone === b.stone ? 'dm-last' : ''} />
                ))}
                {endButton('down')}
              </div>
            );
          })}
          {endButton('right')}
          {view.chain.length === 0 && !summary && <p className="dm-empty">Der erste Stein kommt in die Mitte.</p>}
        </div>
      </div>

      <div className="dm-controls" aria-live="polite">
        <span className="dm-info">
          {view.lastPlayed && view.lastPlayed.scored > 0 ? `${name(view.lastPlayed.seat)}: +${view.lastPlayed.scored} Fünferpunkte` : choices.length > 1 ? 'Wähle das Ende' : `Runde ${view.round} · Ziel ${view.target}`}
          <small>{view.variant === 'block' ? 'Block-Domino' : `Vorrat: ${view.boneyard.length}`}</small>
        </span>
        {draw && (
          <button type="button" className="dm-button dm-primary" onClick={() => onMove(draw)}>
            Ziehen
          </button>
        )}
        {pass && (
          <button type="button" className="dm-button dm-primary" onClick={() => onMove(pass)}>
            Passen
          </button>
        )}
      </div>

      {seat !== null && (
        <div className="dm-hand" role="group" aria-label="Deine Steine">
          {hand.map((stone) => {
            const [a, b] = STONES[stone]!;
            return (
              <button
                key={stone}
                type="button"
                className="dm-hand-stone"
                disabled={!playable.has(stone)}
                data-selected={selected === stone || undefined}
                data-hint={hintStone === stone || undefined}
                aria-label={`${stoneName(stone)}${playable.has(stone) ? '' : ', passt nicht'}`}
                onClick={() => tapStone(stone)}
              >
                <Stone left={a} right={b} upright />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SeatSymbol({ seat, className = '' }: { seat: SeatId; className?: string }) {
  return (
    <span className={`dm-symbol ${className}`}>
      <Stone left={seat + 1} right={seat + 1} upright />
    </span>
  );
}

export const gameUi: GameUi<DominoState, DominoMove> = {
  Board,
  SeatSymbol,
  sounds: { played: 'stein-setzen', drew: 'stein-ziehen' },
  seatLabel: (seat) => `Platz ${seat + 1}`,
  seatDetail: (view, seat) => `${view.scores[seat]} Pkt. · ${view.hands[seat]?.length ?? 0} St.`,
};
