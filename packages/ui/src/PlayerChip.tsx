import type { ClockReading } from '@brett-und-blatt/engine';
import type { ReactNode } from 'react';
import { avatarImageOf, renderAvatar } from './avatarRenderer';
import { clockTone } from './clockTone';
import { PlayerShield } from './PlayerShield';
import { useInspectProps } from './inspect/CardInspect';

/** Ring um das Spielerzeichen, der mit der Zeit abläuft. */
export function ClockRing({ clock, children }: { clock: ClockReading | null; children: ReactNode }) {
  const radius = 21;
  const circumference = 2 * Math.PI * radius;
  const fraction = clock && clock.kind !== 'none' ? Math.max(0, Math.min(1, clock.fraction)) : 1;
  const tone = clockTone(clock);
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
  /** Ausgewähltes Emoji des Spielers (Avatar), erscheint vor dem Namen. */
  avatar?: string;
  /** Kurzer Zusatz, z. B. „Computer · mittel“. */
  detail?: string;
  active: boolean;
  thinking?: boolean;
  away?: boolean;
  winner?: boolean;
  clock: ClockReading | null;
  /** Punktestand – steht als eigenes Abzeichen rechts und wird nie abgeschnitten. */
  score?: number | string | null;
  /** `card`: großer Platz mit Porträt im Wappenschild statt Ring und Symbol (#491); Vorgabe `compact`. */
  size?: 'compact' | 'card';
  /** Wappen als Beschreibung (wie `MemberInfo.crest`); nur bei `size="card"`. */
  crest?: string;
  /** Breite des Schilds in px bei `size="card"` (Vorgabe 72). */
  shieldSize?: number;
}

/** Ein Platz in der Spielerleiste: Zeichen mit Uhr-Ring, Name, Zustand. */
export function PlayerChip({ name, symbol, avatar, detail, active, thinking, away, winner, clock, score, size = 'compact', crest, shieldSize = 72 }: PlayerChipProps) {
  const time = clock && clock.kind !== 'none' && clock.running ? formatClock(clock) : null;
  // Großansicht des gemalten Avatars (#422): beim Überfahren, Rechtsklick oder langem Drücken.
  const image = avatar ? avatarImageOf(avatar) : undefined;
  const inspect = useInspectProps(image ? () => ({ title: name, subtitle: detail, image: { src: image, aspect: 1, round: true }, emoji: avatar }) : undefined);
  const card = size === 'card';
  const detailText = away ? 'abwesend – Computer spielt' : thinking ? 'denkt nach …' : (time ?? detail ?? '');
  return (
    <div className="bub-chip" data-size={card ? 'card' : undefined} data-active={active || undefined} data-winner={winner || undefined} aria-current={active ? 'true' : undefined} {...inspect}>
      {card ? <PlayerShield avatar={avatar ?? ''} crest={crest} size={shieldSize} clock={clock} symbol={symbol} label={`Wappen von ${name}`} /> : <ClockRing clock={clock}>{symbol}</ClockRing>}
      <span className="bub-chip-text">
        <span className="bub-chip-name">
          {winner ? '🏆 ' : ''}
          {!card && avatar ? <span aria-hidden="true">{renderAvatar(avatar)} </span> : null}
          {name}
        </span>
        <span className="bub-chip-detail">{detailText}</span>
      </span>
      {score !== undefined && score !== null && (
        <span className="bub-chip-score" aria-label={`${score} Punkte`} title={`${score} Punkte`}>
          {score}
        </span>
      )}
    </div>
  );
}

/** Restzeit als Text: Sekunden bei Zugzeit, Minuten und Sekunden bei der Schachuhr. */
export function formatClock(clock: ClockReading): string {
  if (clock.kind === 'perMove') {
    if (clock.usingBank && clock.bankLeftMs !== null) return `Reserve ${Math.ceil(clock.bankLeftMs / 1000)} s`;
    return `${Math.ceil((clock.leftMs ?? 0) / 1000)} s`;
  }
  if (clock.kind === 'byoyomi' && clock.usingBank) return `${Math.ceil((clock.leftMs ?? 0) / 1000)} s · ${clock.periodsLeft ?? 0}×`;
  const total = Math.ceil((clock.leftMs ?? 0) / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
