import {
  KnsActionRow,
  KnsButton,
  KnsChoiceRow,
  KnsDialog,
  KnsInfoRow,
  KnsLinkRow,
  KnsList,
  KnsListItem,
  KnsPage,
  KnsSection,
  KnsSliderRow,
  KnsSplit,
  KnsToggleRow,
  musicTracks,
  playlists,
  playlistTracks,
  setCardPortraits,
  useCardPortraits,
  useInputSource,
  type ControlMode,
  type MusicTrack,
} from '@brett-und-blatt/ui';
import { useEffect, useState } from 'react';
import { PieceSetPicker } from '../components/PieceSetPicker';
import { PushToggle } from '../components/PushToggle';
import { t } from '../i18n';
import { APP_DATE, APP_VERSION, checkForUpdate, resetApp } from '../lib/appUpdate';
import { setBoardHidden, useBoardHidden } from '../lib/boardPrefs';
import { hapticsSupported, setHaptics, useHaptics } from '../lib/haptics';
import { saveInputSettings, useInputSettings } from '../lib/inputSettings';
import {
  contrastForcesPlain,
  LIGHT_CHOICES,
  MENU_3D_AVAILABLE,
  ROOM_SCENES,
  setLight,
  setLook,
  setMenu3d,
  setMenuStations,
  setRoomScene,
  setScenes,
  setTableSurface,
  TABLE_SURFACES,
  useChosenLight,
  useChosenLook,
  useChosenRoom,
  useChosenTable,
  useMenu3d,
  useMenuStationsChoice,
  useScenesOn,
  type LightChoice,
  type Look,
  type RoomScene,
  type TableSurface,
} from '../lib/look';
import { music, setMusicPrefs, toggleExcluded, toggleStar, useCurrentTrack, useMusicPrefs } from '../lib/music';
import { PIECE_GAMES } from '../lib/pieceGames';
import { loadPushWish, pushAvailability } from '../lib/push';
import { paths } from '../lib/router';
import { GAME_SERVER } from '../lib/server';
import { setShell, shellParam, useChosenShell, type Shell } from '../lib/shell';
import { setSoundSettings, sound, useSoundSettings } from '../lib/sound';
import { ConsoleFrame } from './ConsoleFrame';
import { OPTION_CATEGORIES, parseOptionCategory, type OptionCategory } from './optionCategories';

/*
 * Optionen der Konsole (#640, U5): Muster „Einstellungen“ – Kategorien links (Hochformat: Chips oben), rechts
 * Zeilen. Alle Werte wirken sofort und nutzen dieselben Setzer wie die klassische Seite (`screens/SoundSettings.tsx`).
 */

type MessageKey = Parameters<typeof t>[0];

const SOURCE_URL = 'https://github.com/ichthys2k/brett-und-blatt';

const ICONS: Record<OptionCategory, string> = { sound: '🔊', music: '🎵', look: '🎨', pieces: '♟️', input: '🎮', push: '🔔', app: 'ℹ️' };

const percent = (value: number) => `${value} %`;

function SoundCategory() {
  const settings = useSoundSettings();
  const haptics = useHaptics();
  return (
    <KnsSection title={t('sound.title')}>
      <KnsToggleRow label={t('sound.effectsOn')} checked={!settings.effectsOff} onChange={(on) => setSoundSettings({ effectsOff: !on })} />
      <KnsSliderRow
        label={t('sound.effects')}
        value={Math.round(settings.effects * 100)}
        min={0}
        max={100}
        step={5}
        disabled={settings.effectsOff}
        format={percent}
        onChange={(value) => {
          setSoundSettings({ effects: value / 100 });
          sound.play('stein-setzen');
        }}
      />
      <KnsToggleRow label={t('sound.musicOn')} checked={!settings.musicOff} onChange={(on) => setSoundSettings({ musicOff: !on })} />
      <KnsSliderRow label={t('sound.music')} value={Math.round(settings.music * 100)} min={0} max={100} step={5} disabled={settings.musicOff} format={percent} onChange={(value) => setSoundSettings({ music: value / 100 })} />
      {hapticsSupported() && <KnsToggleRow label={t('sound.vibration')} hint={t('sound.vibrationHint')} checked={haptics} onChange={setHaptics} />}
      <KnsToggleRow label={t('sound.clientMusic')} hint={t('sound.clientMusicHint')} checked={settings.clientMusic ?? false} onChange={(on) => setSoundSettings({ clientMusic: on })} />
    </KnsSection>
  );
}

