import type { Result, SeatId } from '@brett-und-blatt/engine';
import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { t } from '../i18n';

/** Ein Platz auf dem Siegertreppchen bzw. in der Rangliste. */
export interface CeremonySeat {
  seat: SeatId;
  name: string;
  avatar: string | null;
  symbol: ReactNode;
  score: number | string | null;
  /** Der Mensch an diesem Gerät (bzw. online: man selbst). */
  you: boolean;
}

interface CeremonyProps {
  result: Result;
  title: string;
  reason: string | null;
  seats: CeremonySeat[];
  /** Knöpfe wie Revanche oder Menü – dieselben wie unter dem Spielfeld. */
  actions: ReactNode;
  onClose(): void;
}

/**
 * Rangfolge für das Treppchen: Sieger zuerst (teilen sich Platz 1), dahinter die übrigen nach
 * Punkten – in der Richtung, in der die Sieger vorn liegen (Tiefflug: wenig ist gut). Ohne
 * vergleichbare Punkte bleiben die übrigen ohne Platz.
 */
export function rankSeats(result: Result, seats: CeremonySeat[]): { place: number | null; seat: CeremonySeat }[] {
  const winners = result.kind === 'win' ? new Set(result.winners) : new Set<SeatId>();
  const top = seats.filter((s) => winners.has(s.seat));
  const rest = seats.filter((s) => !winners.has(s.seat));
  const numeric = seats.every((s) => typeof s.score === 'number');
  let direction = 0;
  if (numeric && top.length > 0 && rest.length > 0) {
    const best = top.map((s) => s.score as number);
    const others = rest.map((s) => s.score as number);
    if (Math.min(...best) >= Math.max(...others)) direction = -1;
    else if (Math.max(...best) <= Math.min(...others)) direction = 1;
  }
  const ranked: { place: number | null; seat: CeremonySeat }[] = top.map((seat) => ({ place: 1, seat }));
  if (direction === 0) return [...ranked, ...rest.map((seat) => ({ place: null, seat }))];
  const sorted = [...rest].sort((a, b) => direction * ((a.score as number) - (b.score as number)));
  let place = top.length + 1;
  sorted.forEach((seat, i) => {
    const prev = sorted[i - 1];
    if (i > 0 && prev && prev.score !== seat.score) place = top.length + 1 + i;
    ranked.push({ place, seat });
  });
  return ranked;
}

/** Bunte Konfetti-Schnipsel; Lage und Tempo kommen fest aus der Nummer, damit nichts flackert. */
const CONFETTI = Array.from({ length: 36 }, (_, i) => {
  const r = (n: number) => ((i * 9301 + n * 49297) % 233280) / 233280;
  return {
    left: `${Math.round(r(1) * 100)}%`,
    delay: `${(0.6 + r(2) * 1.2).toFixed(2)}s`,
    duration: `${(2.2 + r(3) * 1.6).toFixed(2)}s`,
    drift: `${Math.round((r(4) - 0.5) * 160)}px`,
    spin: `${Math.round(360 + r(5) * 720)}deg`,
    color: ['#f59f00', '#e8590c', '#1c7ed6', '#2f9e44', '#d6336c', '#7048e8', '#ffd43b'][i % 7],
    round: i % 3 === 0,
  };
});

/**
 * Große Siegerehrung über den ganzen Bildschirm am Ende einer Partie (W-008): Pokal, Titel,
 * Treppchen mit den besten drei und Konfetti. Erscheint kurz nach dem letzten Zug, damit dessen
 * Animation noch zu sehen ist, und lässt sich schließen, um das Spielfeld anzusehen.
 */
