import type { BoardProps, GameUi } from '@brett-und-blatt/ui';
import { useMemo, useState } from 'react';
import {
  freeChainNeighbors,
  freeProperDivisors,
  validNumbers,
  type FactorGridMove,
  type FactorGridState,
} from '../rules';
import './styles.css';

function FactorSymbol({ seat, className }: { seat: number; className?: string }) {
  return (
    <span className={className} aria-hidden="true">
      {seat === 0 ? '🟦' : '🟧'}
    </span>
  );
}

function Board({ view, legalMoves, hint, onMove, seatNames }: BoardProps<FactorGridState, FactorGridMove>) {
  const [hoveredNum, setHoveredNum] = useState<number | null>(null);

  const playableSet = useMemo(() => new Set(validNumbers(view)), [view]);

  const previewDivisors = useMemo(() => {
    if (hoveredNum === null || view.variant !== 'taxman' || !playableSet.has(hoveredNum)) {
      return new Set<number>();
    }
    return new Set(freeProperDivisors(hoveredNum, view.owners));
  }, [hoveredNum, view.variant, view.owners, playableSet]);

  const previewTaxSum = useMemo(() => {
    let sum = 0;
    for (const d of previewDivisors) sum += d;
    return sum;
  }, [previewDivisors]);

  const p0Name = seatNames?.[0] ?? (view.seats === 1 ? 'Du' : 'Platz 1');
  const p1Name =
    seatNames?.[1] ?? (view.seats === 1 ? (view.variant === 'taxman' ? 'Steuereintreiber' : 'Ziel') : 'Platz 2');

  const last = view.lastAction;

  return (
    <div className="fg-layout">
      {/* Punkte- & Statusleiste */}
      <div className="fg-scoreboard">
        <div className="fg-score-card fg-score-p0" data-active={view.phase === 'play' && view.turn === 0 ? 'true' : undefined}>
          <span className="fg-score-name">🟦 {p0Name}</span>
          <strong className="fg-score-val">
            {view.scores[0]} {view.variant === 'taxman' ? 'Pkt.' : 'Züge'}
          </strong>
        </div>

        <div className="fg-status-center">
          {view.variant === 'chain' ? (
            view.lastPick === null ? (
              <span>Startzug: Wähle eine gerade Zahl!</span>
            ) : (
              <span>
                Letzte Zahl: <strong>{view.lastPick}</strong> (suche Teiler oder Vielfaches)
              </span>
            )
          ) : hoveredNum !== null && playableSet.has(hoveredNum) ? (
            <span>
              Vorschau <strong>+{hoveredNum}</strong> · Abgabe:{' '}
              <strong>
                −{previewTaxSum} ({[...previewDivisors].join(', ')})
              </strong>
            </span>
          ) : (
            <span>Wähle eine Zahl mit mindestens einem freien echten Teiler</span>
          )}
        </div>

        {view.seats === 2 || view.variant === 'taxman' ? (
          <div className="fg-score-card fg-score-p1" data-active={view.phase === 'play' && view.turn === 1 ? 'true' : undefined}>
            <span className="fg-score-name">🟧 {p1Name}</span>
            <strong className="fg-score-val">
              {view.scores[1]} {view.variant === 'taxman' ? 'Pkt.' : 'Züge'}
            </strong>
          </div>
        ) : (
          <div className="fg-score-card fg-score-p1">
            <span className="fg-score-name">🏁 Zielwert</span>
            <strong className="fg-score-val">{Math.floor(view.size / 2)} Züge</strong>
          </div>
        )}
      </div>

      {/* Letzte Aktion */}
      {last && (
        <div className="fg-last-banner">
          <span>
            Letzter Zug: <strong>{last.picked}</strong> gewählt
            {last.taxed.length > 0 && ` → Teiler ${last.taxed.join(', ')} abgegeben`}
            {last.swept.length > 0 && ` → Rest (${last.swept.join(', ')}) ging an den Steuereintreiber`}
          </span>
        </div>
      )}

      {/* Zahlengitter */}
      <div
        className="fg-grid"
        data-size={view.size}
        role="group"
        aria-label={`Zahlenbrett 1 bis ${view.size}`}
      >
        {Array.from({ length: view.size }, (_, idx) => {
          const n = idx + 1;
          const owner = view.owners[idx];
          const isPlayable = legalMoves.length > 0 && view.phase === 'play' && playableSet.has(n);
          const isTaxPreview = previewDivisors.has(n);
          const isLastPick = view.lastPick === n;
          const isHint = hint?.number === n;

          const divs =
            view.variant === 'taxman' && owner === null ? freeProperDivisors(n, view.owners) : [];
          const neighbors =
            view.variant === 'chain' && owner === null ? freeChainNeighbors(n, view.size, view.owners) : [];

          return (
            <button
              key={n}
              type="button"
              className="fg-cell"
              data-owner={owner !== null ? String(owner) : undefined}
              data-playable={isPlayable ? 'true' : undefined}
              data-tax-preview={isTaxPreview ? 'true' : undefined}
              data-last={isLastPick ? 'true' : undefined}
              data-hint={isHint ? 'true' : undefined}
              disabled={!isPlayable}
              onMouseEnter={() => setHoveredNum(n)}
              onMouseLeave={() => setHoveredNum((prev) => (prev === n ? null : prev))}
              onFocus={() => setHoveredNum(n)}
              onBlur={() => setHoveredNum((prev) => (prev === n ? null : prev))}
              onClick={() => onMove({ type: 'pick', number: n })}
            >
              <span className="fg-cell-num">{n}</span>
              {owner === 0 && <span className="fg-cell-badge">●</span>}
              {owner === 1 && <span className="fg-cell-badge">▲</span>}
              {owner === null && view.variant === 'taxman' && (
                <span className="fg-cell-sub">
                  {divs.length > 0 ? `T: ${divs.join(',')}` : 'kein T.'}
                </span>
              )}
              {owner === null && view.variant === 'chain' && isPlayable && (
                <span className="fg-cell-sub">{neighbors.length} Weiter</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const gameUi: GameUi<FactorGridState, FactorGridMove> = {
  Board,
  SeatSymbol: FactorSymbol,
  seatLabel: (seat) => `Platz ${seat + 1}`,
  seatDetail: (view, seat) => {
    const sc = view.scores[seat] ?? 0;
    return view.variant === 'taxman' ? `${sc} Pkt.` : `${sc} Züge`;
  },
  sounds: {
    picked: (e) => ((e.taxedCount as number | undefined) ? ['stein-setzen', 'steuer-nimmt'] : 'stein-setzen'),
  },
};
