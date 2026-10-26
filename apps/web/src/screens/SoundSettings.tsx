import { playlistTracks } from '@brett-und-blatt/ui';
import { useEffect } from 'react';
import { Button } from '../components/controls';
import { MusicList } from '../components/MusicList';
import { VolumeControls } from '../components/SoundControl';
import { t } from '../i18n';
import { music, useMusicPrefs } from '../lib/music';
import { navigate, paths } from '../lib/router';

/** Ton-Einstellungen mit allen Stücken zum Probehören (#/ton). */
export function SoundSettingsScreen() {
  const prefs = useMusicPrefs();
  // Probehören endet mit dem Verlassen der Seite.
  useEffect(() => () => music.stop(), []);

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),2rem)]">
      <header className="flex items-center gap-2">
        <Button variant="ghost" className="px-3" aria-label={t('play.back')} onClick={() => navigate(paths.home)}>
          ←
        </Button>
        <h1 className="text-2xl font-bold">{t('sound.settings')}</h1>
      </header>
      <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <VolumeControls />
      </div>
      <div className="rounded-2xl border border-line bg-surface p-4">
        <MusicList
          onPlay={(track) => {
            music.play(playlistTracks(track.playlist), prefs);
            music.next(track);
          }}
        />
      </div>
    </div>
  );
}
