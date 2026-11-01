import {
  AVATARS,
  MAX_NAME_LENGTH,
  PHRASES,
  REACTIONS,
  ROOM_CODE_LENGTH,
  ROOM_EMOJIS,
  SIGNAL_INTERVAL_MS,
  SIGNAL_MAX_PER_WINDOW,
  SIGNAL_WINDOW_MS,
  type MemberInfo,
} from '@brett-und-blatt/online';
import { useEffect, useMemo, useRef, useState } from 'react';
import { renderSVG } from 'uqr';
import { t, type MessageKey } from '../i18n';
import type { Signal } from '../lib/online';
import type { Profile } from '../lib/storage';
import { Button } from './controls';

/** Spitzname und Bild – mehr gibt niemand von sich preis. */
export function ProfileForm({ initial, onSave, submitLabel }: { initial: Profile | null; onSave: (profile: Profile) => void; submitLabel: string }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [avatar, setAvatar] = useState(initial?.avatar ?? AVATARS[0]);
  const [error, setError] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Beim ersten Rendern zum bereits ausgewählten Avatar scrollen
  useEffect(() => {
    if (avatar) {
      const el = listRef.current?.querySelector<HTMLElement>(`[data-avatar="${CSS.escape(avatar)}"]`);
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, []);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return setError(true);
    onSave({ name: trimmed, avatar });
  };

  const pickRandom = () => {
    const next = AVATARS[Math.floor(Math.random() * AVATARS.length)];
    setAvatar(next);
    requestAnimationFrame(() => {
      const el = listRef.current?.querySelector<HTMLElement>(`[data-avatar="${CSS.escape(next)}"]`);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="flex items-end gap-3">
        <label className="block flex-1 space-y-1">
          <span className="text-sm font-medium">{t('online.name')}</span>
          <input
            className="min-h-11 w-full rounded-xl border border-line bg-surface px-3"
            value={name}
            maxLength={MAX_NAME_LENGTH}
            placeholder={t('online.namePlaceholder')}
            autoComplete="nickname"
            onChange={(event) => {
              setName(event.target.value);
              setError(false);
            }}
          />
        </label>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-muted">{t('online.avatar')}</span>
          <div
            className="grid size-11 place-items-center rounded-xl bg-accent/20 text-2xl ring-2 ring-accent shadow-sm"
            aria-label={`Ausgewählt: ${avatar}`}
            title={`Ausgewählt: ${avatar}`}
          >
            {avatar}
          </div>
        </div>
      </div>
      {error && <p className="text-sm text-danger">{t('online.badName')}</p>}

      <fieldset className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <legend className="text-sm font-medium">{t('online.avatar')}</legend>
          <button
            type="button"
            onClick={pickRandom}
            className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink transition hover:bg-surface-3 active:scale-95"
            title={t('online.avatarRandom')}
          >
            <span aria-hidden="true">🎲</span>
            <span>{t('online.avatarRandom')}</span>
          </button>
        </div>

        {/* Flache Auswahl ohne Kategorien */}
        <div
          ref={listRef}
          className="flex max-h-72 flex-wrap gap-1 overflow-y-auto rounded-xl border border-line/50 bg-surface/50 p-2 sm:max-h-84"
        >
          {AVATARS.map((emoji) => {
            const isSelected = emoji === avatar;
            return (
              <button
                key={emoji}
                type="button"
                data-avatar={emoji}
                aria-pressed={isSelected}
                className={`grid size-11 shrink-0 place-items-center rounded-xl text-2xl transition hover:scale-105 active:scale-95 ${
                  isSelected ? 'bg-accent/20 ring-2 ring-accent' : 'bg-surface-2 hover:bg-surface-3'
                }`}
                onClick={() => setAvatar(emoji)}
              >
                {emoji}
              </button>
            );
          })}
        </div>
      </fieldset>

      <Button variant="primary" type="submit" className="w-full">
        {submitLabel}
      </Button>
    </form>
  );
}

/** Raumcode eingeben, ohne Tastatur: die vier Bilder antippen. */
export function EmojiKeypad({ onComplete }: { onComplete: (code: string) => void }) {
  const [parts, setParts] = useState<string[]>([]);
  // Jede Eingabe baut auf dem neuesten Stand auf – auch bei sehr schnellem Tippen.
  const add = (emoji: string) => setParts((current) => (current.length >= ROOM_CODE_LENGTH ? current : [...current, emoji]));
  const complete = parts.length === ROOM_CODE_LENGTH ? parts.join('') : null;
  useEffect(() => {
    if (complete) onComplete(complete);
    // onComplete absichtlich nicht als Abhängigkeit: Nur ein neuer vollständiger Code löst aus.
  }, [complete]);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 justify-center gap-2" aria-live="polite">
          {Array.from({ length: ROOM_CODE_LENGTH }, (_, i) => (
            <span key={i} className="grid size-10 place-items-center rounded-xl border border-line bg-surface text-2xl sm:size-12 sm:text-3xl">
              {parts[i] ?? ''}
            </span>
          ))}
        </div>
        <Button variant="ghost" aria-label={t('online.codeDelete')} title={t('online.codeDelete')} disabled={parts.length === 0} onClick={() => setParts(parts.slice(0, -1))}>
          ⌫
        </Button>
      </div>
      <div className="mx-auto grid max-w-xs grid-cols-4 gap-2">
        {ROOM_EMOJIS.map((emoji) => (
          <button key={emoji} type="button" className="grid aspect-square place-items-center rounded-xl bg-surface-2 text-3xl hover:bg-line" onClick={() => add(emoji)}>
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

/** QR-Code als SVG – erzeugt aus der eigenen Einladungsadresse, ohne fremden Dienst. */
export function QrCode({ text, label }: { text: string; label: string }) {
  const svg = useMemo(() => renderSVG(text, { border: 2, whiteColor: '#ffffff', blackColor: '#1f2328' }), [text]);
  return <div role="img" aria-label={label} className="mx-auto w-full max-w-56 overflow-hidden rounded-xl bg-white [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** Emoji-Reaktionen und Schnellnachrichten – freien Text gibt es nicht. */
export function ReactionBar({ onReact, onSay, phrases: tablePhrases = PHRASES }: { onReact: (emoji: string) => void; onSay: (phrase: string) => void; phrases?: readonly string[] }) {
  const [phrases, setPhrases] = useState(false);
  const [timestamps, setTimestamps] = useState<number[]>([]);
  const [cooldown, setCooldown] = useState(false);
  const [, setTick] = useState(0);

  const now = Date.now();
  const recent = timestamps.filter((t) => now - t < SIGNAL_WINDOW_MS);
  const isRateLimited = recent.length >= SIGNAL_MAX_PER_WINDOW;
  const disabled = cooldown || isRateLimited;

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown(false), SIGNAL_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (!isRateLimited) return;
    const oldest = recent[0] ?? now;
    const remaining = Math.max(0, SIGNAL_WINDOW_MS - (Date.now() - oldest) + 50);
    const timer = window.setTimeout(() => setTick((t) => t + 1), remaining);
    return () => window.clearTimeout(timer);
  }, [isRateLimited, recent, now]);

  const trigger = (action: () => void) => {
    if (disabled) return;
    const timestamp = Date.now();
    action();
    setTimestamps((prev) => [...prev.filter((t) => timestamp - t < SIGNAL_WINDOW_MS), timestamp]);
    setCooldown(true);
  };

  return (
    <div className="order-3 space-y-2 px-3 pt-2" aria-label={t('online.reactions')}>
      <div className="flex flex-wrap justify-center gap-1">
        {REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            disabled={disabled}
            className="grid size-10 place-items-center rounded-full bg-surface-2 text-xl hover:bg-line disabled:pointer-events-none disabled:opacity-40"
            onClick={() => trigger(() => onReact(emoji))}
          >
            {emoji}
          </button>
        ))}
        <button type="button" aria-expanded={phrases} className="grid size-10 place-items-center rounded-full bg-surface-2 text-xl hover:bg-line" onClick={() => setPhrases(!phrases)}>
          💬
        </button>
      </div>
      {isRateLimited && (
        <p className="text-center text-xs text-muted" role="status">
          {t('online.rateLimit')}
        </p>
      )}
      {phrases && (
        <div className="flex flex-wrap justify-center gap-1">
          {tablePhrases.map((phrase) => (
            <button
              key={phrase}
              type="button"
              disabled={disabled}
              className="rounded-full bg-surface-2 px-3 py-1.5 text-sm hover:bg-line disabled:pointer-events-none disabled:opacity-40"
              onClick={() => {
                trigger(() => {
                  onSay(phrase);
                  setPhrases(false);
                });
              }}
            >
              {phraseText(phrase)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function phraseText(phrase: string): string {
  return (PHRASES as readonly string[]).includes(phrase) ? t(`phrase.${phrase}` as MessageKey) : '';
}

/** Kurz eingeblendete Reaktionen der anderen. */
export function SignalToasts({ signals, members }: { signals: Signal[]; members: MemberInfo[] }) {
  if (signals.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),0.75rem)] z-20 flex flex-col items-center gap-1 side:inset-x-auto side:right-4 side:top-4 side:items-end" aria-live="polite">
      {signals.map((signal) => {
        const member = members.find((m) => m.id === signal.from);
        return (
          <div key={signal.id} className="flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 shadow-md">
            <span aria-hidden="true">{member?.avatar}</span>
            <span className="text-sm font-medium">{member?.name}</span>
            <span className={signal.kind === 'react' ? 'text-2xl' : 'text-sm'}>{signal.kind === 'react' ? signal.value : phraseText(signal.value)}</span>
          </div>
        );
      })}
    </div>
  );
}
