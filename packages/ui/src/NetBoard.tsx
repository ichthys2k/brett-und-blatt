import type { ReactNode } from 'react';

export interface NetBoardProps {
  /** Lage der Punkte im Bereich 0–1 (x nach rechts, y nach unten). */
  points: readonly { x: number; y: number }[];
  /** Verbindungslinien zwischen Punkten (Indizes). */
  lines: readonly (readonly [number, number])[];
  label: string;
  renderPoint: (index: number) => ReactNode;
  isActive?: (index: number) => boolean;
  onActivate?: (index: number) => void;
  pointLabel?: (index: number) => string;
  pointClassName?: (index: number) => string;
  className?: string;
}

/**
 * Ein Brett aus Feldern (Punkten) und Verbindungen – für Mühle und später für
 * Laufspiele wie Mensch ärgere dich nicht oder Sternhalma. Die Regeln kennen nur
 * die Nummern der Punkte; wo sie liegen, steht in den Brettdaten.
 */
export function NetBoard({ points, lines, label, renderPoint, isActive, onActivate, pointLabel, pointClassName, className = '' }: NetBoardProps) {
  return (
    <div className={`bub-net ${className}`} role="group" aria-label={label}>
      <svg viewBox="0 0 100 100" className="bub-net-lines" aria-hidden="true">
        {lines.map(([a, b]) => {
          const from = points[a];
          const to = points[b];
          if (!from || !to) return null;
          return <line key={`${a}-${b}`} x1={from.x * 100} y1={from.y * 100} x2={to.x * 100} y2={to.y * 100} />;
        })}
      </svg>
      {points.map((point, index) => {
        const active = isActive?.(index) ?? false;
        return (
          <button
            key={index}
            type="button"
            disabled={!active}
            className={`bub-net-point ${pointClassName?.(index) ?? ''}`}
            style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
            aria-label={pointLabel?.(index)}
            onClick={active ? () => onActivate?.(index) : undefined}
          >
            {renderPoint(index)}
          </button>
        );
      })}
    </div>
  );
}
