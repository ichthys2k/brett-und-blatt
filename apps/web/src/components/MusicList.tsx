import { musicTracks, playlists, type MusicTrack } from '@brett-und-blatt/ui';
import { t } from '../i18n';
import { setMusicPrefs, toggleExcluded, toggleStar, useCurrentTrack, useMusicPrefs } from '../lib/music';
import { Button } from './controls';

/** Stern-Knopf zu einem Stück. */
export function StarButton({ track }: { track: MusicTrack }) {
  const prefs = useMusicPrefs();
  const starred = prefs.starred.includes(track.id);
  return (
    <Button variant="ghost" className="px-2 text-lg" aria-pressed={starred} aria-label={starred ? t('music.unstar') : t('music.star')} title={starred ? t('music.unstar') : t('music.star')} onClick={() => toggleStar(track)}>
      <span className={starred ? 'text-warning' : 'text-muted'}>{starred ? '★' : '☆'}</span>
    </Button>
  );
}

/**
 * Alle Playlists mit ihren Stücken: Probehören, Stern, Ausschließen.
 * @param onPlay Spielt ein Stück sofort (im Spiel innerhalb der laufenden Musik, sonst zum Probehören).
 */
export function MusicList({ onPlay }: { onPlay: (track: MusicTrack) => void }) {
  const prefs = useMusicPrefs();
  const current = useCurrentTrack();

  return (
    <div className="space-y-4">
      <label className="flex items-center justify-between gap-3 font-medium">
        {t('music.onlyStars')}
        <input type="checkbox" className="size-5 accent-[var(--color-accent)]" checked={prefs.onlyStars} onChange={(event) => setMusicPrefs({ onlyStars: event.target.checked })} />
      </label>
      <p className="text-sm text-muted">{t('music.hint')}</p>
      {playlists.map((list) => {
        const tracks = musicTracks.filter((track) => track.playlist === list.id);
        return (
          <section key={list.id} className="space-y-1">
            <h3 className="font-semibold">
              {list.title} <span className="text-sm font-normal text-muted">– {list.mood}</span>
            </h3>
            {tracks.length === 0 && <p className="text-sm text-muted">{t('music.empty')}</p>}
            <ul className="divide-y divide-line">
              {tracks.map((track) => {
                const excluded = prefs.excluded.includes(track.id);
                const playing = current?.id === track.id;
                return (
                  <li key={track.id} className="flex items-center gap-1">
                    <Button variant="ghost" className="px-2" aria-label={`${t('music.play')}: ${track.title}`} title={t('music.play')} onClick={() => onPlay(track)}>
                      {playing ? '♪' : '▶'}
                    </Button>
                    <span className={`min-w-0 flex-1 truncate ${excluded ? 'text-muted line-through' : ''} ${playing ? 'font-semibold' : ''}`}>{track.title}</span>
                    <StarButton track={track} />
                    <Button
                      variant="ghost"
                      className="px-2"
                      aria-pressed={excluded}
                      aria-label={excluded ? t('music.include') : t('music.exclude')}
                      title={excluded ? t('music.include') : t('music.exclude')}
                      onClick={() => toggleExcluded(track)}
                    >
                      <span className={excluded ? '' : 'opacity-40 grayscale'}>🚫</span>
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <p className="text-xs text-muted">{t('music.credit')}</p>
    </div>
  );
}
