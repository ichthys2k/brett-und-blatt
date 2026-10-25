import type { CSSProperties, ReactNode } from 'react';

/**
 * Passt einen Inhalt mit festem Seitenverhältnis (Breite / Höhe) in den
 * verfügbaren Platz ein – auf dem Handy hochkant genauso wie am Desktop.
 */
export function FitBox({ ratio, children, className = '' }: { ratio: number; children: ReactNode; className?: string }) {
  return (
    <div className="bub-fit">
      <div className={`bub-fit-inner ${className}`} style={{ '--bub-ratio': ratio } as CSSProperties}>
        {children}
      </div>
    </div>
  );
}
