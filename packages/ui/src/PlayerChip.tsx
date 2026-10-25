import type { ClockReading } from '@brett-und-blatt/engine';
import type { ReactNode } from 'react';

/** Ring um das Spielerzeichen, der mit der Zeit abläuft. */
export function ClockRing({ clock, children }: { clock: ClockReading | null; children: ReactNode }) {
  const radius = 21;
  const circumference = 2 * Math.PI * radius;
  const fraction = clock && clock.kind !== 'none' ? Math.max(0, Math.min(1, clock.fraction)) : 1;
  const tone = !clock || clock.kind === 'none' || !clock.running ? 'idle' : clock.usingBank || fraction < 0.15 ? 'danger' : fraction < 0.35 ? 'warning' : 'ok';
  return (
    <span className="bub-ring" data-tone={tone}>
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r={radius} className="bub-ring-track" />
        {clock && clock.kind !== 'none' && (
          <circle
            cx="24"
            cy="24"
            r={radius}
            className="bub-ring-bar"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - fraction)}
            transform="rotate(-90 24 24)"
          />
        )}
      </svg>
      <span className="bub-ring-content">{children}</span>
    </span>
  );
}

export interface PlayerChipProps {
  name: string;
  symbol: ReactNode;
  /** Kurzer Zusatz, z. B. „Computer · mittel“. */
  detail?: string;
  active: boolean;
  thinking?: boolean;
  away?: boolean;
  winner?: boolean;
  clock: ClockReading | null;
}

/** Ein Platz in der Spielerleiste: Zeichen mit Uhr-Ring, Name, Zustand. */
export function PlayerChip({ name, symbol, detail, active, thinking, away, winner, clock }: PlayerChipProps) {
  const time = clock && clock.kind !== 'none' && clock.running ? formatClock(clock) : null;
  return (
    <div className="bub-chip" data-active={active || undefined} data-winner={winner || undefined} aria-current={active ? 'true' : undefined}>
      <ClockRing clock={clock}>{symbol}</ClockRing>
      <span className="bub-chip-text">
        <span className="bub-chip-name">
          {winner ? '🏆 ' : ''}
          {name}
        </span>
        <span className="bub-chip-detail">{away ? 'abwesend – Computer spielt' : thinking ? 'denkt nach …' : (time ?? detail ?? '')}</span>
      </span>
    </div>
  );
}

/** Restzeit als Text: Sekunden bei Zugzeit, Minuten und Sekunden bei der Schachuhr. */
export function formatClock(clock: ClockReading): string {
  if (clock.kind === 'perMove') {
    if (clock.usingBank && clock.bankLeftMs !== null) return `Reserve ${Math.ceil(clock.bankLeftMs / 1000)} s`;
    return `${Math.ceil((clock.leftMs ?? 0) / 1000)} s`;
  }
  const total = Math.ceil((clock.leftMs ?? 0) / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
