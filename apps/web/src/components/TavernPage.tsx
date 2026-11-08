import type { ReactNode } from 'react';
import { TavernScene } from './TavernScene';
import { navigate, paths } from '../lib/router';
import '../screens/menu.css';

/**
 * Seite im Taverne-Rahmen (#184): die ruhige Szene des Hauptmenüs dahinter, davor ein Holzrahmen
 * mit dunklen Farben, in dem die vorhandenen Bausteine (Listen, Formulare) unverändert lesbar bleiben.
 */
export function TavernPage({ title, subtitle, children, back = paths.menu, wide = false }: { title: string; subtitle?: string; children: ReactNode; back?: string; wide?: boolean }) {
  return (
    <div className="bub-tav">
      <TavernScene calm />
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
