import type { RoundState, SeatId } from '@brett-und-blatt/engine';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { renderSVG } from 'uqr';

/** Rangliste: Bei 30 Kindern die Besten und immer der eigene Platz. */
export function RoundStandings({ view, seatNames, me, limit = 5 }: { view: RoundState<unknown, unknown>; seatNames: string[]; me: SeatId | null; limit?: number }) {
  const ranked = view.scores.map((score, seat) => ({ seat, score })).sort((a, b) => b.score - a.score || a.seat - b.seat);
  const rows = ranked.map((row, index) => ({ ...row, rank: index + 1 })).filter((row) => row.rank <= limit || row.seat === me);
  return (
    <ol className="bub-round-ranks" aria-label="Rangliste">
      {rows.map((row) => (
        <li key={row.seat} data-me={row.seat === me || undefined}>
          <span>{row.rank}.</span>
          <span className="bub-round-name">{seatNames[row.seat] ?? `Platz ${row.seat + 1}`}</span>
          {view.phase !== 'answer' && view.gained[row.seat]! > 0 && <span className="bub-round-gain">+{view.gained[row.seat]}</span>}
          <strong>{row.score}</strong>
        </li>
      ))}
    </ol>
  );
}

/** Die Tafel für den Beamer: groß, mit QR-Code zum Mitspielen. */
function RoundWall({ title, link, onClose, children }: { title: string; link?: string; onClose(): void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const svg = useMemo(() => (link ? renderSVG(link, { border: 2, whiteColor: '#ffffff', blackColor: '#1f2328' }) : null), [link]);
  useEffect(() => {
    ref.current?.requestFullscreen?.().catch(() => undefined);
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
    };
  }, [onClose]);
  return (
    <div ref={ref} className="bub-round-wall" role="dialog" aria-label="Tafel">
      <button type="button" className="bub-round-wall-close" aria-label="Tafel schließen" onClick={onClose}>
        ✕
      </button>
      <h2>{title}</h2>
      <div className="bub-round-wall-body">{children}</div>
      {svg && <div className="bub-round-qr" role="img" aria-label={`QR-Code: ${link}`} dangerouslySetInnerHTML={{ __html: svg }} />}
    </div>
  );
}

export interface RoundFrameProps {
  view: RoundState<unknown, unknown>;
  seatNames: string[];
  viewer: SeatId | 'spectator';
  canNext: boolean;
  onNext(): void;
  title: string;
  invite?: { code: string; link: string };
  /** Die Frage mit Eingabe (oder der Auflösung). */
  children: ReactNode;
  /** Was die Tafel groß zeigt: Frage oder Auflösung, ohne Eingabe. */
  wall: ReactNode;
}

/** Rahmen eines Klassenspiels: Runde, ablaufende Zeit, Rangliste und Tafel. */
export function RoundFrame({ view, seatNames, viewer, canNext, onNext, title, invite, children, wall }: RoundFrameProps) {
  const [showWall, setShowWall] = useState(false);
  const me = typeof viewer === 'number' ? viewer : null;
  const done = view.answered.filter(Boolean).length;
  return (
    <div className="bub-round" data-phase={view.phase}>
      <div className="bub-round-bar">
        <span>
          Runde {view.round + 1} von {view.questions.length}
        </span>
        {view.phase === 'answer' && (
          <span>
            {done} von {view.seats} fertig
          </span>
        )}
        <button type="button" className="bub-round-tafel" onClick={() => setShowWall(true)}>
          📺 Tafel
        </button>
      </div>
      {view.phase === 'answer' && view.answerMs !== null && (
        <div className="bub-round-time" aria-hidden="true">
          {/* Neu einhängen je Runde, sonst läuft die Animation nicht von vorn. */}
          <span key={view.round} style={{ animationDuration: `${view.answerMs}ms` }} />
        </div>
      )}
      <div className="bub-round-main">{children}</div>
      {canNext && (
        <button type="button" className="bub-round-next" onClick={onNext}>
          Weiter ▸
        </button>
      )}
      <RoundStandings view={view} seatNames={seatNames} me={me} limit={me === null ? 8 : 3} />
      {showWall && (
        <RoundWall title={title} link={invite?.link} onClose={() => setShowWall(false)}>
          {wall}
          <RoundStandings view={view} seatNames={seatNames} me={null} limit={8} />
        </RoundWall>
      )}
    </div>
  );
}
