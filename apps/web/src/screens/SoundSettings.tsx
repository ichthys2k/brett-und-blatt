import { TavernPage } from '../components/TavernPage';
import { playlistTracks, setCardPortraits, useCardPortraits } from '@brett-und-blatt/ui';
import { useEffect, useState } from 'react';
import { Button } from '../components/controls';
import { MusicList } from '../components/MusicList';
import { VolumeControls } from '../components/SoundControl';
import { t } from '../i18n';
import { APP_DATE, APP_VERSION, checkForUpdate, resetApp } from '../lib/appUpdate';
import {
  contrastForcesPlain,
  ROOM_SCENES,
  type Look,
  type RoomScene,
  type TableSurface,
  setLook,
  setRoomScene,
  setTableSurface,
  TABLE_SURFACES,
  useChosenLook,
  useChosenRoom,
  useChosenTable,
} from '../lib/look';
import { music, useMusicPrefs } from '../lib/music';
import { PushToggle } from '../components/PushToggle';
import { loadPushWish } from '../lib/push';
import { navigate, paths } from '../lib/router';
import { setSoundSettings } from '../lib/sound';

/** Version der App, Suche nach Updates und Notlösung zum Zurücksetzen (#175). */
function AppVersion() {
  const [state, setState] = useState<'idle' | 'checking' | 'upToDate' | 'found'>('idle');
  const check = async () => {
    setState('checking');
    const found = await checkForUpdate();
    setState(found ? 'found' : 'upToDate');
  };
  return (
    <div className="space-y-2 rounded-2xl border border-line bg-surface p-4">
      <h2 className="font-semibold">{t('update.title')}</h2>
      <p className="text-sm text-muted">
        {t('update.version', { version: APP_VERSION })}
        {APP_DATE ? ` · ${APP_DATE}` : ''}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={check} disabled={state === 'checking'}>
          {state === 'checking' ? t('update.checking') : t('update.check')}
        </Button>
        {state === 'upToDate' && <span className="text-sm">{t('update.upToDate')}</span>}
        {state === 'found' && <span className="text-sm">{t('update.found')}</span>}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted">{t('update.reset')}</summary>
        <p className="py-2 text-muted">{t('update.resetHint')}</p>
        <Button onClick={() => void resetApp()}>{t('update.reset')}</Button>
      </details>
    </div>
  );
}

/** Ton-Einstellungen mit allen Stücken zum Probehören (#/ton). */
function LookChoice() {
  const chosen = useChosenLook();
  const table = useChosenTable();
  const room = useChosenRoom();
  const options: readonly { id: Look; label: string; text: string }[] = [
    { id: 'plain', label: t('look.plain'), text: t('look.plain.text') },
    { id: 'tavern', label: t('look.tavern'), text: t('look.tavern.text') },
  ];
  return (
    <div className="space-y-4">
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

      {chosen === 'tavern' && !contrastForcesPlain() && (
        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset className="space-y-2 rounded-2xl border border-line bg-surface p-4">
            <legend className="px-1 font-semibold">{t('look.table.title')}</legend>
            <p className="text-xs text-muted">{t('look.table.hint')}</p>
            <div className="grid gap-1 pt-1">
              {TABLE_SURFACES.map((id: TableSurface) => (
                <label key={id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-2">
                  <input type="radio" name="table-surface" className="accent-accent" checked={table === id} onChange={() => setTableSurface(id)} />
                  <span className="text-sm font-medium">{t(`look.table.${id}`)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2 rounded-2xl border border-line bg-surface p-4">
            <legend className="px-1 font-semibold">{t('look.room.title')}</legend>
            <p className="text-xs text-muted">{t('look.room.hint')}</p>
            <div className="grid gap-1 pt-1">
              {ROOM_SCENES.map((id: RoomScene) => (
                <label key={id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-2">
                  <input type="radio" name="room-scene" className="accent-accent" checked={room === id} onChange={() => setRoomScene(id)} />
                  <span className="text-sm font-medium">{t(`look.room.${id}`)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      )}
    </div>
  );
}

function PortraitChoice() {
  const on = useCardPortraits();
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface p-4">
      <input type="checkbox" className="mt-1 accent-accent" checked={on} onChange={(event) => setCardPortraits(event.target.checked)} />
      <span>
        <span className="block font-semibold">{t('cards.portraits')}</span>
        <span className="block text-sm text-muted">{t('cards.portraits.text')}</span>
      </span>
    </label>
  );
}

/** Gesamtschalter für Hinweise aufs Gerät (#242): gilt für dieses Gerät; Turniere und Fernpartien melden das Abo beim nächsten Öffnen selbst. */
function PushSwitch() {
  const [on, setOn] = useState(() => loadPushWish());
  return <PushToggle enabled={on} onEnable={() => setOn(true)} onDisable={() => setOn(false)} note={t('push.global')} />;
}

export function SoundSettingsScreen() {
  const prefs = useMusicPrefs();
  // Probehören endet mit dem Verlassen der Seite.
  useEffect(() => () => music.stop(), []);

  return (
    <TavernPage title="Optionen" subtitle="Ton, Musik, Aussehen und Updates.">
      <LookChoice />
      <AppVersion />
      <PushSwitch />
      <PortraitChoice />
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
    </TavernPage>
  );
}
