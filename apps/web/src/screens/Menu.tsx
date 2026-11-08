import { TavernScene } from '../components/TavernScene';
import { navigate, paths } from '../lib/router';
import { storage } from '../lib/storage';
import './menu.css';

/**
 * Hauptmenü (#184, Schritt 1): eine Taverne (Bild, #191) als Hintergrund und ein Rahmen mit fünf Einträgen,
 * wie das Menü von Warcraft III. Die Szene (`TavernScene`) ist reiner Schmuck.
 */
const ENTRIES: readonly { id: string; label: string; hint: string; to: string }[] = [
  { id: 'single', label: 'Einzelspieler', hint: 'Allein gegen den Computer oder zu mehreren an einem Gerät.', to: paths.home },
  { id: 'multi', label: 'Mehrspieler', hint: 'Offene Spiele, Spiel eröffnen, mit Code beitreten.', to: paths.online },
  { id: 'tournaments', label: 'Turniere', hint: 'Turniere finden, anlegen und verfolgen.', to: paths.tournaments },
  { id: 'profile', label: 'Profil', hint: 'Name, Wappen, Spielerpass und Sicherung.', to: paths.pass },
  { id: 'options', label: 'Optionen', hint: 'Ton, Musik, Aussehen und Updates.', to: paths.sound },
];

export function Menu() {
  const profile = storage.loadProfile();
  const resume = storage.loadActive();

  return (
    <div className="bub-menu">
      <TavernScene />

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
