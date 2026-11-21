import { KnsDialog, KnsLinkRow, KnsSection, KnsSliderRow, KnsToggleRow } from '@brett-und-blatt/ui';
import { t } from '../i18n';
import { paths } from '../lib/router';
import { setSoundSettings, useSoundSettings } from '../lib/sound';
import { storage } from '../lib/storage';

const percent = (value: number) => `${Math.round(value * 100)} %`;

/**
 * Schnellzugriff der Konsole (#638, U3): Start ☰ oder der Knopf „☰“ in der Kopfleiste öffnen ihn in jedem
 * Menü. Dieselben Setzer wie die Optionen (`lib/sound.ts`); am Spieltisch gilt weiter das Menü der Partie.
 */
export function QuickAccess({ onClose }: { onClose: () => void }) {
  const settings = useSoundSettings();
  const profile = storage.loadProfile();
  const running = storage.loadActive() !== null;
  return (
    <KnsDialog title={t('console.quick')} size="s" onClose={onClose} className="kns-quick">
      <KnsSection>
        <KnsToggleRow label={t('console.quick.effectsOn')} checked={!settings.effectsOff} onChange={(on) => setSoundSettings({ effectsOff: !on })} />
        <KnsSliderRow
          label={t('console.quick.effects')}
          value={Math.round(settings.effects * 100)}
          min={0}
          max={100}
          step={5}
          disabled={settings.effectsOff}
          format={(value) => percent(value / 100)}
          onChange={(value) => setSoundSettings({ effects: value / 100 })}
        />
        <KnsToggleRow label={t('console.quick.musicOn')} checked={!settings.musicOff} onChange={(on) => setSoundSettings({ musicOff: !on })} />
        <KnsSliderRow
          label={t('console.quick.music')}
          value={Math.round(settings.music * 100)}
          min={0}
          max={100}
          step={5}
          disabled={settings.musicOff}
          format={(value) => percent(value / 100)}
          onChange={(value) => setSoundSettings({ music: value / 100 })}
        />
      </KnsSection>
      <KnsSection>
        {running && <KnsLinkRow label={t('console.quick.resume')} href={paths.play} onClick={onClose} data-bub-autofocus="" />}
        <KnsLinkRow label={t('console.quick.pass')} href={paths.pass} value={profile?.name ?? t('console.quick.noPass')} onClick={onClose} />
        <KnsLinkRow label={t('console.quick.options')} href={paths.sound} onClick={onClose} />
      </KnsSection>
    </KnsDialog>
  );
}
