import { KnsButton, KnsDialog, KnsEmpty, KnsGrid, KnsTile, knsLayout, useInputIntent, useViewportSize } from '@brett-und-blatt/ui';
import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n';
import { controllerGrade } from '../lib/controllerGrade';
import { useFavorites } from '../lib/favorites';
import { FILTER_TABS, PLAYER_COUNTS, libraryGames, loadPlayerCount, parseFilter, savePlayerCount, type FilterId } from '../lib/gameCatalog';
import { mathPresetsFor } from '../lib/mathPresets';
import { games } from '../lib/registry';
import { paths } from '../lib/router';
import { ConsoleFrame } from './ConsoleFrame';
import { GameTile } from './GameTile';
import { useFavoriteKey } from './useFavoriteKey';
import { useInitialFocus } from './useInitialFocus';

/** Bibliothek der Konsole (#607, K5): alle Spiele als Raster, mit Rubrik, Spielerzahl und Suche. */
export function ConsoleLibrary({ initialFilter, initialPlayers }: { initialFilter?: string; initialPlayers?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<FilterId>(() => parseFilter(initialFilter));
  const [players, setPlayersState] = useState<number | null>(() => initialPlayers ?? loadPlayerCount());
  const [query, setQuery] = useState('');
  const { favorites, toggle } = useFavorites();
  const [filterOpen, setFilterOpen] = useState(false);
  const viewport = useViewportSize();
  const portrait = knsLayout(viewport.width, viewport.height) === 'portrait';
  useFavoriteKey(favorites, toggle);
  useInitialFocus(ref, 'bibliothek');

  useEffect(() => setFilter(parseFilter(initialFilter)), [initialFilter]);
  useEffect(() => {
    if (initialPlayers !== undefined) setPlayersState(initialPlayers);
  }, [initialPlayers]);

  const setPlayers = (count: number | null) => {
    setPlayersState(count);
    savePlayerCount(count);
  };

  // X fokussiert die Suche; A öffnet dort die Bildschirmtastatur.
  useInputIntent((intent) => {
    if (intent !== 'inspect') return false;
    searchRef.current?.focus();
    return true;
  }, 5);

  const list = libraryGames({ all: games, favorites, filter, players, query });
  const presets = filter === 'math' && !query.trim() ? mathPresetsFor(games, players) : [];
  const reset = () => {
    setFilter('all');
    setPlayers(null);
    setQuery('');
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>('.kns-tile')?.focus());
  };

  const searchField = (
    <span className="kns-search-wrap">
      <input
        ref={searchRef}
        type="search"
        className="kns-search"
        value={query}
        placeholder={t('console.search')}
        aria-label={t('console.search')}
        onChange={(event) => setQuery(event.target.value)}
      />
      {query && (
        <button type="button" className="kns-chip kns-chip-small" aria-label={t('console.search.clear')} onClick={() => setQuery('')}>
          ✕
        </button>
      )}
    </span>
  );

  return (
    <ConsoleFrame
      tab="library"
      prompts={[
        { key: 'A', label: t('console.prompt.open') },
        { key: 'X', label: t('console.prompt.search') },
        { key: 'Y', label: t('console.prompt.favorite') },
        { key: 'LB/RB', label: t('console.prompt.tabs') },
      ]}
    >
      <div ref={ref}>
        <div className="kns-filters">
          {portrait ? (
            <>
              {searchField}
              <div className="kns-chips kns-chips-scroll" role="group" aria-label={t('console.categories')}>
                {FILTER_TABS.map((tab) => (
                  <button key={tab.id} type="button" className="kns-chip" aria-pressed={filter === tab.id} data-kns-id={`filter:${tab.id}`} onClick={() => setFilter(tab.id)}>
                    <span aria-hidden="true">{tab.icon} </span>
                    {tab.label}
                  </button>
                ))}
                <button type="button" className="kns-chip" aria-haspopup="dialog" data-kns-id="filter:players" onClick={() => setFilterOpen(true)}>
                  <span aria-hidden="true">👥 </span>
                  {players === null ? t('console.filter') : t('console.players.n', { count: players })}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="kns-chips" role="group" aria-label={t('console.categories')}>
                {FILTER_TABS.map((tab) => (
                  <button key={tab.id} type="button" className="kns-chip" aria-pressed={filter === tab.id} data-kns-id={`filter:${tab.id}`} onClick={() => setFilter(tab.id)}>
                    <span aria-hidden="true">{tab.icon} </span>
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="kns-chips" role="group" aria-label={t('console.players')}>
                {[null, ...PLAYER_COUNTS].map((count) => (
                  <button
                    key={count ?? 'any'}
                    type="button"
                    className="kns-chip kns-chip-small"
                    aria-pressed={players === count}
                    aria-label={count === null ? t('console.players.any') : t('console.players.n', { count })}
                    data-kns-id={`players:${count ?? 'any'}`}
                    onClick={() => setPlayers(count)}
                  >
                    {count ?? t('console.players.any')}
                  </button>
                ))}
                {searchField}
              </div>
            </>
          )}
          <p className="kns-count" aria-live="polite">
            {list.length === 1 ? t('console.count.one') : t('console.count', { count: list.length })}
          </p>
        </div>

        {list.length === 0 && presets.length === 0 ? (
          <KnsEmpty
            title={t('console.empty')}
            action={
              <KnsButton variant="primary" onClick={reset}>
                {t('console.reset')}
              </KnsButton>
            }
          />
        ) : (
          <KnsGrid>
            {list.map((info, index) => (
              <li key={info.id}>
                <GameTile info={info} href={paths.setup(info.id)} favorite={favorites.includes(info.id)} grade={controllerGrade(info.id)} autoFocus={index === 0} />
              </li>
            ))}
            {presets.map((preset) => (
              <li key={preset.id}>
                <KnsTile
                  href={paths.setup(preset.gameId, preset.params)}
                  variant="link"
                  art={preset.emoji}
                  title={preset.title}
                  meta={preset.badge}
                  data-kns-id={`preset:${preset.id}`}
                  aria-label={`${preset.title}. ${preset.badge}`}
                />
              </li>
            ))}
          </KnsGrid>
        )}
        {filterOpen && (
          <KnsDialog title={t('console.players')} size="s" onClose={() => setFilterOpen(false)}>
            <div className="kns-chips" role="group" aria-label={t('console.players')}>
              {[null, ...PLAYER_COUNTS].map((count) => (
                <button
                  key={count ?? 'any'}
                  type="button"
                  className="kns-chip kns-chip-small"
                  aria-pressed={players === count}
                  aria-label={count === null ? t('console.players.any') : t('console.players.n', { count })}
                  data-kns-id={`players:${count ?? 'any'}`}
                  data-bub-autofocus={players === count ? '' : undefined}
                  onClick={() => {
                    setPlayers(count);
                    setFilterOpen(false);
                  }}
                >
                  {count ?? t('console.players.any')}
                </button>
              ))}
            </div>
          </KnsDialog>
        )}
      </div>
    </ConsoleFrame>
  );
}
