import { useEffect, useRef } from 'react';
import { navigate, paths } from '../lib/router';
import { storage } from '../lib/storage';
import './menu.css';

/**
 * Hauptmenü (#184, Schritt 1): eine Taverne als Hintergrund und ein Rahmen mit fünf Einträgen,
 * wie das Menü von Warcraft III. Die Szene ist reiner Schmuck (aria-hidden); sie folgt der Maus
 * nur leicht und steht bei „Bewegung reduzieren“ still.
 */
const ENTRIES: readonly { id: string; label: string; hint: string; to: string }[] = [
  { id: 'single', label: 'Einzelspieler', hint: 'Allein gegen den Computer oder zu mehreren an einem Gerät.', to: paths.home },
  { id: 'multi', label: 'Mehrspieler', hint: 'Offene Spiele, Spiel eröffnen, mit Code beitreten.', to: paths.online },
  { id: 'tournaments', label: 'Turniere', hint: 'Turniere finden, anlegen und verfolgen.', to: paths.online },
  { id: 'profile', label: 'Profil', hint: 'Name, Wappen, Spielerpass und Sicherung.', to: paths.pass },
  { id: 'options', label: 'Optionen', hint: 'Ton, Musik, Aussehen und Updates.', to: paths.sound },
];

export function Menu() {
  const scene = useRef<HTMLDivElement>(null);
  const profile = storage.loadProfile();
  const resume = storage.loadActive();

  useEffect(() => {
    const el = scene.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const move = (event: PointerEvent) => {
      el.style.setProperty('--mx', String(event.clientX / window.innerWidth - 0.5));
      el.style.setProperty('--my', String(event.clientY / window.innerHeight - 0.5));
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, []);

  return (
    <div className="bub-menu">
      <div className="bub-menu-scene" ref={scene} aria-hidden="true">
        <div className="bub-menu-layer bub-menu-wall">
          <span className="bub-menu-window" />
          <span className="bub-menu-window" />
          <span className="bub-menu-window" />
        </div>
        <div className="bub-menu-layer bub-menu-glow" />
        <div className="bub-menu-layer bub-menu-table">
          <span className="bub-menu-card" />
          <span className="bub-menu-card" />
          <span className="bub-menu-card" />
          <span className="bub-menu-die" />
          <span className="bub-menu-die" />
        </div>
        <div className="bub-menu-shade" />
      </div>

      <h1 className="bub-menu-logo">
        Brett &amp; Blatt
        <small>Karten- und Brettspiele für alle</small>
      </h1>

      <nav className="bub-menu-frame" aria-label="Hauptmenü">
        {resume ? (
          <button type="button" className="bub-menu-button" data-resume onClick={() => navigate(paths.play)}>
            Weiterspielen
          </button>
        ) : null}
        {ENTRIES.map((entry) => (
          <button key={entry.id} type="button" className="bub-menu-button" onClick={() => navigate(entry.to)} title={entry.hint}>
            {entry.label}
            <span className="bub-menu-hint">{entry.hint}</span>
          </button>
        ))}
      </nav>

      <button type="button" className="bub-menu-plaque" onClick={() => navigate(paths.pass)} aria-label="Profil öffnen">
        <span className="bub-menu-shield" aria-hidden="true">
          {profile?.avatar ?? '🛡️'}
        </span>
        <span className="bub-menu-name">{profile?.name ?? 'Noch kein Name'}</span>
        <span className="bub-menu-switch">Profil</span>
      </button>

      <footer className="bub-menu-foot">
        <a href="#/impressum">Impressum</a> · <a href="#/datenschutz">Datenschutz</a>
      </footer>
    </div>
  );
}
