import type { BoardProps, GameUi } from '@brett-und-blatt/ui';
import { useEffect, useState } from 'react';
import {
  formatStoneValue,
  stoneIndex,
  totalStones,
  type NumberWallMove,
  type NumberWallState,
} from '../rules';
import './styles.css';

function WallSymbol({ className }: { className?: string }) {
  return (
    <span className={className} aria-hidden="true">
      🧱
    </span>
  );
}

function Board({ view, viewer, legalMoves, hint, onMove }: BoardProps<NumberWallState, NumberWallMove>) {
  const mySeat = typeof viewer === 'number' ? viewer : 0;
  const mySub = view.submissions[mySeat] ?? null;
  const canPlay = legalMoves.length > 0 && view.phase === 'play' && mySub === null;

  const count = totalStones(view.height);
  const [draft, setDraft] = useState<(number | null)[]>(() => [...view.givens]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(() => {
    const firstBlank = view.givens.findIndex((g) => g === null);
    return firstBlank >= 0 ? firstBlank : null;
  });

  useEffect(() => {
    setDraft([...view.givens]);
    const firstBlank = view.givens.findIndex((g) => g === null);
    setSelectedIdx(firstBlank >= 0 ? firstBlank : null);
  }, [view.round, view.givens, mySeat]);

  const handleSelectStone = (idx: number) => {
    if (!canPlay || view.givens[idx] !== null) return;
    setSelectedIdx(idx);
  };

  const handlePickValue = (val: number) => {
    if (!canPlay || selectedIdx === null || view.givens[selectedIdx] !== null) return;
    const next = [...draft];
    next[selectedIdx] = val;
    setDraft(next);

    // Automatisch zum nächsten noch offenen Stein springen
    for (let offset = 1; offset <= count; offset++) {
      const cand = (selectedIdx + offset) % count;
      if (view.givens[cand] === null && next[cand] === null) {
        setSelectedIdx(cand);
        return;
      }
    }
  };

  const handleClearSelected = () => {
    if (!canPlay || selectedIdx === null || view.givens[selectedIdx] !== null) return;
    const next = [...draft];
    next[selectedIdx] = null;
    setDraft(next);
  };

  const handleReset = () => {
    if (!canPlay) return;
    setDraft([...view.givens]);
    const firstBlank = view.givens.findIndex((g) => g === null);
    setSelectedIdx(firstBlank >= 0 ? firstBlank : null);
  };

  const handleApplyHint = () => {
    if (!hint || !canPlay) return;
    setDraft([...hint.values]);
  };

  const allFilled = draft.every((v) => v !== null);

  const handleSubmit = () => {
    if (!canPlay || !allFilled) return;
    onMove({
      type: 'submit',
      values: draft.map((v) => v ?? 0),
    });
  };

  const rowsFromTop = Array.from({ length: view.height }, (_, i) => view.height - 1 - i);
  const opHint =
    view.numberMode === 'products'
      ? 'Regel: Oberer Stein = Linker Stein · Rechter Stein'
      : 'Regel: Oberer Stein = Linker Stein + Rechter Stein';

  return (
    <div className="nw-layout">
      {/* Kopfzeile */}
      <div className="nw-header">
        <div>
          <span className="nw-rule-badge">{opHint}</span>
        </div>
        <div className="nw-meta">
          <strong>
            Mauer {view.round} / {view.totalRounds}
          </strong>
          <span>Punkte: {view.scores[mySeat] ?? 0}</span>
        </div>
      </div>

      {/* Pyramide */}
      <div className="nw-pyramid" role="group" aria-label="Rechenmauer">
        {rowsFromTop.map((r) => {
          const cols = view.height - r;
          return (
            <div key={r} className="nw-row">
              {Array.from({ length: cols }, (_, c) => {
                const idx = stoneIndex(view.height, r, c);
                const isGiven = view.givens[idx] !== null;
                const val = mySub?.values ? mySub.values[idx] : draft[idx];
                const isSelected = canPlay && selectedIdx === idx;

                return (
                  <button
                    key={idx}
                    type="button"
                    className="nw-brick"
                    data-given={isGiven ? 'true' : undefined}
                    data-selected={isSelected ? 'true' : undefined}
                    data-filled={!isGiven && val !== null && val !== undefined ? 'true' : undefined}
                    disabled={!canPlay || isGiven}
                    onClick={() => handleSelectStone(idx)}
                  >
                    <span className="nw-brick-val">
                      {val !== null && val !== undefined ? formatStoneValue(val, view.numberMode) : '?'}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Antwort-Chips & Steuerung */}
      {canPlay ? (
        <div className="nw-controls">
          <div className="nw-chips-label">
            Wähle den passenden Wert für den markierten Stein:
          </div>
          <div className="nw-chips" role="group" aria-label="Zahlenauswahl">
            {view.choicePool.map((val) => (
              <button
                key={val}
                type="button"
                className="nw-chip"
                onClick={() => handlePickValue(val)}
              >
                {formatStoneValue(val, view.numberMode)}
              </button>
            ))}
          </div>

          <div className="nw-actions">
            <button
              type="button"
              className="nw-btn nw-btn-secondary"
              disabled={selectedIdx === null || draft[selectedIdx] === null}
              onClick={handleClearSelected}
            >
              ⌫ Stein leeren
            </button>
            <button
              type="button"
              className="nw-btn nw-btn-secondary"
              onClick={handleReset}
            >
              ↺ Alle leeren
            </button>
            {hint && (
              <button
                type="button"
                className="nw-btn nw-btn-secondary"
                onClick={handleApplyHint}
              >
                💡 Lösung ausfüllen
              </button>
            )}
            <button
              type="button"
              className="nw-btn nw-btn-primary"
              disabled={!allFilled}
              onClick={handleSubmit}
            >
              ✓ Mauer prüfen & einloggen
            </button>
          </div>
        </div>
      ) : mySub ? (
        <div className="nw-waiting">
          ✓ Mauer eingeloggt (+{mySub.points} Pkt., {mySub.correctCount} Steine richtig)
        </div>
      ) : null}

      {/* Auswertung der Vorrunde */}
      {view.lastRound && (
        <div className="nw-summary">
          <strong>
            Lösung Mauer {view.lastRound.round}:{' '}
            {view.lastRound.solution.map((v) => formatStoneValue(v, view.numberMode)).join(' · ')}
          </strong>
        </div>
      )}
    </div>
  );
}

export const gameUi: GameUi<NumberWallState, NumberWallMove> = {
  Board,
  SeatSymbol: WallSymbol,
  seatLabel: (seat) => `Platz ${seat + 1}`,
  seatDetail: (view, seat) => {
    const sc = view.scores[seat] ?? 0;
    const sub = view.submissions[seat];
    if (view.phase === 'done') return `${sc} Pkt.`;
    return `${sc} Pkt.${sub ? ' · ✓' : ''}`;
  },
  sounds: {
    submitted: (e) => (e.perfect ? 'paar' : 'stein-setzen'),
    roundOver: 'paar',
  },
};
