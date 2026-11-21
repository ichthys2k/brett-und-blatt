import type { GameInfo, SessionSnapshot } from '@brett-und-blatt/engine';
import { FocusZone } from '@brett-und-blatt/ui';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/controls';
import { t } from '../i18n';
import { discardGame } from '../lib/activeGame';
import { pickFavorites, useFavorites } from '../lib/favorites';
import { crestUrl } from '../lib/crest';
import { TavernPage } from '../components/TavernPage';
import { PassPicker } from '../components/PassPicker';
import { findGame, games } from '../lib/registry';
import { useActiveLook } from '../lib/look';
import { APP_VERSION } from '../lib/appUpdate';
import { navigate, paths } from '../lib/router';
import { storage } from '../lib/storage';

import { CATEGORIES, categoryOf, type CategoryId, type CategorySpec } from '../lib/rubriken';
import { PLAYER_COUNTS, fitsPlayers, groupGames, loadPlayerCount, parseFilter, savePlayerCount, searchGames, visibleGroups as pickVisibleGroups, type FilterId } from '../lib/gameCatalog';
import { mathPresetsFor } from '../lib/mathPresets';

export { CATEGORIES, categoryOf };
export type { CategoryId, CategorySpec };

/**
 * Eigenständige Spiele von Cornelius außerhalb der Sammlung. Sie laufen auf
 * eigenen Seiten und werden nur verlinkt (neuer Tab), nicht eingebettet:
 * keine Bots, kein Hot-Seat, keine Online-Räume.
 */
interface ExternalGameLink {
  id: string;
  emoji: string;
  title: string;
  description: string;
  badge: string;
  url: string;
}

const EXTERNAL_GAMES: readonly ExternalGameLink[] = [
  {
    id: 'emoji-clicker',
    emoji: '😀',
    title: 'Emoji-Clicker',
    description: 'Idle-Clicker: Emojis sammeln, Produzenten kaufen und verbessern, mit Prestige und Minispielen.',
    badge: 'Allein · eigene Seite',
    url: 'https://www.thecrazygerman.de/',
  },
];

const FILTER_TABS: readonly { id: FilterId; icon: string; label: string }[] = [
  { id: 'all', icon: '🎲', label: 'Alle' },
  { id: 'board', icon: '♟️', label: 'Strategie & Brett' },
  { id: 'cards', icon: '🃏', label: 'Karten & Stich' },
  { id: 'family', icon: '🎲', label: 'Familie & Gesellschaft' },
  { id: 'math', icon: '📐', label: 'Mathe (Kl. 5/6)' },
];

function playerCount(info: GameInfo): string {
  const { min, max } = info.players;
  return min === max ? t('home.playersFixed', { count: min }) : t('home.players', { min, max });
}

function ResumeCard({ snapshot, onDiscard }: { snapshot: SessionSnapshot; onDiscard: () => void }) {
  const info = findGame(snapshot.config.gameId);
  if (!info) return null;
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <span className="text-3xl" aria-hidden="true">
        {info.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted">{t('home.resume')}</p>
        <p className="truncate font-semibold">
          {info.name}: {snapshot.config.seats.map((seat) => (seat.avatar ? `${seat.avatar} ${seat.name}` : seat.name)).join(' gegen ')}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onDiscard}>
          {t('home.resume.discard')}
        </Button>
        <Button variant="primary" onClick={() => navigate(paths.play)}>
          {t('home.resume.play')}
        </Button>
      </div>
    </section>
  );
}

interface FavoriteProps {
  favorite: boolean;
  onToggleFavorite: (gameId: string) => void;
}

