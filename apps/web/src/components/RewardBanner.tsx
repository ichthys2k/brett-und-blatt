import { useEffect, useState } from 'react';
import { checkNotice, type RewardNotice } from '../lib/rewards';
import { useRoute } from '../lib/router';
import { Button } from './controls';

/**
 * Einmaliger Sammelhinweis beim ersten Start nach der Einführung der Stufen (#574): Wer schon viele Partien hat, steigt
 * rückwirkend auf und sieht **einen** Hinweis statt einer Meldung je übersprungener Stufe. Danach gilt die Stufe als gesehen.
 * Erscheint nur auf Menü, Spielauswahl und Pass, nie mitten in einer Partie; Gäste und „Belohnungen nicht anzeigen“ bekommen nichts.
 */
export function RewardBanner() {
  const route = useRoute();
  const [notice, setNotice] = useState<RewardNotice | null>(null);
  // Nur einmal beim Start der App prüfen; erscheint der Hinweis, bleibt er, bis er geschlossen wird.
  useEffect(() => {
    // Im Entwicklungsmodus (StrictMode) läuft der Haken zweimal; der zweite Aufruf findet nichts mehr und darf den Hinweis nicht löschen.
    const found = checkNotice('start');
    if (found) setNotice(found);
  }, []);
  if (!notice || (route.name !== 'menu' && route.name !== 'home' && route.name !== 'pass')) return null;
  return (
    <div role="status" className="fixed inset-x-0 bottom-0 z-[60] flex items-center justify-center gap-3 border-t border-line bg-surface px-3 py-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] shadow-lg">
      <span className="text-sm">{notice.text}</span>
      <Button variant="ghost" className="min-h-9 px-3 text-sm" onClick={() => setNotice(null)}>
        Schließen
      </Button>
    </div>
  );
}
