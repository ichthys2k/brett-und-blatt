import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

export interface RoundSummaryPlayer {
  seat: number;
  name: string;
  avatar?: string | null;
  symbol?: ReactNode;
  /** Punktzahl vor dieser Runde */
  previousScore: number;
  /** Punkteänderung dieser Runde (z. B. +12, -4, 0) */
  roundChange: number;
  /** Neuer Gesamtstand nach dieser Runde */
  currentScore: number;
  /** Optionale Zusatzangabe (z. B. "👑 Präsident", "40 Augen / +10 Meldung", "Alleinspieler") */
  detail?: ReactNode;
  /** Ob dies der Spieler an diesem Gerät / der eigene Spieler ist */
  isMe?: boolean;
  /** Spezielles Kennzeichen / Icon (z. B. "✈️" bei Tiefflug) */
  badge?: ReactNode;
}

export interface RoundSummaryProps {
  /** Titel des Dialogs, z. B. "Runde beendet", "Runde 3 von 5", "Spiel eingepasst" */
  title: string;
  /** Untertitel oder Runden-Ergebnis, z.B. "Alleinspieler gewinnt!" */
  subtitle?: ReactNode;
  /** Zusätzliche Information / Erklärung zur Runde */
  roundDetail?: ReactNode;
  /** Spieler mit Punkteständen */
  players: RoundSummaryPlayer[];
  /** Sortierrichtung: 'desc' (Standard: viele Punkte führen) oder 'asc' (wenige Punkte führen, z.B. Tiefflug) */
  sortDirection?: 'desc' | 'asc';
  /** Aktionsknöpfe (z.B. "Nächste Runde"-Button oder Wartehinweis) */
  actions?: ReactNode;
  /** Fußnote / Notiz */
  note?: ReactNode;
  /** Schließen-Callback (optional) */
  onClose?: () => void;
  /** Zusätzliche CSS-Klasse */
  className?: string;
  /** Ob das Element als modales Overlay dargestellt wird (Standard: true) */
  modal?: boolean;
}

/** Ermittelt, ob Barrierefreiheit-Einstellung für reduzierte Bewegung aktiv ist. */
const isReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Berechnet Platzierungen (1, 2, 3...) anhand der Punktwerte.
 * Gleichstände erhalten denselben Platz; der nächste Rang überspringt entsprechend.
 */
export function calculateRanks(
  players: readonly { seat: number; score: number }[],
  direction: 'desc' | 'asc' = 'desc',
): Map<number, number> {
  const sorted = [...players].sort((a, b) =>
    direction === 'asc' ? a.score - b.score : b.score - a.score,
  );
  const ranks = new Map<number, number>();
  let currentRank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].score !== sorted[i - 1].score) {
      currentRank = i + 1;
    }
    ranks.set(sorted[i].seat, currentRank);
  }
  return ranks;
}