function GameCard({ info, favorite, onToggleFavorite }: { info: GameInfo } & FavoriteProps) {
  // Das gemalte Wappen gehört zur Taverne; „Schlicht“ zeigt weiter das Emoji.
  const crest = useActiveLook() === 'tavern' ? crestUrl(info.id) : undefined;
  return (
    <li className="relative">
      <a
        href={paths.setup(info.id)}
        className="bub-tile flex h-full items-start gap-4 rounded-2xl border border-line bg-surface p-4 pr-12 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-3 focus-visible:outline-accent"
      >
        <span className="bub-tile-crest text-4xl leading-none" data-image={crest ? '' : undefined} aria-hidden="true">
          {crest ? <img src={crest} alt="" loading="lazy" decoding="async" className="bub-tile-crest-image" /> : info.emoji}
        </span>
        <span className="min-w-0 space-y-1">
          <span className="block font-semibold">{info.name}</span>
          <span className="block text-sm text-muted">{info.description}</span>
          <span className="block text-xs text-muted">{playerCount(info)}</span>
        </span>
      </a>
      {/* Eigener Knopf neben dem Link (nicht darin), damit Tippen den Stern umschaltet statt das Spiel zu öffnen */}
      <button
        type="button"
        aria-pressed={favorite}
        aria-label={favorite ? `${info.name} von den Lieblingsspielen nehmen` : `${info.name} als Lieblingsspiel markieren`}
        title={favorite ? 'Von den Lieblingsspielen nehmen' : 'Als Lieblingsspiel oben anpinnen'}
        onClick={() => onToggleFavorite(info.id)}
        className={`bub-fav absolute top-2 right-2 grid size-9 cursor-pointer place-items-center rounded-full text-xl leading-none transition hover:bg-surface-2 focus-visible:outline-3 focus-visible:outline-accent ${
          favorite ? 'text-warning' : 'text-muted hover:text-warning'
        }`}
      >
        <span aria-hidden="true">{favorite ? '★' : '☆'}</span>
      </button>
    </li>
  );
}