function MusicCategory() {
  const prefs = useMusicPrefs();
  const current = useCurrentTrack();
  // Probehören endet mit dem Verlassen der Seite.
  useEffect(() => () => music.stop(), []);
  const play = (track: MusicTrack) => {
    // Wer ein Stück ausdrücklich startet, will es auch hören.
    setSoundSettings({ musicOff: false });
    music.play(playlistTracks(track.playlist), prefs);
    music.next(track);
  };
  return (
    <>
      <KnsSection title={t('console.options.cat.music')} hint={t('music.hint')}>
        <KnsToggleRow label={t('music.onlyStars')} checked={prefs.onlyStars} onChange={(on) => setMusicPrefs({ onlyStars: on })} />
      </KnsSection>
      {playlists.map((list) => {
        const tracks = musicTracks.filter((track) => track.playlist === list.id);
        return (
          <KnsSection key={list.id} title={list.title} hint={list.mood}>
            {tracks.length === 0 ? (
              <p className="kns-options-note">{t('music.empty')}</p>
            ) : (
              <KnsList className="kns-options-tracks">
                {tracks.map((track) => {
                  const starred = prefs.starred.includes(track.id);
                  const excluded = prefs.excluded.includes(track.id);
                  const playing = current?.id === track.id;
                  return (
                    <KnsListItem
                      key={track.id}
                      leading={playing ? '♪' : '▶'}
                      title={<span className={excluded ? 'kns-options-excluded' : undefined}>{track.title}</span>}
                      label={`${t('music.play')}: ${track.title}`}
                      onActivate={() => play(track)}
                      actions={
                        <>
                          <KnsButton variant="quiet" aria-pressed={starred} aria-label={starred ? t('music.unstar') : t('music.star')} onClick={() => toggleStar(track)}>
                            {starred ? '★' : '☆'}
                          </KnsButton>
                          <KnsButton variant="quiet" aria-pressed={excluded} aria-label={excluded ? t('music.include') : t('music.exclude')} onClick={() => toggleExcluded(track)}>
                            <span className={excluded ? undefined : 'kns-options-dim'}>🚫</span>
                          </KnsButton>
                        </>
                      }
                    />
                  );
                })}
              </KnsList>
            )}
          </KnsSection>
        );
      })}
      <p className="kns-options-note">{t('music.credit')}</p>
    </>
  );
}

function LookCategory() {
  const shell = useChosenShell();
  const look = useChosenLook();
  const table = useChosenTable();
  const room = useChosenRoom();
  const menu3d = useMenu3d();
  const scenes = useScenesOn();
  const stations = useMenuStationsChoice();
  const light = useChosenLight();
  const boardHidden = useBoardHidden();
  const tavern = look === 'tavern' && !contrastForcesPlain();
  return (
    <>
      <KnsSection title={t('shell.title')}>
        <KnsChoiceRow<Shell>
          label={t('shell.title')}
          hint={shell === 'console' ? t('shell.console.text') : t('shell.classic.text')}
          value={shell}
          onChange={setShell}
          choices={[
            { value: 'console', label: t('shell.console') },
            { value: 'classic', label: t('shell.classic') },
          ]}
        />
        {shellParam() !== null && <KnsInfoRow label={t('shell.param')} value="" />}
      </KnsSection>
      <KnsSection title={t('look.title')}>
        <KnsChoiceRow<Look>
          label={t('look.title')}
          hint={contrastForcesPlain() ? t('look.contrast') : look === 'tavern' ? t('look.tavern.text') : t('look.plain.text')}
          value={look}
          onChange={setLook}
          choices={[
            { value: 'tavern', label: t('look.tavern') },
            { value: 'plain', label: t('look.plain') },
          ]}
        />
        {tavern && <KnsToggleRow label={t('look.scenes.title')} hint={t('look.scenes.text')} checked={scenes} onChange={setScenes} />}
        {tavern && MENU_3D_AVAILABLE && <KnsToggleRow label={t('look.menu3d.title')} hint={t('look.menu3d.text')} checked={menu3d} onChange={setMenu3d} />}
        {tavern && room === 'tavern' && <KnsToggleRow label={t('look.stations.title')} hint={t('look.stations.text')} checked={stations} onChange={setMenuStations} />}
        {tavern && (
          <KnsChoiceRow<LightChoice>
            label={t('look.light.title')}
            hint={t('look.light.hint')}
            value={light}
            onChange={setLight}
            choices={LIGHT_CHOICES.map((id) => ({ value: id, label: t(`look.light.${id}` as MessageKey) }))}
          />
        )}
        {tavern && (
          <KnsChoiceRow<TableSurface>
            label={t('look.table.title')}
            hint={t('look.table.hint')}
            value={table}
            onChange={setTableSurface}
            mode="dialog"
            choices={TABLE_SURFACES.map((id) => ({
              value: id,
              label: (
                <span className="kns-options-table">
                  <span className="bub-table-preview" data-surface={id} aria-hidden="true" />
                  {t(`look.table.${id}` as MessageKey)}
                </span>
              ),
            }))}
          />
        )}
        {tavern && (
          <KnsChoiceRow<RoomScene>
            label={t('look.room.title')}
            hint={t('look.room.hint')}
            value={room}
            onChange={setRoomScene}
            mode="dialog"
            choices={ROOM_SCENES.map((id) => ({ value: id, label: t(`look.room.${id}` as MessageKey) }))}
          />
        )}
      </KnsSection>
      {GAME_SERVER && (
        <KnsSection title={t('console.tab.online')}>
          <KnsToggleRow label={t('console.options.boardHidden')} hint={t('console.options.boardHidden.hint')} checked={boardHidden} onChange={setBoardHidden} />
        </KnsSection>
      )}
    </>
  );
}

