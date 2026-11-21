import type { GameInfo, SessionSnapshot } from '@brett-und-blatt/engine';
import { useRef, useState } from 'react';
import { t } from '../i18n';
import { discardGame } from '../lib/activeGame';
import { loadBookRecent } from '../lib/chronikStore';
import { controllerGrade } from '../lib/controllerGrade';
import { crestUrl } from '../lib/crest';
import { pickFavorites, useFavorites } from '../lib/favorites';
import { groupGames } from '../lib/gameCatalog';
import { useActiveLook } from '../lib/look';
import { findGame, games } from '../lib/registry';
import { navigate, paths } from '../lib/router';
import { storage } from '../lib/storage';
import { ConsoleFrame } from './ConsoleFrame';
import { GameTile, useTileScene } from './GameTile';
import { recentGameIds } from './recentGames';
import { Shelf } from './Shelf';
import { useFavoriteKey } from './useFavoriteKey';
import { useInitialFocus } from './useInitialFocus';

/** Verweise im Regal „Mehr“ auf die übrigen Bereiche der App. */
const MORE: readonly { id: string; emoji: string; to: string }[] = [
  { id: 'online', emoji: '🌐', to: paths.online },
  { id: 'board', emoji: '📌', to: paths.board },
  { id: 'tournaments', emoji: '🏆', to: paths.tournaments },
  { id: 'learn', emoji: '📚', to: paths.learn },
  { id: 'pass', emoji: '🪪', to: paths.pass },
  { id: 'helpers', emoji: '🎲', to: paths.helpers },
  { id: 'options', emoji: '⚙️', to: paths.sound },
];

type MessageKey = Parameters<typeof t>[0];

/** Breites Feld „Laufende Partie“ mit Weiterspielen und Verwerfen. */
function ResumePanel({ snapshot, info, onDiscard }: { snapshot: SessionSnapshot; info: GameInfo; onDiscard: () => void }) {
  const tavern = useActiveLook() === 'tavern';
  const scene = useTileScene(info.id);
  const crest = tavern ? crestUrl(info.id) : undefined;
  return (
    <section className="kns-resume" data-image={scene ? '' : undefined} style={scene ? { backgroundImage: `url("${scene}")` } : undefined} aria-label={t('home.resume')}>
      <span className="kns-resume-art" aria-hidden="true">
        {crest ? <img src={crest} alt="" decoding="async" /> : info.emoji}
      </span>
      <div className="kns-resume-text">
        <p className="kns-resume-kicker">{t('home.resume')}</p>
        <p className="kns-resume-name">{info.name}</p>
        <p className="kns-resume-seats">{snapshot.config.seats.map((seat) => seat.name).join(' gegen ')}</p>
      </div>
      <div className="kns-resume-actions">
        <button type="button" className="kns-button kns-button-primary" data-kns-autofocus data-kns-id="resume" onClick={() => navigate(paths.play)}>
          {t('home.resume.play')}
        </button>
        <button type="button" className="kns-button" data-kns-id="discard" onClick={onDiscard}>
          {t('home.resume.discard')}
        </button>
      </div>
    </section>
  );
}

/** Start-Bildschirm der Konsole (#607, K4): laufende Partie, Regale mit Spielen, Regal „Mehr“. */
export function ConsoleHome() {
  const ref = useRef<HTMLDivElement>(null);
  const tavern = useActiveLook() === 'tavern';
  const [snapshot, setSnapshot] = useState(() => storage.loadActive());
  const { favorites, toggle } = useFavorites();
  useFavoriteKey(favorites, toggle);
  const resumeInfo = snapshot ? findGame(snapshot.config.gameId) : undefined;
  // Bei laufender Partie liegt der Fokus zuerst auf „Weiterspielen“, sonst auf der zuletzt benutzten Kachel.
  useInitialFocus(ref, 'start', true, Boolean(snapshot && resumeInfo));

  const known = new Set(games.map((g) => g.id));
  const recent = recentGameIds(loadBookRecent(), known)
    .map((id) => games.find((g) => g.id === id))
    .filter((g): g is GameInfo => Boolean(g));
  const favoriteGames = pickFavorites(favorites, games);
  const groups = groupGames(games, null).filter((group) => group.games.length > 0);

  const tile = (shelf: string, info: GameInfo) => (
    <li key={`${shelf}:${info.id}`}>
      <GameTile info={info} href={paths.setup(info.id)} favorite={favorites.includes(info.id)} grade={controllerGrade(info.id)} restoreId={`${shelf}:${info.id}`} />
    </li>
  );

  const discard = () => {
    discardGame();
    setSnapshot(null);
    // Der Knopf verschwindet: Fokus auf die erste Kachel.
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>('.kns-tile')?.focus());
  };

  return (
    <ConsoleFrame
      tab="start"
      prompts={[
        { key: 'A', label: t('console.prompt.open') },
        { key: 'Y', label: t('console.prompt.favorite') },
        { key: 'LB/RB', label: t('console.prompt.tabs') },
      ]}
    >
      <div ref={ref}>
        {snapshot && resumeInfo && <ResumePanel snapshot={snapshot} info={resumeInfo} onDiscard={discard} />}
        {recent.length > 0 && <Shelf title={t('console.shelf.recent')}>{recent.map((info) => tile('recent', info))}</Shelf>}
        {favoriteGames.length > 0 && <Shelf title={t('console.shelf.favorites')}>{favoriteGames.map((info) => tile('favorites', info))}</Shelf>}
        {groups.map((group) => (
          <Shelf key={group.id} title={tavern ? group.room : group.title} subtitle={group.subtitle}>
            {group.games.map((info) => tile(group.id, info))}
          </Shelf>
        ))}
        <Shelf title={t('console.shelf.more')}>
          {MORE.map((entry) => (
            <li key={entry.id}>
              <a href={entry.to} className="kns-tile kns-linktile" data-kns-id={`more:${entry.id}`} aria-label={`${t(`console.more.${entry.id}` as MessageKey)}. ${t(`console.more.${entry.id}.hint` as MessageKey)}`}>
                <span className="kns-tile-art" aria-hidden="true">
                  {entry.emoji}
                </span>
                <span className="kns-tile-text" aria-hidden="true">
                  <span className="kns-tile-name">{t(`console.more.${entry.id}` as MessageKey)}</span>
                  <span className="kns-tile-meta kns-linktile-hint">{t(`console.more.${entry.id}.hint` as MessageKey)}</span>
                </span>
              </a>
            </li>
          ))}
        </Shelf>
      </div>
    </ConsoleFrame>
  );
}
