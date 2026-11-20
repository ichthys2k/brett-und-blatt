import { useSyncExternalStore, type ReactNode } from 'react';
import { TavernScene } from './TavernScene';
import { useActiveLook } from '../lib/look';
import { navigate, paths } from '../lib/router';
import '../screens/menu.css';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function subscribeScheme(listener: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}

/** Ob das Gerät das dunkle Farbschema wünscht. */
const useSystemDark = (): boolean =>
  useSyncExternalStore(
    subscribeScheme,
    () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(DARK_QUERY).matches,
    () => false,
  );

/**
 * Seite im Taverne-Rahmen (#184): die ruhige Szene des Hauptmenüs dahinter, davor ein Holzrahmen
 * mit dunklen Farben, in dem die vorhandenen Bausteine (Listen, Formulare) unverändert lesbar bleiben.
 * Mit `adaptive` (Pass, #565) folgt die Seite dem Aussehen und dem Farbschema: Nur „Taverne“ in dunkel behält
 * Szene und Holzrahmen; sonst (hell, „Schlicht“) trägt sie die Farben der Oberfläche ohne Szene.
 */
export function TavernPage({ title, subtitle, children, back = paths.menu, wide = false, adaptive = false }: { title: string; subtitle?: string; children: ReactNode; back?: string; wide?: boolean; adaptive?: boolean }) {
  const look = useActiveLook();
  const dark = useSystemDark();
  const bright = adaptive && !(look === 'tavern' && dark);
  return (
    <div className="bub-tav" data-bright={bright || undefined}>
      {bright ? null : <TavernScene calm />}
      <div className="bub-tav-inner" data-wide={wide || undefined}>
        <header className="bub-tav-head">
          <button type="button" className="bub-tav-back" onClick={() => navigate(back)}>
            ‹ Zurück
          </button>
          <h1 className="bub-menu-logo">
            {title}
            {subtitle ? <small>{subtitle}</small> : null}
          </h1>
        </header>
        <div className="bub-tav-frame">{children}</div>
      </div>
    </div>
  );
}
