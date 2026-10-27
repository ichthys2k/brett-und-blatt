import type { SeatId } from '@brett-und-blatt/engine';
import type { BoardProps, GameUi } from '@brett-und-blatt/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { result, type FoundWordEntry, type SaladPlayerState, type WordSaladMove, type WordSaladState } from '../rules';
import { canFormFromStem, getValidSubwords, normalizeSaladWord, scoreWordLength } from '../words';
import './styles.css';

const SEAT_COLORS = ['#16a34a', '#2563eb', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#4f46e5'];

function SaladSymbol({ seat, className }: { seat: SeatId; className?: string }) {
  const color = SEAT_COLORS[seat % SEAT_COLORS.length]!;
  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded-md text-xs font-black text-white ${className ?? ''}`}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      🥗
    </span>
  );
}

function Board({
  view,
  viewer,
  legalMoves,
  onMove,
  seatNames,
  humanSeats,
}: BoardProps<WordSaladState, WordSaladMove>) {
  const gameResult = result(view);
  const [activeHumanSeat, setActiveHumanSeat] = useState<SeatId>(0);

  const defaultSeat: SeatId =
    typeof viewer === 'number'
      ? viewer
      : humanSeats && humanSeats.length > 0
        ? humanSeats[0]!.seat
        : 0;

  const activeSeat: SeatId =
    humanSeats && humanSeats.length > 1
      ? (humanSeats.find((h) => h.seat === activeHumanSeat)?.seat ?? defaultSeat)
      : defaultSeat;

  const activeHs =
    humanSeats && humanSeats.length > 1
      ? humanSeats.find((h) => h.seat === activeSeat)
      : undefined;

  const effectiveMoves = activeHs ? activeHs.legalMoves : legalMoves;
  const triggerMove = useCallback(
    (move: WordSaladMove) => {
      if (activeHs) activeHs.onMove(move);
      else onMove(move);
    },
    [activeHs, onMove],
  );

  const myPlayer = view.players[activeSeat] ?? view.players[0]!;

  // Gültige Teilwörter für das aktuelle Stammwort berechnen
  const validSubwords = useMemo(
    () => getValidSubwords(view.currentStem, view.minLength),
    [view.currentStem, view.minLength],
  );
  const validSet = useMemo(() => new Set(validSubwords), [validSubwords]);
  const longCount = useMemo(() => validSubwords.filter((w) => w.length >= 6).length, [validSubwords]);

  // Lokale Reihenfolge der Stammwort-Buchstabenkacheln (zum Mischen)
  const stemChars = useMemo(() => [...view.currentStem], [view.currentStem]);
  const [tileOrder, setTileOrder] = useState<number[]>(() => stemChars.map((_, i) => i));
  const [pickedIndices, setPickedIndices] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null);

  useEffect(() => {
    setTileOrder(stemChars.map((_, i) => i));
    setPickedIndices([]);
    setFeedback(null);
  }, [view.currentStem, view.roundIndex, activeSeat, stemChars]);

  const draftWord = useMemo(
    () => pickedIndices.map((idx) => stemChars[idx] ?? '').join(''),
    [pickedIndices, stemChars],
  );

  const canAct = !gameResult && !view.done && !myPlayer.done && effectiveMoves.length > 0;

  const shuffleTiles = useCallback(() => {
    setTileOrder((prev) => {
      const copy = [...prev];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = copy[i]!;
        copy[i] = copy[j]!;
        copy[j] = tmp;
      }
      return copy;
    });
  }, []);

  const handlePickTile = useCallback(
    (charIndex: number) => {
      if (!canAct) return;
      if (pickedIndices.includes(charIndex)) return;
      setPickedIndices((prev) => [...prev, charIndex]);
      setFeedback(null);
    },
    [canAct, pickedIndices],
  );

  const handleRemoveDraftPos = useCallback((draftPos: number) => {
    setPickedIndices((prev) => prev.filter((_, i) => i !== draftPos));
    setFeedback(null);
  }, []);

  const handleBackspace = useCallback(() => {
    setPickedIndices((prev) => prev.slice(0, -1));
    setFeedback(null);
  }, []);

  const handleClear = useCallback(() => {
    setPickedIndices([]);
    setFeedback(null);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!canAct) return;
    const norm = normalizeSaladWord(draftWord);
    if (norm.length < view.minLength) {
      setFeedback({ text: `Mindestens ${view.minLength} Buchstaben nötig!`, kind: 'err' });
      return;
    }
    if (norm === view.currentStem) {
      setFeedback({ text: 'Das Stammwort selbst zählt nicht als Teilwort!', kind: 'err' });
      return;
    }
    if (myPlayer.foundWords.includes(norm)) {
      setFeedback({ text: `„${norm}“ hast du in dieser Runde schon gefunden!`, kind: 'err' });
      setPickedIndices([]);
      return;
    }
    if (!canFormFromStem(norm, view.currentStem, view.minLength) || !validSet.has(norm)) {
      setFeedback({ text: `„${norm}“ ist nicht in der Wortliste enthalten.`, kind: 'err' });
      return;
    }

    const pts = scoreWordLength(norm.length);
    setFeedback({ text: `✓ „${norm}“ gefunden (+${pts} ${pts === 1 ? 'Punkt' : 'Punkte'})!`, kind: 'ok' });
    setPickedIndices([]);
    triggerMove({ type: 'submit', word: norm });
  }, [canAct, draftWord, view.minLength, view.currentStem, myPlayer.foundWords, validSet, triggerMove]);

  const handleFinishRound = useCallback(() => {
    if (!canAct) return;
    setPickedIndices([]);
    triggerMove({ type: 'finishRound' });
  }, [canAct, triggerMove]);

  // Tastatur-Unterstützung (A-Z, Ä, Ö, Ü, Backspace, Escape, Enter)
  useEffect(() => {
    if (!canAct) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClear();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
        return;
      }
      const upper = e.key.toUpperCase();
      if (/^[A-ZÄÖÜ]$/.test(upper)) {
        const freeIdx = tileOrder.find(
          (origIdx) => stemChars[origIdx] === upper && !pickedIndices.includes(origIdx),
        );
        if (freeIdx !== undefined) {
          e.preventDefault();
          handlePickTile(freeIdx);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    canAct,
    tileOrder,
    stemChars,
    pickedIndices,
    handleBackspace,
    handleClear,
    handleSubmit,
    handlePickTile,
  ]);

  const labelFor = (s: SeatId) => seatNames?.[s] ?? `Platz ${s + 1}`;

  return (
    <div className="bb-ws-root">
      {/* Kopfzeile mit Rundeninfo & Stammwort */}
      <div className="bb-ws-header">
        <div className="bb-ws-title-group">
          <span className="bb-ws-round-badge">
            Runde {view.roundIndex + 1} von {view.totalRounds} ·{' '}
            {view.mode === 'unique' ? '⭐ Exklusiv-Bonus (×2)' : '🥗 Wörterjagd'}
          </span>
          <div className="bb-ws-stem-title">Stammwort: „{view.currentDisplay}“</div>
          {view.currentHint && <div className="bb-ws-stem-hint">💡 {view.currentHint}</div>}
        </div>
        <div className="bb-ws-stats-pill">
          <span>
            Versteckte Teilwörter (ab {view.minLength} Buchst.): <strong>{view.totalPossible}</strong>
          </span>
          <span>
            Davon lange Wörter (≥ 6 Buchst.): <strong>{longCount}</strong>
          </span>
        </div>
      </div>

      {/* Punktestand aller Plätze */}
      <div className="bb-ws-scoreboard">
        {view.players.map((p: SaladPlayerState) => (
          <div
            key={p.seat}
            className={`bb-ws-player-card ${p.seat === activeSeat ? 'is-active' : ''} ${
              p.done ? 'is-done' : ''
            }`}
          >
            <div className="bb-ws-player-info">
              <span className="bb-ws-player-name">{labelFor(p.seat)}</span>
              <span className="bb-ws-player-sub">
                {p.done ? `✓ Fertig (${p.foundCount} Wörter)` : `${p.foundCount} / ${view.totalPossible} Wörter`}
              </span>
            </div>
            <div className="bb-ws-player-score">{p.score} Pkt.</div>
          </div>
        ))}
      </div>

      {/* Sitzplatz-Umschalter für Hot-Seat, falls mehrere menschliche Plätze am selben Gerät spielen */}
      {humanSeats && humanSeats.length > 1 && !view.done && (
        <div className="bb-ws-seat-tabs">
          {humanSeats.map((hs) => {
            const p = view.players[hs.seat];
            return (
              <button
                key={hs.seat}
                type="button"
                className={`bb-ws-btn ${hs.seat === activeSeat ? 'bb-ws-btn-submit' : ''}`}
                onClick={() => setActiveHumanSeat(hs.seat)}
              >
                {labelFor(hs.seat)} {p?.done ? '✓' : `(${p?.foundCount ?? 0})`}
              </button>
            );
          })}
        </div>
      )}

      {/* Haupt-Salatschüssel mit Buchstaben-Kacheln & Wort-Baustelle */}
      {!view.done && (
        <div className="bb-ws-bowl">
          <div className="bb-ws-tiles" role="group" aria-label="Buchstabenkacheln des Stammwortes">
            {tileOrder.map((origIdx) => {
              const ch = stemChars[origIdx]!;
              const used = pickedIndices.includes(origIdx);
              return (
                <button
                  key={origIdx}
                  type="button"
                  className={`bb-ws-tile ${used ? 'is-used' : ''}`}
                  disabled={used || !canAct}
                  onClick={() => handlePickTile(origIdx)}
                >
                  {ch}
                </button>
              );
            })}
          </div>

          {/* Aktueller Wort-Entwurf */}
          <div className="bb-ws-draft-row" aria-live="polite">
            {pickedIndices.length === 0 ? (
              <span className="bb-ws-draft-placeholder">
                {myPlayer.done
                  ? 'Du hast diese Runde beendet – warte auf die Mitspieler …'
                  : `Tippe Buchstaben an oder nutze die Tastatur (mind. ${view.minLength} Buchstaben)`}
              </span>
            ) : (
              pickedIndices.map((origIdx, pos) => (
                <button
                  key={`${origIdx}-${pos}`}
                  type="button"
                  className="bb-ws-draft-slot"
                  title="Antippen zum Entfernen"
                  onClick={() => handleRemoveDraftPos(pos)}
                >
                  {stemChars[origIdx]}
                </button>
              ))
            )}
          </div>

          {/* Aktionsknöpfe */}
          <div className="bb-ws-controls">
            <button
              type="button"
              className="bb-ws-btn"
              onClick={shuffleTiles}
              disabled={!canAct}
              title="Buchstabenkacheln neu mischen"
            >
              🔀 Mischen
            </button>
            <button
              type="button"
              className="bb-ws-btn"
              onClick={handleBackspace}
              disabled={!canAct || pickedIndices.length === 0}
            >
              ⌫ Zurück
            </button>
            <button
              type="button"
              className="bb-ws-btn"
              onClick={handleClear}
              disabled={!canAct || pickedIndices.length === 0}
            >
              ✕ Leeren
            </button>
            <button
              type="button"
              className="bb-ws-btn bb-ws-btn-submit"
              onClick={handleSubmit}
              disabled={!canAct || pickedIndices.length < view.minLength}
            >
              ✓ Wort einreichen ({scoreWordLength(pickedIndices.length)} Pkt.)
            </button>
            <button
              type="button"
              className="bb-ws-btn bb-ws-btn-finish"
              onClick={handleFinishRound}
              disabled={!canAct}
            >
              🏁 Fertig für diese Runde
            </button>
          </div>

          {feedback && (
            <div className={`bb-ws-feedback ${feedback.kind === 'ok' ? 'is-ok' : 'is-err'}`}>
              {feedback.text}
            </div>
          )}
        </div>
      )}

      {/* Eigene gefundene Wörter in der aktuellen Runde */}
      {!view.done && (
        <div className="bb-ws-found-box">
          <div className="bb-ws-found-header">
            <span>Deine gefundenen Wörter ({myPlayer.foundWords.length})</span>
            <span>3 B.=1 · 4 B.=2 · 5 B.=4 · 6 B.=7 · 7+ B.=11 Pkt.</span>
          </div>
          {myPlayer.foundWords.length === 0 ? (
            <div className="bb-ws-draft-placeholder">Noch keine Wörter in dieser Runde eingereicht.</div>
          ) : (
            <div className="bb-ws-chip-list">
              {[...myPlayer.foundWords]
                .sort((a, b) => b.length - a.length || a.localeCompare(b, 'de'))
                .map((w) => (
                  <span key={w} className="bb-ws-word-chip">
                    {w}
                    <span className="bb-ws-word-pts">+{scoreWordLength(w.length)}</span>
                  </span>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Runden-Auswertung (nach Ende einer Runde bzw. am Spielende) */}
      {view.lastRoundSummary && (
        <div className="bb-ws-summary-card">
          <div className="bb-ws-found-header" style={{ marginBottom: 0 }}>
            <span>
              📋 Auswertung Runde {view.lastRoundSummary.round}: „{view.lastRoundSummary.stemDisplay}“
            </span>
          </div>
          {view.lastRoundSummary.playerFinds.map((finds: FoundWordEntry[], sIdx: number) => (
            <div key={sIdx}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.3rem' }}>
                {labelFor(sIdx)} ({finds.length} {finds.length === 1 ? 'Wort' : 'Wörter'}):
              </div>
              {finds.length === 0 ? (
                <span className="bb-ws-draft-placeholder">Keine Wörter eingereicht</span>
              ) : (
                <div className="bb-ws-chip-list">
                  {finds.map((f: FoundWordEntry) => (
                    <span
                      key={f.word}
                      className={`bb-ws-word-chip ${f.unique ? 'is-unique' : ''}`}
                      title={f.unique ? 'Exklusiv-Fund! Doppelte Punkte!' : undefined}
                    >
                      {f.unique ? '⭐ ' : ''}
                      {f.word}
                      <span className="bb-ws-word-pts">+{f.basePoints + f.bonusPoints}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {view.lastRoundSummary.missedGems.length > 0 && (
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.86rem', marginBottom: '0.3rem', color: '#475569' }}>
                💎 Unentdeckte lange Wörter in „{view.lastRoundSummary.stemDisplay}“:
              </div>
              <div className="bb-ws-chip-list">
                {view.lastRoundSummary.missedGems.map((gem: string) => (
                  <span key={gem} className="bb-ws-word-chip is-missed">
                    {gem}
                    <span className="bb-ws-word-pts">{scoreWordLength(gem.length)} Pkt.</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const gameUi: GameUi<WordSaladState, WordSaladMove> = {
  Board,
  SeatSymbol: SaladSymbol,
  seatLabel: (seat) => `Platz ${seat + 1}`,
  seatDetail: (view, seat) => {
    const p = view.players[seat];
    if (!p) return '';
    return `${p.score} Pkt. · ${p.foundCount} W.`;
  },
  sounds: {
    wordFound: 'paar',
    roundFinished: 'stein-heraus',
  },
};