/** Easing-Funktion für flüssiges Hochzählen */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Gemeinsamer Baustein für den Zwischenstand am Rundenende in Serienspielen (Issue #88).
 * - Zeigt Runden-Ergebnis und Details klar an.
 * - Lässt die Punkte der Runde sichtbar hochzählen.
 * - Lässt die Zeilen bei Rangwechseln sanft an ihre neue Position gleiten (FLIP).
 * - Beachtet prefers-reduced-motion (sofortiger Endstand ohne Animation).
 */
export function RoundSummary({
  title,
  subtitle,
  roundDetail,
  players,
  sortDirection = 'desc',
  actions,
  note,
  onClose,
  className = '',
  modal = true,
}: RoundSummaryProps) {
  const reduced = isReducedMotion();

  // Rangfolgen für Start und Ende
  const initialRanks = useMemo(
    () =>
      calculateRanks(
        players.map((p) => ({ seat: p.seat, score: p.previousScore })),
        sortDirection,
      ),
    [players, sortDirection],
  );

  const finalRanks = useMemo(
    () =>
      calculateRanks(
        players.map((p) => ({ seat: p.seat, score: p.currentScore })),
        sortDirection,
      ),
    [players, sortDirection],
  );

  // Zustand für Reihenfolge ('previous' während Hochzählen, 'current' danach)
  const [orderState, setOrderState] = useState<'previous' | 'current'>(
    reduced ? 'current' : 'previous',
  );

  // Fortschritt der Zählanimation (0 bis 1)
  const [countProgress, setCountProgress] = useState<number>(reduced ? 1 : 0);

  // Referenzen auf die Zeilen für FLIP-Animation
  const rowRefs = useRef<Map<number, HTMLLIElement>>(new Map());
  const prevTopsRef = useRef<Map<number, number>>(new Map());

  // Escape-Taste zum Schließen
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Zählanimation
  useEffect(() => {
    if (reduced) return;

    let animFrame: number;
    let startTime: number | null = null;
    const countDuration = 800; // ms Zähldauer
    const initialDelay = 250; // ms Pause vor Zählbeginn

    const step = (now: number) => {
      if (!startTime) startTime = now;
      const elapsed = now - startTime;

      if (elapsed < initialDelay) {
        animFrame = requestAnimationFrame(step);
        return;
      }

      const countElapsed = elapsed - initialDelay;
      const p = Math.min(1, countElapsed / countDuration);
      setCountProgress(p);

      if (p < 1) {
        animFrame = requestAnimationFrame(step);
      } else {
        // Zählen abgeschlossen -> Vorbereitung FLIP
        // 1. Positionen vor dem Sortierungswechsel (First) speichern
        const tops = new Map<number, number>();
        rowRefs.current.forEach((el, seat) => {
          if (el) {
            tops.set(seat, el.getBoundingClientRect().top);
          }
        });
        prevTopsRef.current = tops;

        // 2. Reihenfolge umschalten
        setOrderState('current');
      }
    };

    animFrame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animFrame);
  }, [reduced]);

  // FLIP: Nach dem Umschalten auf 'current' die Verschiebung animieren
  useLayoutEffect(() => {
    if (reduced || orderState !== 'current') return;
    const prevTops = prevTopsRef.current;
    if (prevTops.size === 0) return;

    // Für jedes Element: Last - First berechnen und invertieren
    const invertedElements: { el: HTMLLIElement; deltaY: number }[] = [];

    rowRefs.current.forEach((el, seat) => {
      const oldTop = prevTops.get(seat);
      if (el && oldTop !== undefined) {
        const newTop = el.getBoundingClientRect().top;
        const deltaY = oldTop - newTop;
        if (Math.abs(deltaY) > 0.5) {
          el.style.transform = `translateY(${deltaY}px)`;
          el.style.transition = 'none';
          invertedElements.push({ el, deltaY });
        }
      }
    });

    prevTopsRef.current.clear();

    if (invertedElements.length === 0) return;

    // Play: Im nächsten Frame transform zurücksetzen mit Transition
    const timer = requestAnimationFrame(() => {
      invertedElements.forEach(({ el }) => {
        el.style.transform = '';
        el.style.transition = 'transform 450ms cubic-bezier(0.2, 0.9, 0.3, 1)';
      });
    });

    // Cleanup nach Animationsende
    const cleanupTimer = window.setTimeout(() => {
      invertedElements.forEach(({ el }) => {
        el.style.transform = '';
        el.style.transition = '';
      });
    }, 500);

    return () => {
      cancelAnimationFrame(timer);
      clearTimeout(cleanupTimer);
    };
  }, [orderState, reduced]);

  // Angezeigte Reihenfolge der Spieler
  const displayPlayers = useMemo(() => {
    const list = [...players];
    if (orderState === 'previous') {
      return list.sort((a, b) =>
        sortDirection === 'asc'
          ? a.previousScore - b.previousScore
          : b.previousScore - a.previousScore,
      );
    }
    return list.sort((a, b) =>
      sortDirection === 'asc'
        ? a.currentScore - b.currentScore
        : b.currentScore - a.currentScore,
    );
  }, [players, orderState, sortDirection]);

  // Berechne den aktuellen Punktestand während des Zählens
  const getDisplayedScore = (player: RoundSummaryPlayer): number => {
    if (reduced || countProgress >= 1) return player.currentScore;
    const eased = easeOutCubic(countProgress);
    return Math.round(
      player.previousScore + (player.currentScore - player.previousScore) * eased,
    );
  };

  const activeRanks = orderState === 'current' ? finalRanks : initialRanks;

  const content = (
    <div
      className={`bub-round-summary-card ${className}`}
      role="document"
    >
      {onClose && (
        <button
          type="button"
          className="bub-round-summary-close"
          aria-label="Schließen"
          onClick={onClose}
        >
          ✕
        </button>
      )}

      <div className="bub-round-summary-header">
        <h2 className="bub-round-summary-title">{title}</h2>
        {subtitle && <p className="bub-round-summary-subtitle">{subtitle}</p>}
        {roundDetail && (
          <div className="bub-round-summary-round-detail">{roundDetail}</div>
        )}
      </div>

      <ol className="bub-round-summary-list" aria-label="Runden-Zwischenstand">
        {displayPlayers.map((player) => {
          const rank = activeRanks.get(player.seat) ?? 1;
          const displayedScore = getDisplayedScore(player);
          const change = player.roundChange;
          const changeText =
            change > 0 ? `+${change}` : change < 0 ? `${change}` : '±0';

          return (
            <li
              key={player.seat}
              ref={(node) => {
                if (node) rowRefs.current.set(player.seat, node);
                else rowRefs.current.delete(player.seat);
              }}
              className="bub-round-summary-row"
              data-me={player.isMe || undefined}
              data-rank={rank}
            >
              <div className="bub-round-summary-place" aria-hidden="true">
                {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`}
              </div>

              {(player.avatar || player.symbol) && (
                <div className="bub-round-summary-avatar" aria-hidden="true">
                  {player.avatar ? (
                    <img src={player.avatar} alt="" className="bub-round-summary-avatar-img" />
                  ) : (
                    <span className="bub-round-summary-symbol">{player.symbol}</span>
                  )}
                </div>
              )}

              <div className="bub-round-summary-info">
                <div className="bub-round-summary-name-line">
                  <span className="bub-round-summary-name">{player.name}</span>
                  {player.badge && (
                    <span className="bub-round-summary-badge">{player.badge}</span>
                  )}
                </div>
                {player.detail && (
                  <div className="bub-round-summary-detail">{player.detail}</div>
                )}
              </div>

              <div className="bub-round-summary-score-area">
                <span
                  className="bub-round-summary-change"
                  data-kind={change > 0 ? 'pos' : change < 0 ? 'neg' : 'zero'}
                  data-animating={countProgress > 0 && countProgress < 1 ? 'true' : undefined}
                >
                  {changeText}
                </span>
                <span className="bub-round-summary-total">{displayedScore}</span>
              </div>
            </li>
          );
        })}
      </ol>

      {note && <div className="bub-round-summary-note">{note}</div>}

      {actions && (
        <div className="bub-round-summary-actions">{actions}</div>
      )}
    </div>
  );

  if (!modal) {
    return <div className="bub-round-summary-inline">{content}</div>;
  }

  return (
    <div
      className="bub-round-summary"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        className="bub-round-summary-backdrop"
        aria-hidden="true"
        onClick={onClose}
        tabIndex={-1}
      />
      {content}
    </div>
  );
}
