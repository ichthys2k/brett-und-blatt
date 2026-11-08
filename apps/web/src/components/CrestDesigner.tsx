import { AVATARS } from '@brett-und-blatt/online';
import {
  CREST_COLORS,
  CREST_LABELS,
  CREST_ORNAMENTS,
  CREST_PALETTE,
  CREST_DIVISIONS,
  CREST_SHIELDS,
  clampCrest,
  unlockOf,
  type CrestProgress,
  type CrestSpec,
} from '@brett-und-blatt/engine';
import { PlayerCrest } from '@brett-und-blatt/ui';
import { useEffect, useState } from 'react';
import { t } from '../i18n';
import { crestProgress, saveCrest, useCrest } from '../lib/crestStore';
import { Button } from './controls';

const base = 'min-h-11 rounded-xl px-4 text-sm';
const chosen = 'border-[3px] border-ink bg-bg font-semibold';
const free = 'border border-line bg-bg font-medium hover:bg-surface-2';
const locked = 'cursor-not-allowed border border-dashed border-line bg-surface-2 text-muted';

/** Gestalter für das Wappen des Passes (#147): Teile wählen; gesperrte Teile sagen, was noch fehlt. */
export function CrestDesigner({ name, onClose }: { name: string; onClose(): void }) {
  const spec = useCrest();
  const [progress, setProgress] = useState<CrestProgress | null>(null);
  useEffect(() => {
    void crestProgress().then(setProgress);
  }, []);
  // Beim ersten Öffnen: nur freigeschaltete Teile übernehmen.
  const safe = progress ? clampCrest(spec, progress) : spec;
  const change = (patch: Partial<CrestSpec>) => saveCrest(progress ? clampCrest({ ...safe, ...patch }, progress) : { ...safe, ...patch });

  const choice = <T extends string>(kind: 'shield' | 'division' | 'colors' | 'ornament', value: T, current: boolean, label: string, onPick: () => void) => {
    const lock = progress ? unlockOf(kind, value, progress) : { ok: true, hint: '' };
    return (
      <button
        key={value}
        type="button"
        className={`${base} ${!lock.ok ? locked : current ? chosen : free}`}
        disabled={!lock.ok}
        aria-pressed={current}
        onClick={onPick}
      >
        {label}
        {!lock.ok && <span className="block text-xs">{t('crest.locked', { hint: lock.hint })}</span>}
      </button>
    );
  };

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-4 text-left sm:flex-row" aria-label={t('crest.change')}>
      <div className="flex flex-none flex-col items-center gap-2 self-center text-ink">
        <PlayerCrest spec={safe} size={160} label={t('crest.of', { name })} />
        <span className="text-sm text-muted">{t('crest.preview')}</span>
      </div>
      <div className="min-w-0 flex-1 space-y-4">
        <fieldset className="space-y-2">
          <legend className="font-semibold">{t('crest.shield')}</legend>
          <div className="flex flex-wrap gap-2">{CREST_SHIELDS.map((value) => choice('shield', value, safe.shield === value, CREST_LABELS.shield[value], () => change({ shield: value })))}</div>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="font-semibold">{t('crest.division')}</legend>
          <div className="flex flex-wrap gap-2">{CREST_DIVISIONS.map((value) => choice('division', value, safe.division === value, CREST_LABELS.division[value], () => change({ division: value })))}</div>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="font-semibold">{t('crest.colors')}</legend>
          <div className="flex flex-wrap gap-2">
            {CREST_COLORS.map((value) => {
              const lock = progress ? unlockOf('colors', value, progress) : { ok: true, hint: '' };
              const [a, b] = CREST_PALETTE[value];
              return (
                <button
                  key={value}
                  type="button"
                  className={`${base} flex flex-col items-start gap-1 !px-2 py-1 ${!lock.ok ? locked : safe.colors === value ? chosen : free}`}
                  disabled={!lock.ok}
                  aria-pressed={safe.colors === value}
                  aria-label={`${CREST_LABELS.colors[value]}${lock.ok ? '' : `, ${t('crest.locked', { hint: lock.hint })}`}`}
                  onClick={() => change({ colors: value })}
                >
                  <span className={`flex h-6 w-16 overflow-hidden rounded ${lock.ok ? '' : 'opacity-60'}`} aria-hidden="true">
                    <span className="flex-1" style={{ background: a }} />
                    <span className="flex-1" style={{ background: b }} />
                  </span>
                  <span className="text-xs">{lock.ok ? CREST_LABELS.colors[value] : t('crest.locked', { hint: lock.hint })}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="font-semibold">{t('crest.ornament')}</legend>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={`${base} ${safe.ornaments.length === 0 ? chosen : free}`} aria-pressed={safe.ornaments.length === 0} onClick={() => change({ ornaments: [] })}>
              {t('crest.none')}
            </button>
            {CREST_ORNAMENTS.map((value) => choice('ornament', value, safe.ornaments.includes(value), CREST_LABELS.ornament[value], () => change({ ornaments: safe.ornaments.includes(value) ? safe.ornaments.filter((item) => item !== value) : [...safe.ornaments, value] })))}
          </div>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="font-semibold">{t('crest.animal')}</legend>
          <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto rounded-xl border border-line bg-bg p-2">
            {AVATARS.map((emoji) => (
              <button key={emoji} type="button" className={`grid size-11 place-items-center rounded-lg text-2xl ${safe.animal === emoji ? 'bg-accent/20 ring-2 ring-ink' : 'hover:bg-surface-2'}`} aria-pressed={safe.animal === emoji} aria-label={emoji} onClick={() => change({ animal: emoji })}>
                {emoji}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="flex min-h-11 items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1 size-5 accent-accent" checked={safe.inRoom} onChange={(event) => change({ inRoom: event.target.checked })} />
          <span>
            {t('crest.inRoom')}
            <span className="block text-xs text-muted">{t('crest.inRoomHint')}</span>
          </span>
        </label>
        <Button onClick={onClose}>{t('crest.close')}</Button>
      </div>
    </section>
  );
}
