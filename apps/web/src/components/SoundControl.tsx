import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n';
import { setSoundSettings, sound, useSoundSettings } from '../lib/sound';
import { Button } from './controls';

/** Lautsprecher-Knopf mit kleinem Feld für Stummschalten und Lautstärke. */
export function SoundControl() {
  const settings = useSoundSettings();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const silent = settings.muted || settings.effects === 0;

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
        <div className="absolute top-full right-0 z-30 mt-1 w-64 space-y-3 rounded-xl border border-line bg-surface p-3 shadow-md">
          <label className="flex items-center justify-between gap-3 font-medium">
            {t('sound.on')}
            <input
              type="checkbox"
              className="size-5 accent-[var(--color-accent)]"
              checked={!settings.muted}
              onChange={(event) => setSoundSettings({ muted: !event.target.checked })}
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
              disabled={settings.muted}
              value={Math.round(settings.effects * 100)}
              onChange={(event) => setSoundSettings({ effects: Number(event.target.value) / 100 })}
              onPointerUp={() => sound.play('stein-setzen')}
              onKeyUp={() => sound.play('stein-setzen')}
            />
          </label>
        </div>
      )}
    </div>
  );
}