function PiecesCategory() {
  const portraits = useCardPortraits();
  return (
    <>
      <KnsSection title={t('cards.portraits')}>
        <KnsToggleRow label={t('cards.portraits')} hint={t('cards.portraits.text')} checked={portraits} onChange={setCardPortraits} />
      </KnsSection>
      <KnsSection title={t('pieces.title')} hint={t('pieces.hint')}>
        <div className="kns-options-embed">
          {PIECE_GAMES.map((game) => (
            <PieceSetPicker key={game.id} game={game} />
          ))}
        </div>
      </KnsSection>
    </>
  );
}

function InputCategory() {
  const settings = useInputSettings();
  const { connectedGamepads } = useInputSource();
  const modes: readonly { id: ControlMode; label: string; hint: string }[] = [
    { id: 'standard', label: t('input.mode.standard'), hint: t('input.mode.standard.hint') },
    { id: 'legalMoves', label: t('input.mode.legalMoves'), hint: t('input.mode.legalMoves.hint') },
    { id: 'scanAuto', label: t('input.mode.scanAuto'), hint: t('input.mode.scanAuto.hint') },
    { id: 'scanStep', label: t('input.mode.scanStep'), hint: t('input.mode.scanStep.hint') },
  ];
  const scan = settings.mode === 'scanAuto' || settings.mode === 'scanStep';
  return (
    <KnsSection title={t('input.title')}>
      <KnsInfoRow label={t('console.options.gamepads')} value={connectedGamepads > 0 ? t('input.connected', { count: connectedGamepads }) : t('input.noneConnected')} />
      <KnsChoiceRow<ControlMode>
        label={t('input.mode')}
        hint={modes.find((mode) => mode.id === settings.mode)?.hint}
        value={settings.mode}
        mode="dialog"
        onChange={(mode) => saveInputSettings({ mode })}
        choices={modes.map((mode) => ({ value: mode.id, label: mode.label, hint: mode.hint }))}
      />
      {scan && (
        <KnsSliderRow
          label={t('console.options.scanSpeed')}
          value={settings.scanIntervalMs}
          min={500}
          max={2500}
          step={100}
          format={(ms) => `${ms} ms`}
          onChange={(scanIntervalMs) => saveInputSettings({ scanIntervalMs })}
        />
      )}
      <KnsSliderRow
        label={t('console.options.deadzone')}
        value={Math.round(settings.deadzone * 100)}
        min={15}
        max={45}
        step={5}
        format={percent}
        onChange={(value) => saveInputSettings({ deadzone: value / 100 })}
      />
      <KnsToggleRow label={t('input.haptics')} checked={settings.haptics} onChange={(haptics) => saveInputSettings({ haptics })} />
      <KnsToggleRow label={t('input.prompts')} checked={settings.prompts} onChange={(prompts) => saveInputSettings({ prompts })} />
      <KnsChoiceRow<'pass' | 'multi'>
        label={t('input.hotSeat')}
        value={settings.hotSeatMode}
        onChange={(hotSeatMode) => saveInputSettings({ hotSeatMode })}
        choices={[
          { value: 'pass', label: t('input.hotSeat.pass') },
          { value: 'multi', label: t('input.hotSeat.multi') },
        ]}
      />
    </KnsSection>
  );
}