export function Home({ initialFilter, initialPlayers }: { initialFilter?: string; initialPlayers?: number }) {
  const tavern = useActiveLook() === 'tavern';
  const [snapshot, setSnapshot] = useState(() => storage.loadActive());
  const { favorites, toggle: toggleFavorite } = useFavorites();
  const [searchQuery, setSearchQuery] = useState('');
  const [players, setPlayersState] = useState<number | null>(() => initialPlayers ?? loadPlayerCount());
  const setPlayers = (count: number | null) => {
    setPlayersState(count);
    savePlayerCount(count);
  };

  useEffect(() => {
    if (initialPlayers !== undefined) setPlayersState(initialPlayers);
  }, [initialPlayers]);
  const [activeFilter, setActiveFilter] = useState<FilterId>(() => parseFilter(initialFilter));

  useEffect(() => {
    const parsed = parseFilter(initialFilter);
    if (parsed !== 'all') setActiveFilter(parsed);
  }, [initialFilter]);

  const categorizedGames = useMemo(() => groupGames(games, players), [players]);

  const filteredGamesBySearch = useMemo(() => searchGames(games, searchQuery, players), [searchQuery, players]);

  const visibleGroups = useMemo(() => {
    if (filteredGamesBySearch !== null) {
      if (filteredGamesBySearch.length === 0) {
        return [];
      }
      return [
        {
          id: 'search' as CategoryId,
          icon: '🔍',
          title: 'Suchergebnisse',
          room: 'Suchergebnisse',
          subtitle: `${filteredGamesBySearch.length} ${filteredGamesBySearch.length === 1 ? 'Spiel' : 'Spiele'} gefunden`,
          gameIds: [],
          games: filteredGamesBySearch,
        },
      ];
    }
    return pickVisibleGroups(categorizedGames, activeFilter, players);
  }, [activeFilter, categorizedGames, filteredGamesBySearch, players]);
  // Lieblingsspiele stehen oben, gefiltert wie die Rubriken darunter (bei Suche nicht).
  const favoriteGames = useMemo(() => {
    if (filteredGamesBySearch !== null) return [];
    return pickFavorites(favorites, games).filter(
      (g) => fitsPlayers(g, players) && (activeFilter === 'all' || categoryOf(g.id) === activeFilter),
    );
  }, [favorites, filteredGamesBySearch, players, activeFilter]);
  const mathPresets = mathPresetsFor(games, players);

  return (
    <TavernPage title="Lokales Spiel" subtitle="Allein gegen den Computer oder zu mehreren an einem Gerät." wide>
    <div className="bub-home flex flex-col gap-6">
      <div className="flex justify-end">
        <PassPicker />
      </div>

      {snapshot && (
        <ResumeCard
          snapshot={snapshot}
          onDiscard={() => {
            discardGame();
            setSnapshot(null);
          }}
        />
      )}

      <FocusZone id="home-filters" order={1} label="Suche & Filter" className="space-y-4">
      {/* Suche */}
      <section className="space-y-2">
        <label htmlFor="game-search" className="sr-only">
          Spiele nach Stichwort suchen
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg" aria-hidden="true">
            🔍
          </span>
          <input
            id="game-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Spiele nach Name, Beschreibung oder Regeln suchen..."
            className="w-full rounded-2xl border border-line bg-surface py-2.5 pl-10 pr-4 text-sm shadow-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            aria-label="Spiele nach Stichwort suchen"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-xs text-muted hover:text-foreground"
              aria-label="Suche zurücksetzen"
            >
              ✕
            </button>
          )}
        </div>
      </section>

      {/* Rubrik-Filterleiste */}
      {!searchQuery.trim() && (
        <nav aria-label="Spielkategorien" className="flex flex-wrap gap-2">
          {FILTER_TABS.map((tab) => {
            const isSelected = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setActiveFilter(tab.id)}
                className={`bub-filter inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition cursor-pointer ${
                  isSelected
                    ? 'border-accent bg-accent text-accent-ink shadow-xs'
                    : 'border-line bg-surface text-ink hover:border-accent/50'
                }`}
              >
                <span aria-hidden="true">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Spielerzahl-Auswahl */}
      <nav aria-label="Spielerzahl" className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-sm font-semibold text-muted">
          <span aria-hidden="true">👥 </span>Wie viele spielt ihr?
        </span>
        {[null, ...PLAYER_COUNTS].map((count) => {
          const isSelected = players === count;
          return (
            <button
              key={count ?? 'all'}
              type="button"
              aria-pressed={isSelected}
              aria-label={count === null ? 'Beliebig viele Spieler' : count === 1 ? '1 Spieler' : `${count} Spieler`}
              onClick={() => setPlayers(count)}
              className={`bub-filter min-w-9 cursor-pointer rounded-full border px-2.5 py-1 text-sm font-semibold transition ${
                isSelected ? 'border-accent bg-accent text-accent-ink shadow-xs' : 'border-line bg-surface text-ink hover:border-accent/50'
              }`}
            >
              {count ?? 'egal'}
            </button>
          );
        })}
      </nav>
      </FocusZone>

      {/* Strukturierte Spieleliste nach Rubriken, Lieblingsspiele vorweg */}
      <FocusZone id="home-games" order={2} label="Spieleliste" className="space-y-8">
        {favoriteGames.length > 0 && (
          <section className="space-y-3" aria-labelledby="home-favorites">
            <div className="bub-home-room space-y-0.5">
              <h2 id="home-favorites" className="flex items-center gap-2 text-lg font-bold">
                <span aria-hidden="true">⭐</span>
                <span>Lieblingsspiele</span>
                <span className="text-xs font-normal text-muted">({favoriteGames.length})</span>
              </h2>
              <p className="text-xs text-muted">Mit dem Stern angepinnt – reisen mit deinem Pass.</p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {favoriteGames.map((info) => (
                <GameCard key={info.id} info={info} favorite onToggleFavorite={toggleFavorite} />
              ))}
            </ul>
          </section>
        )}
        {visibleGroups.length === 0 && !searchQuery.trim() && players !== null ? (
          <section className="rounded-2xl border border-line bg-surface p-6 text-center shadow-sm">
            <p className="text-lg font-semibold">Keine passenden Spiele</p>
            <p className="mt-1 text-sm text-muted">In dieser Rubrik gibt es kein Spiel für {players} Spieler.</p>
            <button
              type="button"
              onClick={() => setPlayers(null)}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-line px-4 py-1.5 text-sm font-semibold hover:border-accent/50"
            >
              Spielerzahl zurücksetzen
            </button>
          </section>
        ) : visibleGroups.length === 0 && searchQuery.trim() ? (
          <section className="rounded-2xl border border-line bg-surface p-6 text-center shadow-sm">
            <p className="text-lg font-semibold">Keine Spiele gefunden</p>
            <p className="mt-1 text-sm text-muted">
              Für „{searchQuery}“ wurden keine passenden Spiele gefunden. Versuche einen anderen Suchbegriff.
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-line px-4 py-1.5 text-sm font-semibold hover:border-accent/50"
            >
              Suche zurücksetzen
            </button>
          </section>
        ) : (
          visibleGroups.map((group) => (
            <section key={group.id} className="space-y-3">
              <div className="bub-home-room space-y-0.5">
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <span aria-hidden="true">{group.icon}</span>
                  <span>{tavern ? group.room : group.title}</span>
                  <span className="text-xs font-normal text-muted">({group.games.length})</span>
                </h2>
                <p className="text-xs text-muted">{tavern && group.room !== group.title ? `${group.title}: ${group.subtitle}` : group.subtitle}</p>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {group.games.map((info) => (
                  <GameCard
                    key={info.id}
                    info={info}
                    favorite={favorites.includes(info.id)}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
              </ul>

              {/* In der Mathe-Rubrik zusätzlich die vorgefertigten Mathe-Modi der Klassiker anzeigen */}
              {group.id === 'math' && !searchQuery.trim() && mathPresets.length > 0 && (
                <div className="pt-3 space-y-2.5">
                  <h3 className="text-sm font-semibold text-muted">
                    📐 Mathe-Modi in beliebten Klassikern (mit Voreinstellung starten):
                  </h3>
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {mathPresets.map((preset) => (
                      <li key={preset.id}>
                        <a
                          href={paths.setup(preset.gameId, preset.params)}
                          className="bub-tile flex h-full items-start gap-4 rounded-2xl border border-accent/35 bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-3 focus-visible:outline-accent"
                        >
                          <span className="bub-tile-crest text-4xl leading-none" aria-hidden="true">
                            {preset.emoji}
                          </span>
                          <span className="min-w-0 space-y-1">
                            <span className="block font-semibold">{preset.title}</span>
                            <span className="block text-sm text-muted">{preset.description}</span>
                            <span className="inline-block rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
                              {preset.badge}
                            </span>
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          ))
        )}
      </FocusZone>

      {/* Spielhelfer für echte Brettspiele (#106) */}
      {activeFilter === 'all' && !searchQuery.trim() && players === null && (
        <section className="space-y-3">
          <div className="space-y-0.5">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <span aria-hidden="true">🧰</span>
              <span>Tischwerkzeuge</span>
            </h2>
            <p className="text-xs text-muted">Nützliche Helfer für den analogen Spieleabend und den Unterricht.</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            <li>
              <a
                href={paths.helpers}
                className="bub-tile flex h-full items-start gap-4 rounded-2xl border border-accent/35 bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-3 focus-visible:outline-accent"
              >
                <span className="bub-tile-crest text-4xl leading-none" aria-hidden="true">
                  🎲
                </span>
                <span className="min-w-0 space-y-1">
                  <span className="block font-semibold">Spielhelfer</span>
                  <span className="block text-sm text-muted">
                    Würfel (W4–W20 &amp; eigene), Münze &amp; Zufall, Startspieler &amp; Teams, Sanduhr, Schachuhr und Punktezettel.
                  </span>
                  <span className="inline-block rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
                    5 Werkzeuge · offline
                  </span>
                </span>
              </a>
            </li>
          </ul>
        </section>
      )}

      {/* Weitere Spiele auf eigenen Seiten (nur verlinkt) */}
      {activeFilter === 'all' && !searchQuery.trim() && players === null && (
        <section className="space-y-3">
          <div className="space-y-0.5">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <span aria-hidden="true">🔗</span>
              <span>Weitere Spiele</span>
            </h2>
            <p className="text-xs text-muted">Eigene Seiten außerhalb der Sammlung – öffnen in einem neuen Tab.</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {EXTERNAL_GAMES.map((game) => (
              <li key={game.id}>
                <a
                  href={game.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bub-tile flex h-full items-start gap-4 rounded-2xl border border-line bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-3 focus-visible:outline-accent"
                >
                  <span className="bub-tile-crest text-4xl leading-none" aria-hidden="true">
                    {game.emoji}
                  </span>
                  <span className="min-w-0 space-y-1">
                    <span className="block font-semibold">
                      {game.title} <span aria-hidden="true">↗</span>
                      <span className="sr-only"> (öffnet in neuem Tab)</span>
                    </span>
                    <span className="block text-sm text-muted">{game.description}</span>
                    <span className="inline-block rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted">
                      {game.badge}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-auto space-y-2 text-xs text-muted">
        <p>
          {t('home.footer')}{' '}
          <a className="underline" href="https://github.com/ichthys2k/brett-und-blatt" target="_blank" rel="noreferrer">
            {t('home.source')}
          </a>
        </p>
        <nav className="flex flex-wrap gap-4" aria-label="Einstellungen und Rechtliches">
          <a className="underline" href={paths.sound}>
            {t('sound.settings')}
          </a>
          <a className="underline" href={paths.imprint}>
            {t('legal.imprint')}
          </a>
          <a className="underline" href={paths.privacy}>
            {t('legal.privacy')}
          </a>
          <a className="text-muted underline" href={paths.sound} title={t('update.title')}>
            {t('update.version', { version: APP_VERSION })}
          </a>
        </nav>
      </footer>
    </div>
    </TavernPage>
  );
}
