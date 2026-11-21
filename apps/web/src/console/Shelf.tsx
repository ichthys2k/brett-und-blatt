import type { ReactNode } from 'react';

/** Regal der Konsole (#607, K3b): Überschrift und eine waagrecht rollende Reihe von Kacheln (`<li>`-Kinder). */
export function Shelf({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="kns-shelf">
      <h2 className="kns-shelf-head">{title}</h2>
      {subtitle && <p className="kns-shelf-sub">{subtitle}</p>}
      <ul className="kns-shelf-row">{children}</ul>
    </section>
  );
}