function PushCategory() {
  const [on, setOn] = useState(() => loadPushWish());
  return (
    <div className="kns-options-embed">
      <PushToggle enabled={on} onEnable={() => setOn(true)} onDisable={() => setOn(false)} note={t('push.global')} />
    </div>
  );
}

function AppCategory() {
  const [state, setState] = useState<'idle' | 'checking' | 'upToDate' | 'found'>('idle');
  const [confirmReset, setConfirmReset] = useState(false);
  const check = async () => {
    setState('checking');
    const found = await checkForUpdate();
    setState(found ? 'found' : 'upToDate');
  };
  const status = state === 'upToDate' ? t('update.upToDate') : state === 'found' ? t('update.found') : undefined;
  return (
    <>
      <KnsSection title={t('update.title')}>
        <KnsInfoRow label={t('console.options.version')} value={`${APP_VERSION}${APP_DATE ? ` · ${APP_DATE}` : ''}`} />
        <KnsActionRow label={t('update.check')} hint={status} action={state === 'checking' ? t('update.checking') : t('update.check')} disabled={state === 'checking'} onAction={() => void check()} />
        <KnsActionRow label={t('update.reset')} hint={t('update.resetHint')} action={t('console.options.reset.action')} variant="danger" onAction={() => setConfirmReset(true)} />
      </KnsSection>
      <KnsSection>
        <KnsLinkRow label={t('legal.imprint')} href={paths.imprint} />
        <KnsLinkRow label={t('legal.privacy')} href={paths.privacy} />
        <KnsLinkRow label={t('home.source')} href={SOURCE_URL} external />
      </KnsSection>
      {confirmReset && (
        <KnsDialog
          title={t('console.options.reset.confirm')}
          size="s"
          onClose={() => setConfirmReset(false)}
          actions={
            <>
              <KnsButton data-bub-autofocus onClick={() => setConfirmReset(false)}>
                {t('console.options.cancel')}
              </KnsButton>
              <KnsButton variant="danger" onClick={() => void resetApp()}>
                {t('console.options.reset.action')}
              </KnsButton>
            </>
          }
        >
          <p>{t('update.resetHint')}</p>
        </KnsDialog>
      )}
    </>
  );
}

/** Optionen der Konsole; die Kategorie steht in der Adresse (`#/ton?bereich=controller`). */
export function ConsoleOptions({ section }: { section?: string }) {
  const available = OPTION_CATEGORIES.filter((id) => id !== 'push' || pushAvailability() !== 'hidden');
  const [category, setCategory] = useState<OptionCategory>(() => parseOptionCategory(section, available));
  const availableKey = available.join(',');
  useEffect(() => setCategory(parseOptionCategory(section, availableKey.split(',') as OptionCategory[])), [section, availableKey]);
  const select = (id: string) => {
    const next = parseOptionCategory(id, available);
    setCategory(next);
    // Ohne neuen Verlaufseintrag: B verlässt die Optionen, Neuladen bleibt in der Kategorie.
    window.history.replaceState(window.history.state, '', `${paths.sound}?bereich=${next}`);
  };
  return (
    <ConsoleFrame tab="options">
      <KnsPage title={t('console.options.title')} subtitle={t('console.options.subtitle')}>
        <KnsSplit
          label={t('console.options.categories')}
          nav={available.map((id) => ({ id, icon: ICONS[id], label: t(`console.options.cat.${id}` as MessageKey) }))}
          current={category}
          onSelect={select}
        >
          <div className="kns-options">
            {category === 'sound' && <SoundCategory />}
            {category === 'music' && <MusicCategory />}
            {category === 'look' && <LookCategory />}
            {category === 'pieces' && <PiecesCategory />}
            {category === 'input' && <InputCategory />}
            {category === 'push' && <PushCategory />}
            {category === 'app' && <AppCategory />}
          </div>
        </KnsSplit>
      </KnsPage>
    </ConsoleFrame>
  );
}
