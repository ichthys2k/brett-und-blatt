import { PlayerCrest } from '@brett-und-blatt/ui';
import { useEffect, useState } from 'react';
import { TavernScene } from '../components/TavernScene';
import { fetchBoardCount } from '../lib/board';
import { useBoardHidden } from '../lib/boardPrefs';
import { useCrest } from '../lib/crestStore';
import { findGame } from '../lib/registry';
import { useMenu3d } from '../lib/look';
import { navigate, paths } from '../lib/router';
import { GAME_SERVER } from '../lib/server';
import { storage } from '../lib/storage';
import { setHoveredStation, type TavernStationId } from '../lib/tavern3d';
import './menu.css';

/**
 * Hauptmenü (#184, #262): begehbare 3D-Taverne als Hintergrund und ein räumlich geneigter
 * Holzrahmen mit vier Einträgen wie in Warcraft III. Überfahren/Fokussieren hebt die Station im Raum hervor.
 */
interface MenuEntry {
  id: string;
  station: Exclude<TavernStationId, 'home'>;
  label: string;
  hint: string;
  to: string;
}

const ENTRIES: readonly MenuEntry[] = [
  { id: 'single', station: 'single', label: 'Lokales Spiel', hint: 'Allein gegen den Computer oder zu mehreren an einem Gerät.', to: paths.home },
  { id: 'online', station: 'online', label: 'Online Spiel', hint: 'Offene Spiele, Spiel eröffnen, mit Code beitreten.', to: paths.online },
  { id: 'tournaments', station: 'tournaments', label: 'Turniere', hint: 'Turniere finden, anlegen und verfolgen.', to: paths.tournaments },
  { id: 'learn', station: 'learn', label: 'Lernen', hint: 'Karteikasten: Karten aus deinen Notizen und Anki-Paketen wiederholen.', to: paths.learn },
  { id: 'options', station: 'options', label: 'Optionen', hint: 'Ton, Musik, Aussehen und Updates.', to: paths.sound },
];

export function Menu() {
  const crest = useCrest();
  const animated = useMenu3d();
  const [hint, setHint] = useState('');
  const profile = storage.loadProfile();
  const resume = storage.loadActive();
  const resumeGame = resume ? findGame(resume.config.gameId) : undefined;
  const [boardCount, setBoardCount] = useState<number | null>(null);
  const boardHidden = useBoardHidden();

  useEffect(() => () => setHoveredStation(null), []);

  // Wie viele Zettel hängen am Schwarzen Brett? Nur eine kleine Zahl, ohne Verbindung zum Brett.
  useEffect(() => {
    if (boardHidden) return;
    let cancelled = false;
    fetchBoardCount().then((count) => !cancelled && setBoardCount(count));
    return () => {
      cancelled = true;
    };
  }, [boardHidden]);

  const activate = (station: Exclude<TavernStationId, 'home'>, text: string) => {
    setHoveredStation(station);
    setHint(text);
  };

  const deactivate = () => {
    setHoveredStation(null);
    setHint('');
  };

  return (
    <div className="bub-menu">
      <TavernScene still={!animated} />

      <h1 className="bub-menu-logo">
        Brett &amp; Blatt
        <small>Karten- und Brettspiele für alle</small>
      </h1>

      <nav className="bub-menu-frame" aria-label="Hauptmenü">
        {resume ? (
          <button
            type="button"
            className="bub-menu-button"
            data-resume
            onClick={() => navigate(paths.play)}
            onMouseEnter={() => activate('single', 'Laufende lokale Partie fortsetzen.')}
            onFocus={() => activate('single', 'Laufende lokale Partie fortsetzen.')}
            onMouseLeave={deactivate}
            onBlur={deactivate}
            aria-label={resumeGame ? `Weiterspielen: ${resumeGame.name}` : 'Weiterspielen'}
          >
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
            onMouseEnter={() => activate(entry.station, entry.hint)}
            onFocus={() => activate(entry.station, entry.hint)}
            onMouseLeave={deactivate}
            onBlur={deactivate}
          >
            {entry.label}
          </button>
        ))}
        <p className="bub-menu-desc" aria-live="polite">
          {hint}
        </p>
      </nav>

      {GAME_SERVER && !boardHidden && (
        <button
          type="button"
          className="bub-menu-board"
          aria-label={`Schwarzes Brett${boardCount !== null ? `, ${boardCount} ${boardCount === 1 ? 'Zettel' : 'Zettel'}` : ''}`}
          onClick={() => navigate(paths.board)}
          onMouseEnter={() => activate('board', 'Mitspieler finden: Zettel anheften und „Bin dabei“ sagen – ohne Chat.')}
          onFocus={() => activate('board', 'Mitspieler finden: Zettel anheften und „Bin dabei“ sagen – ohne Chat.')}
          onMouseLeave={deactivate}
          onBlur={deactivate}
        >
          <span aria-hidden="true">📌</span>
          <span className="bub-menu-board-text">
            <span className="bub-menu-board-title">Schwarzes Brett</span>
            <span className="bub-menu-board-sub">Wer hat Lust? {boardCount !== null && boardCount > 0 ? `${boardCount} ${boardCount === 1 ? 'Zettel' : 'Zettel'}` : 'Hänge einen Zettel auf'}</span>
          </span>
        </button>
      )}

      <button
        type="button"
        className="bub-menu-plaque bub-menu-plaque-link"
        aria-label={profile ? `Profil von ${profile.name} öffnen` : 'Profil anlegen'}
        title="Name, Wappen, Spielerpass und Sicherung"
        onClick={() => navigate(paths.pass)}
        onMouseEnter={() => activate('profile', 'Name, Wappen, Spielerpass und Sicherung.')}
        onFocus={() => activate('profile', 'Name, Wappen, Spielerpass und Sicherung.')}
        onMouseLeave={deactivate}
        onBlur={deactivate}
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
