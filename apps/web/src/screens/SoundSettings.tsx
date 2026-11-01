import { playlistTracks } from '@brett-und-blatt/ui';
import { useEffect } from 'react';
import { Button } from '../components/controls';
import { MusicList } from '../components/MusicList';
import { VolumeControls } from '../components/SoundControl';
import { t } from '../i18n';
import { contrastForcesPlain, type Look, setLook, useChosenLook } from '../lib/look';
import { music, useMusicPrefs } from '../lib/music';
import { navigate, paths } from '../lib/router';
import { setSoundSettings } from '../lib/sound';

/** Ton-Einstellungen mit allen Stücken zum Probehören (#/ton). */
function LookChoice() {
  const chosen = useChosenLook();
  const options: readonly { id: Look; label: string; text: string }[] = [
    { id: 'plain', label: t('look.plain'), text: t('look.plain.text') },
    { id: 'tavern', label: t('look.tavern'), text: t('look.tavern.text') },
  ];
  return (
    <fieldset className="space-y-2 rounded-2xl border border-line bg-surface p-4">
      <legend className="px-1 font-semibold">{t('look.title')}</legend>
      {options.map((option) => (
        <label key={option.id} className="flex cursor-pointer items-start gap-3 rounded-xl p-2 hover:bg-surface-2">
          <input type="radio" name="look" className="mt-1 accent-accent" checked={chosen === option.id} onChange={() => setLook(option.id)} />
          <span>
            <span className="block font-medium">{option.label}</span>
            <span className="block text-sm text-muted">{option.text}</span>
          </span>
        </label>
      ))}
      {contrastForcesPlain() && <p className="text-sm text-muted">{t('look.contrast')}</p>}
    </fieldset>
  );
}

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
      <LookChoice />
      <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <VolumeControls showClientOption />
      </div>
      <div className="rounded-2xl border border-line bg-surface p-4">
        <MusicList
          onPlay={(track) => {
            // Wer ein Stück ausdrücklich startet, will es auch hören.
            setSoundSettings({ musicOff: false });
            music.play(playlistTracks(track.playlist), prefs);
            music.next(track);
          }}
        />
      </div>
    </div>
  );
}
