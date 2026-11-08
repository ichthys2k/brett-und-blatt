import type { ReactNode } from 'react';
import { navigate, paths } from '../lib/router';
import '../screens/menu.css';

/**
 * Seite im Taverne-Rahmen (#184): die ruhige Szene des Hauptmenüs dahinter, davor ein Holzrahmen
 * mit dunklen Farben, in dem die vorhandenen Bausteine (Listen, Formulare) unverändert lesbar bleiben.
 */
export function TavernPage({ title, subtitle, children, back = paths.menu, wide = false }: { title: string; subtitle?: string; children: ReactNode; back?: string; wide?: boolean }) {
  return (
    <div className="bub-tav">
      <div className="bub-menu-scene" aria-hidden="true">
        <div className="bub-menu-layer bub-menu-wall">
          <span className="bub-menu-window" />
          <span className="bub-menu-window" />
          <span className="bub-menu-window" />
        </div>
        <div className="bub-menu-layer bub-menu-beams">
          <span />
          <span />
          <span />
        </div>
        <div className="bub-menu-layer bub-menu-glow" />
        <div className="bub-menu-shade" style={{ background: 'linear-gradient(#140d0799, #140d07dd)' }} />
      </div>
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
