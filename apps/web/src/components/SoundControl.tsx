import { defaultPlaylist, musicTracks, playlists } from '@brett-und-blatt/ui';
import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n';
import { choosePlaylist, music, playlistFor, useCurrentTrack, useMusicPrefs } from '../lib/music';
import { setSoundSettings, sound, useSoundSettings } from '../lib/sound';
import { Button } from './controls';
import { MusicList, StarButton } from './MusicList';

/** Effekte und Musik je an/aus mit ihren Lautstärken – im Spiel und in den Ton-Einstellungen. */
export function VolumeControls({ showClientOption }: { showClientOption?: boolean } = {}) {
  const settings = useSoundSettings();
  return (
    <>
      <label className="flex items-center justify-between gap-3 font-medium">
        {t('sound.effectsOn')}
        <input
          type="checkbox"
          className="size-5 accent-[var(--color-accent)]"
          checked={!settings.effectsOff}
          onChange={(event) => setSoundSettings({ effectsOff: !event.target.checked })}
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="text-muted">{t('sound.effects')}</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          className="w-full accent-[var(--color-accent)]"
          disabled={settings.effectsOff}
          value={Math.round(settings.effects * 100)}
          onChange={(event) => setSoundSettings({ effects: Number(event.target.value) / 100 })}
          onPointerUp={() => sound.play('stein-setzen')}
          onKeyUp={() => sound.play('stein-setzen')}
        />
      </label>
      <label className="flex items-center justify-between gap-3 font-medium">
        {t('sound.musicOn')}
        <input
          type="checkbox"
          className="size-5 accent-[var(--color-accent)]"
          checked={!settings.musicOff}
          onChange={(event) => setSoundSettings({ musicOff: !event.target.checked })}
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="text-muted">{t('sound.music')}</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          className="w-full accent-[var(--color-accent)]"
          disabled={settings.musicOff}
          value={Math.round(settings.music * 100)}
          onChange={(event) => setSoundSettings({ music: Number(event.target.value) / 100 })}
        />
      </label>
      {showClientOption && (
        <label className="flex items-center justify-between gap-3 text-sm">
          <div>
            <span className="block font-medium">{t('sound.clientMusic')}</span>
            <span className="block text-xs text-muted">{t('sound.clientMusicHint')}</span>
          </div>
          <input
            type="checkbox"
            className="size-5 flex-none accent-[var(--color-accent)]"
            checked={settings.clientMusic ?? false}
            onChange={(event) => setSoundSettings({ clientMusic: event.target.checked })}
          />
        </label>
      )}
    </>
  );
}

/** Lautsprecher-Knopf im Spiel: Lautstärken, Playlist, laufendes Stück. */
export function SoundControl({ gameId, isClient, ownMusic, inBar }: { gameId: string; isClient?: boolean; ownMusic?: boolean; inBar?: boolean }) {
  const settings = useSoundSettings();
  const prefs = useMusicPrefs();
  const current = useCurrentTrack();
  const [open, setOpen] = useState(false);
  const [showList, setShowList] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const musicActive = !isClient || Boolean(settings.clientMusic);
  const silent = (settings.effectsOff || settings.effects === 0) && (!musicActive || settings.musicOff || settings.music === 0);
  const playlistId = playlistFor(gameId, prefs);
  // Spiele mit eigener Musik haben keine Playlist zur Auswahl.
  const musicOn = !ownMusic && !settings.musicOff && settings.music > 0 && musicTracks.length > 0 && musicActive;

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !box.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <Button variant="ghost" className="px-3 text-lg" aria-label={t('sound.title')} title={t('sound.title')} aria-expanded={open} onClick={() => setOpen(!open)}>
        {silent ? '🔇' : '🔊'}
      </Button>
      {open && (
        <div className={`absolute top-full right-0 z-30 mt-1 max-h-[calc(100dvh-4rem)] w-72 space-y-3 overflow-y-auto rounded-xl ${inBar ? '' : 'side:fixed side:top-12 side:right-auto side:left-2'} border border-line bg-surface p-3 shadow-md`}>
          <VolumeControls showClientOption={isClient} />
          {musicOn && (
            <>
              <label className="block space-y-1 text-sm">
                <span className="text-muted">{t('music.playlist')}</span>
                <select
                  className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-base"
                  value={playlistId}
                  onChange={(event) => choosePlaylist(gameId, event.target.value)}
                >
                  {playlists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.id === defaultPlaylist(gameId) ? t('music.playlistDefault', { name: list.title }) : list.title}
                    </option>
                  ))}
                </select>
              </label>
              {current && (
                <div className="flex items-center gap-1">
                  <span className="min-w-0 flex-1 truncate text-sm">
                    <span aria-hidden="true">♪ </span>
                    {current.title}
                  </span>
                  <StarButton track={current} />
                  <Button variant="ghost" className="px-2" aria-label={t('music.next')} title={t('music.next')} onClick={() => music.next()}>
                    ⏭
                  </Button>
                </div>
              )}
              <Button
                className="w-full"
                onClick={() => {
                  setOpen(false);
                  setShowList(true);
                }}
              >
                {t('music.all')}
              </Button>
            </>
          )}
        </div>
      )}
      {showList && (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-bg/95 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={t('sound.settings')}>
          <div className="mx-auto max-w-xl space-y-4 rounded-2xl border border-line bg-surface p-4 shadow-sm">
            <h2 className="text-lg font-semibold">{t('sound.settings')}</h2>
            <MusicList onPlay={(track) => music.next(track)} />
            <Button variant="primary" className="w-full" onClick={() => setShowList(false)}>
              {t('howto.close')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
