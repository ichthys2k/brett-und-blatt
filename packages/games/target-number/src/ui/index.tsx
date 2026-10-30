import type { BoardProps, GameUi } from '@brett-und-blatt/ui';
import { useEffect, useMemo, useState } from 'react';
import {
  allowedOpList,
  applySingleStep,
  scoreSubmission,
  simulateSteps,
  type CalcStep,
  type MathOp,
  type TargetNumberMove,
  type TargetNumberState,
} from '../rules';
import './styles.css';

const OP_LABELS: Record<MathOp, { symbol: string; name: string }> = {
  '+': { symbol: '+', name: 'Addieren (+)' },
  '-': { symbol: '−', name: 'Subtrahieren (−)' },
  '*': { symbol: '·', name: 'Multiplizieren (·)' },
  '/': { symbol: ':', name: 'Dividieren (:)' },
};

function TargetSymbol({ className }: { className?: string }) {
  return (
    <span className={className} aria-hidden="true">
      🎯
    </span>
  );
}

function Board({ view, viewer, legalMoves, hint, onMove, seatNames }: BoardProps<TargetNumberState, TargetNumberMove>) {
  const mySeat = typeof viewer === 'number' ? viewer : 0;
  const mySubmission = view.submissions[mySeat] ?? null;
  const canPlay = legalMoves.length > 0 && view.phase === 'play' && mySubmission === null;

  const [steps, setSteps] = useState<CalcStep[]>([]);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [selectedOp, setSelectedOp] = useState<MathOp | null>(null);
  const [chosenIndex, setChosenIndex] = useState<number>(0);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Bei Rundenwechsel lokalen Rechenweg zurücksetzen
  useEffect(() => {
    setSteps([]);
    setSelectedCard(null);
    setSelectedOp(null);
    setChosenIndex(0);
    setFeedback(null);
  }, [view.round, view.target, mySeat]);

  const items = useMemo(() => {
    return (
      simulateSteps(view.cards, steps, view.allowedOps) ??
      view.cards.map((v) => ({ value: v, expr: String(v), prec: 3 }))
    );
  }, [view.cards, steps, view.allowedOps]);

  const activeIdx = chosenIndex < items.length ? chosenIndex : items.length - 1;
  const activeItem = items[activeIdx] ?? { value: view.cards[0] ?? 0, expr: String(view.cards[0] ?? 0), prec: 3 };
  const usedAll = items.length === 1 && steps.length === view.cards.length - 1;
  const currentPoints = scoreSubmission(activeItem.value, view.target, usedAll);
  const diff = Math.abs(activeItem.value - view.target);

  const ops = allowedOpList(view.allowedOps);

  const handleCardTap = (idx: number) => {
    if (!canPlay) return;
    setFeedback(null);
    setChosenIndex(idx);

    if (selectedCard === null) {
      setSelectedCard(idx);
      return;
    }

    if (selectedCard === idx) {
      setSelectedCard(null);
      setSelectedOp(null);
      return;
    }

    if (selectedOp === null) {
      // Ohne gewähltes Rechenzeichen einfach die Auswahl auf die neue Karte wechseln
      setSelectedCard(idx);
      return;
    }

    // Schritt prüfen (ggf. bei Subtraktion/Division auch umgekehrte Reihenfolge zulassen, falls eindeutig)
    let a = selectedCard;
    let b = idx;
    let combined = applySingleStep(items[a]!, selectedOp, items[b]!, view.allowedOps);
    if (!combined && (selectedOp === '-' || selectedOp === '/')) {
      const reversed = applySingleStep(items[b]!, selectedOp, items[a]!, view.allowedOps);
      if (reversed) {
        a = idx;
        b = selectedCard;
        combined = reversed;
      }
    }

    if (!combined) {
      setFeedback(
        selectedOp === '/'
          ? 'Division geht nicht glatt auf!'
          : 'Ergebnis darf nicht negativ sein!',
      );
      return;
    }

    const nextSteps = [...steps, { a, op: selectedOp, b }];
    const nextLen = items.length - 1;
    setSteps(nextSteps);
    setChosenIndex(nextLen - 1);
    setSelectedCard(nextLen === 1 ? null : nextLen - 1);
    setSelectedOp(null);
  };

  const handleOpTap = (op: MathOp) => {
    if (!canPlay) return;
    setFeedback(null);
    if (selectedCard === null) {
      setSelectedCard(activeIdx);
    }
    setSelectedOp((prev) => (prev === op ? null : op));
  };

  const handleUndo = () => {
    if (steps.length === 0) return;
    const nextSteps = steps.slice(0, -1);
    setSteps(nextSteps);
    setSelectedCard(null);
    setSelectedOp(null);
    setFeedback(null);
    setChosenIndex(0);
  };

  const handleReset = () => {
    setSteps([]);
    setSelectedCard(null);
    setSelectedOp(null);
    setFeedback(null);
    setChosenIndex(0);
  };

  const handleApplyHint = () => {
    if (!hint || !canPlay) return;
    setSteps(hint.steps);
    setChosenIndex(hint.finalIndex);
    setSelectedCard(null);
    setSelectedOp(null);
    setFeedback('Tipp übernommen – du kannst ihn direkt einloggen!');
  };

  const handleSubmit = () => {
    if (!canPlay) return;
    onMove({
      type: 'submit',
      steps,
      finalIndex: activeIdx,
    });
  };

  return (
    <div className="tn-layout">
      {/* Kopfzeile mit Zielzahl & Rundeninfo */}
      <div className="tn-header">
        <div className="tn-target-box" data-exact={diff === 0 && canPlay ? 'true' : undefined}>
          <span className="tn-target-label">Zielzahl</span>
          <strong className="tn-target-number">{view.target}</strong>
        </div>
        <div className="tn-meta-box">
          <span className="tn-round-badge">
            Runde {view.round} / {view.totalRounds}
          </span>
          <span className="tn-score-badge">Dein Punktestand: {view.scores[mySeat] ?? 0} Pkt.</span>
        </div>
      </div>

      {/* Aktueller Rechenterm */}
      {canPlay ? (
        <div className="tn-term-panel" data-exact={diff === 0 ? 'true' : undefined}>
          <div className="tn-term-label">Dein aktueller Rechenterm:</div>
          <div className="tn-term-display">
            <span className="tn-term-expr">{activeItem.expr}</span>
            <span className="tn-term-eq">=</span>
            <strong className="tn-term-val">{activeItem.value}</strong>
          </div>
          <div className="tn-term-status">
            {diff === 0 ? (
              <span className="tn-badge-exact">
                🎯 Volltreffer! ({usedAll ? '12 Punkte mit allen Karten!' : '10 Punkte'})
              </span>
            ) : (
              <span className="tn-badge-diff">
                Abstand zur Zielzahl: {diff} ({currentPoints} {currentPoints === 1 ? 'Punkt' : 'Punkte'})
              </span>
            )}
          </div>
        </div>
      ) : mySubmission ? (
        <div className="tn-term-panel" data-exact={mySubmission.value === view.target ? 'true' : undefined}>
          <div className="tn-term-label">Dein eingeloggtes Ergebnis:</div>
          <div className="tn-term-display">
            <span className="tn-term-expr">{mySubmission.expr}</span>
            <span className="tn-term-eq">=</span>
            <strong className="tn-term-val">{mySubmission.value}</strong>
          </div>
          <div className="tn-term-status">
            <span className="tn-badge-exact">
              ✓ Eingeloggt (+{mySubmission.points} Pkt.) – warte auf Mitspieler …
            </span>
          </div>
        </div>
      ) : null}

      {/* Zahlenkarten */}
      {canPlay && (
        <>
          <div className="tn-cards-grid" role="group" aria-label="Verfügbare Zahlenkarten">
            {items.map((item, idx) => {
              const isSelected = selectedCard === idx;
              const isChosen = activeIdx === idx;
              const isTargetMatch = item.value === view.target;
              return (
                <button
                  key={`${idx}-${item.expr}`}
                  type="button"
                  className="tn-card"
                  data-selected={isSelected || undefined}
                  data-chosen={isChosen || undefined}
                  data-match={isTargetMatch || undefined}
                  onClick={() => handleCardTap(idx)}
                >
                  <span className="tn-card-value">{item.value}</span>
                  {item.expr !== String(item.value) && (
                    <span className="tn-card-subexpr">{item.expr}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Rechenzeichen-Leiste */}
          <div className="tn-ops-bar" role="group" aria-label="Rechenzeichen">
            {ops.map((op) => (
              <button
                key={op}
                type="button"
                className="tn-op-btn"
                data-selected={selectedOp === op || undefined}
                disabled={items.length < 2}
                onClick={() => handleOpTap(op)}
                title={OP_LABELS[op].name}
              >
                {OP_LABELS[op].symbol}
              </button>
            ))}
          </div>

          {feedback && <div className="tn-feedback">{feedback}</div>}

          {/* Aktionsleiste: Rückgängig, Neu, Einloggen */}
          <div className="tn-actions-bar">
            <button
              type="button"
              className="tn-btn tn-btn-secondary"
              disabled={steps.length === 0}
              onClick={handleUndo}
            >
              ↩ Schritt zurück
            </button>
            <button
              type="button"
              className="tn-btn tn-btn-secondary"
              disabled={steps.length === 0}
              onClick={handleReset}
            >
              ↺ Neu ansetzen
            </button>
            {hint && (
              <button
                type="button"
                className="tn-btn tn-btn-secondary"
                onClick={handleApplyHint}
              >
                💡 Lösung übernehmen
              </button>
            )}
            <button
              type="button"
              className="tn-btn tn-btn-primary"
              data-exact={diff === 0 || undefined}
              onClick={handleSubmit}
            >
              {diff === 0
                ? `🎯 ${activeItem.value} einloggen! (+${currentPoints} Pkt.)`
                : `✓ ${activeItem.value} einloggen (+${currentPoints} Pkt.)`}
            </button>
          </div>
        </>
      )}

      {/* Rückblick auf die letzte abgeschlossene Runde inkl. Musterlösung */}
      {view.lastRound && (
        <div className="tn-round-summary">
          <div className="tn-summary-head">
            <strong>
              Auswertung Runde {view.lastRound.round} (Zielzahl {view.lastRound.target} aus{' '}
              {view.lastRound.cards.join(', ')})
            </strong>
            <span className="tn-solution-pill">
              Musterlösung: <code>{view.lastRound.solutionExpr}</code>
            </span>
          </div>
          <div className="tn-summary-list">
            {view.lastRound.submissions.map((sub, sIdx) => (
              <div key={sIdx} className="tn-summary-row">
                <span className="tn-summary-name">{seatNames?.[sIdx] ?? `Platz ${sIdx + 1}`}</span>
                <code className="tn-summary-expr">
                  {sub.expr} = {sub.value}
                </code>
                <strong className="tn-summary-pts">+{sub.points} Pkt.</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export const gameUi: GameUi<TargetNumberState, TargetNumberMove> = {
  Board,
  SeatSymbol: TargetSymbol,
  seatLabel: (seat) => `Platz ${seat + 1}`,
  seatDetail: (view, seat) => {
    const score = view.scores[seat] ?? 0;
    const sub = view.submissions[seat];
    if (view.phase === 'done') return `${score} Pkt.`;
    return `${score} Pkt.${sub ? ' · ✓' : ''}`;
  },
  sounds: {
    submitted: (e) => (e.exact ? 'paar' : 'rechnen-falsch'),
    roundOver: 'paar',
  },
};