export function Ceremony({ result, title, reason, seats, actions, onClose }: CeremonyProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const ranked = rankSeats(result, seats);
  const solo = seats.length === 1;
  const youWon = result.kind === 'win' && seats.some((s) => s.you && result.winners.includes(s.seat));
  const festive = result.kind === 'win' && (youWon || !seats.some((s) => s.you) || seats.filter((s) => s.you).length > 1 || solo);
  const emoji = result.kind === 'draw' ? '🤝' : result.kind === 'loss' ? '🌧️' : solo ? '🎉' : '🏆';
  // Treppchen: höchstens drei Stufen in der Reihenfolge 2 – 1 – 3, Gleichstände nebeneinander auf der Stufe.
  const podium = solo ? [] : [2, 1, 3].map((place) => ({ place, seats: ranked.filter((r) => r.place === place).map((r) => r.seat) })).filter((step) => step.seats.length > 0);
  const onPodium = new Set(podium.flatMap((step) => step.seats.map((s) => s.seat)));
  const others = solo ? [] : ranked.filter((r) => !onPodium.has(r.seat.seat));

  return (
    <div className="bub-ceremony" role="dialog" aria-modal="true" aria-labelledby="bub-ceremony-title" data-kind={result.kind} data-festive={festive || undefined}>
      <button type="button" className="bub-ceremony-backdrop" aria-label={t('ceremony.close')} onClick={onClose} />
      {festive && (
        <div className="bub-ceremony-confetti" aria-hidden="true">
          {CONFETTI.map((c, i) => (
            <span
              key={i}
              data-round={c.round || undefined}
              style={{ left: c.left, background: c.color, animationDelay: c.delay, animationDuration: c.duration, '--drift': c.drift, '--spin': c.spin } as CSSProperties}
            />
          ))}
        </div>
      )}
      <div className="bub-ceremony-card">
        <button type="button" className="bub-ceremony-x" aria-label={t('ceremony.close')} onClick={onClose}>
          ✕
        </button>
        <div className="bub-ceremony-trophy" aria-hidden="true">
          <span className="bub-ceremony-rays" />
          <span className="bub-ceremony-emoji">{emoji}</span>
        </div>
        <h2 id="bub-ceremony-title" className="bub-ceremony-title">
          {title}
        </h2>
        {reason && <p className="bub-ceremony-reason">{reason}</p>}

        {podium.length > 0 && (
          <ol className="bub-podium" aria-label={t('ceremony.podium')}>
            {podium.map((step) => (
              <li key={step.place} className="bub-podium-step" data-place={step.place}>
                <div className="bub-podium-people">
                  {step.seats.map((s) => (
                    <div key={s.seat} className="bub-podium-person" data-you={s.you || undefined}>
                      <span className="bub-podium-avatar">{s.avatar ?? <span className="bub-ceremony-symbol">{s.symbol}</span>}</span>
                      <span className="bub-podium-name">{s.name}</span>
                      {s.score !== null && <span className="bub-podium-score">{s.score}</span>}
                    </div>
                  ))}
                </div>
                <div className="bub-podium-block">
                  <span>{step.place === 1 ? '🥇' : step.place === 2 ? '🥈' : '🥉'}</span>
                </div>
              </li>
            ))}
          </ol>
        )}

        {others.length > 0 && (
          <ul className="bub-ceremony-rest">
            {others.slice(0, 7).map(({ place, seat }) => (
              <li key={seat.seat} data-you={seat.you || undefined}>
                <span className="bub-ceremony-place">{place !== null ? `${place}.` : ''}</span>
                <span className="bub-ceremony-symbol">{seat.avatar ?? seat.symbol}</span>
                <span className="truncate">{seat.name}</span>
                {seat.score !== null && <span className="bub-ceremony-points">{seat.score}</span>}
              </li>
            ))}
            {others.length > 7 && <li className="bub-ceremony-more">{t('ceremony.more', { count: String(others.length - 7) })}</li>}
          </ul>
        )}

        <div className="bub-ceremony-actions">
          {actions}
          <button type="button" className="bub-ceremony-look" onClick={onClose}>
            {t('ceremony.look')}
          </button>
        </div>
      </div>
    </div>
  );
}
