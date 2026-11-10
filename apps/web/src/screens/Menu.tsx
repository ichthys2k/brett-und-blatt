import { PlayerCrest } from '@brett-und-blatt/ui';
import { useState } from 'react';
import { TavernScene } from '../components/TavernScene';
import { useCrest } from '../lib/crestStore';
import { findGame } from '../lib/registry';
import { navigate, paths } from '../lib/router';
import { storage } from '../lib/storage';
import './menu.css';

/**
 * Hauptmenü (#184, Schritt 1): eine Taverne (Bild, #191) als Hintergrund und ein Rahmen mit vier Einträgen,
 * wie das Menü von Warcraft III. Die Szene (`TavernScene`) ist reiner Schmuck.
 */
const ENTRIES: readonly { id: string; label: string; hint: string; to: string }[] = [
  { id: 'single', label: 'Lokales Spiel', hint: 'Allein gegen den Computer oder zu mehreren an einem Gerät.', to: paths.home },
  { id: 'multi', label: 'Online Spiel', hint: 'Offene Spiele, Spiel eröffnen, mit Code beitreten.', to: paths.online },
  { id: 'tournaments', label: 'Turniere', hint: 'Turniere finden, anlegen und verfolgen.', to: paths.tournaments },
  { id: 'learn', label: 'Lernen', hint: 'Karteikasten: Karten aus deinen Notizen und Anki-Paketen wiederholen.', to: paths.learn },
  { id: 'options', label: 'Optionen', hint: 'Ton, Musik, Aussehen und Updates.', to: paths.sound },
];

export function Menu() {
  const crest = useCrest();
  const [hint, setHint] = useState('');
  const profile = storage.loadProfile();
  const resume = storage.loadActive();
  const resumeGame = resume ? findGame(resume.config.gameId) : undefined;

  return (
    <div className="bub-menu">
      <TavernScene />

      <h1 className="bub-menu-logo">
        Brett &amp; Blatt
        <small>Karten- und Brettspiele für alle</small>
      </h1>

      <nav className="bub-menu-frame" aria-label="Hauptmenü">
        {resume ? (
          <button type="button" className="bub-menu-button" data-resume onClick={() => navigate(paths.play)} aria-label={resumeGame ? `Weiterspielen: ${resumeGame.name}` : 'Weiterspielen'}>
            Weiterspielen
            {resumeGame && (
              <span className="bub-menu-sub">
                <span aria-hidden="true">{resumeGame.emoji} </span>
                {resumeGame.name}
              </span>
            )}
          </button>
        ) : null}
        {ENTRIES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className="bub-menu-button"
            onClick={() => navigate(entry.to)}
            onMouseEnter={() => setHint(entry.hint)}
            onFocus={() => setHint(entry.hint)}
            onMouseLeave={() => setHint('')}
            onBlur={() => setHint('')}
          >
            {entry.label}
          </button>
        ))}
        <p className="bub-menu-desc" aria-live="polite">
          {hint}
        </p>
      </nav>

      <button
        type="button"
        className="bub-menu-plaque bub-menu-plaque-link"
        aria-label={profile ? `Profil von ${profile.name} öffnen` : 'Profil anlegen'}
        title="Name, Wappen, Spielerpass und Sicherung"
        onClick={() => navigate(paths.pass)}
      >
        <span className="bub-menu-shield" aria-hidden="true">
          <PlayerCrest spec={crest} size={40} />
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
