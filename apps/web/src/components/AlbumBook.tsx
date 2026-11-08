import type { AlbumItem } from '@brett-und-blatt/ui';
import { useEffect, useState } from 'react';
import { t } from '../i18n';
import { ALBUM_GAMES, ALBUM_KEY, foundCount, sanitizeAlbum, type Album } from '../lib/album';
import { findGame, loadGame } from '../lib/registry';

function loadAlbum(): Album {
  try {
    return sanitizeAlbum(JSON.parse(window.localStorage.getItem(ALBUM_KEY) ?? 'null'));
  } catch {
    return {};
  }
}

const date = (at: number) => new Date(at).toLocaleDateString('de-DE', { dateStyle: 'medium' });

/** Ein Kapitel: Katalog erst beim Aufklappen laden (das Spiel wird dafür nachgeladen). */
function Chapter({ gameId, album }: { gameId: string; album: Album }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AlbumItem[] | null>(null);
  const info = findGame(gameId);
  const chapter = album[gameId];
  const found = foundCount(album, gameId);

  useEffect(() => {
    if (!open || items) return;
    let cancelled = false;
    void loadGame(gameId).then((game) => {
      if (!cancelled) setItems(game.ui.album?.catalog() ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [open, items, gameId]);

  const groups = new Map<string, AlbumItem[]>();
  for (const item of items ?? []) groups.set(item.group ?? '', [...(groups.get(item.group ?? '') ?? []), item]);

  return (
    <li className="rounded-xl border border-line bg-bg">
      <button type="button" className="flex min-h-11 w-full items-center gap-3 p-3 text-left" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span aria-hidden="true" className="text-2xl">
          {info?.emoji ?? '📖'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{info?.name ?? gameId}</span>
          <span className="block text-xs text-muted">{chapter ? (chapter.total > 0 ? t('album.of', { found, total: chapter.total }) : t('album.foundOnly', { found })) : t('album.never')}</span>
        </span>
        <span aria-hidden="true">{open ? '▾' : '▸'}</span>
        <span className="sr-only">{open ? t('album.close') : t('album.open')}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-line p-3">
          {!items ? (
            <p className="text-sm text-muted">{t('album.loading')}</p>
          ) : (
            [...groups.entries()].map(([group, list]) => {
              const have = list.filter((item) => chapter && item.id in chapter.found).length;
              return (
                <section key={group} className="space-y-2" aria-label={group}>
                  {group && (
                    <h3 className="text-sm font-semibold">
                      {group} <span className="font-normal text-muted">({t('album.of', { found: have, total: list.length })})</span>
                    </h3>
                  )}
                  <ul className="grid grid-cols-2 gap-1.5 min-[480px]:grid-cols-3">
                    {list.map((item) => {
                      const at = chapter?.found[item.id];
                      return at ? (
                        <li key={item.id} title={`${item.label} · ${date(at)}`} className="flex min-h-11 items-center gap-1.5 rounded-lg border border-accent bg-accent/10 px-2 py-1 text-xs">
                          {item.icon && <span aria-hidden="true" className="text-base">{item.icon}</span>}
                          <span className="min-w-0 truncate">{item.label}</span>
                        </li>
                      ) : (
                        <li key={item.id} className="flex min-h-11 items-center justify-center rounded-lg border border-dashed border-line px-2 py-1 text-xs text-muted">
                          <span aria-hidden="true">?</span>
                          <span className="sr-only">{t('album.missing')}</span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })
          )}
        </div>
      )}
    </li>
  );
}

/** Das Sammelalbum des Passes (#148): ein Kapitel je Spiel mit Album-Haken. */
export function AlbumBook() {
  const album = loadAlbum();
  return (
    <section className="space-y-3 rounded-2xl border border-line bg-surface p-4" aria-labelledby="album-title">
      <h2 id="album-title" className="text-xl font-bold">
        📖 {t('album.title')}
      </h2>
      <p className="text-sm text-muted">{t('album.intro')}</p>
      <ul className="space-y-2">
        {ALBUM_GAMES.map((id) => (
          <Chapter key={id} gameId={id} album={album} />
        ))}
      </ul>
    </section>
  );
}
