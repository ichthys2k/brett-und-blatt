import type { ReactNode } from 'react';
import { ConsoleFrame } from './ConsoleFrame';
import type { ConsoleTab } from './consoleTabs';

/**
 * Klassische Seite im Rahmen der Konsole (#607, K9): Reiter oben und Tastenleiste unten, Inhalt unverändert.
 * So führen LB/RB und B jederzeit zurück in die Konsole.
 */
export function ClassicInFrame({ tab, children }: { tab: ConsoleTab | null; children: ReactNode }) {
  return (
    <ConsoleFrame tab={tab}>
      <div className="kns-classic">{children}</div>
    </ConsoleFrame>
  );
}
