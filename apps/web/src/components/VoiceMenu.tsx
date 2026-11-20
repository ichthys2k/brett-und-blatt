/**
 * Sprachchat (#352): Knopf 🎙 neben den Reaktionen. Aufgeklappt: mitsprechen, stumm, aussteigen,
 * einzelne Mitspieler für sich stumm schalten, sehen, wer spricht, und eine Person melden (sie ist
 * dann für alle stumm, bis die Raumleitung sie freigibt). Nur in privaten Räumen und nur, wenn die
 * Raumleitung den Sprachchat erlaubt hat; den Schalter dafür sieht nur sie.
 */
import type { MemberInfo } from '@brett-und-blatt/online';
import type { VoiceChat, VoiceState } from '@brett-und-blatt/rtc';
import { useCallback, useRef, useState } from 'react';
import { t } from '../i18n';
import { Button } from './controls';
import { useDismiss } from './useDismiss';
import { Avatar } from './Avatar';

export function VoiceMenu({
  voice,
  state,
  members,
  you,
  off,
  isHost,
  onAllow,
  onReport,
  onRelease,
  inBar,
}: {
  voice: VoiceChat | null;
  state: VoiceState;
  members: readonly MemberInfo[];
  you: string | null;
  off: 'public' | 'closed' | 'reported' | undefined;
  isHost: boolean;
  onAllow: (allowed: boolean) => void;
  onReport: (member: string) => void;
  onRelease: (member: string) => void;
  inBar?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useDismiss(open, useCallback(() => setOpen(false), []), box);
  // Öffentliche Räume und nicht erlaubter Sprachchat: kein Knopf, damit niemand ins Leere tippt.
  // Die Raumleitung sieht ihn in privaten Räumen immer, weil dort ihr Schalter sitzt.
  if (off === 'public' || !voice || (off === 'closed' && !isHost)) return null;
  const others = members.filter((m) => m.voice && m.id !== you);
  const mutedMembers = members.filter((m) => m.voiceMuted);
  const mutedYou = mutedMembers.some((m) => m.id === you);
  const someoneSpeaks = others.some((m) => state.speaking.includes(m.id));
  const icon = state.joined ? (state.muted ? '🔇' : someoneSpeaks ? '🔊' : '🎙') : '🎙';
  return (
    <div ref={box} className="bub-voice relative flex-none">
      <Button
        variant={state.joined && !state.muted ? 'primary' : 'ghost'}
        className="px-3 text-lg"
        aria-label={t('voice.title')}
        title={t('voice.title')}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {icon}
        {!state.joined && others.length > 0 && <span className="ml-1 text-xs">{others.length}</span>}
      </Button>
      {open && (
        <div
          role="dialog"
          aria-label={t('voice.title')}
          className={`z-30 space-y-2 rounded-xl border border-line bg-surface p-3 shadow-md ${inBar ? 'absolute top-full right-0 mt-1 w-72' : 'fixed inset-x-3 top-[calc(env(safe-area-inset-top)+3.5rem)] mx-auto max-w-sm side:top-12 side:right-auto side:left-2 side:mx-0 side:w-72'}`}
        >
          <p className="font-semibold">{t('voice.title')}</p>
          {isHost && (
            <label className="flex cursor-pointer select-none items-start gap-2 border-b border-line pb-2">
              <input type="checkbox" checked={off !== 'closed'} onChange={(e) => onAllow(e.target.checked)} className="mt-1 h-4 w-4 rounded accent-accent" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{t('voice.allow')}</span>
                <span className="block text-xs text-muted">{t('voice.allowHint')}</span>
              </span>
            </label>
          )}
          {isHost && mutedMembers.length > 0 && (
            <div className="border-b border-line pb-2">
              <p className="text-xs text-muted">{t('voice.mutedList')}</p>
              <ul className="space-y-1">
                {mutedMembers.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>
                      <Avatar value={m.avatar} /> {m.name}
                    </span>
                    <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => onRelease(m.id)}>
                      {t('voice.release')}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {off === 'closed' ? (
            <p className="text-sm text-muted">{t('voice.closed')}</p>
          ) : off === 'reported' ? (
            <p className="text-sm">{t('voice.reported')}</p>
          ) : mutedYou ? (
            <p role="status" className="text-sm">
              {t('voice.mutedYou')}
            </p>
          ) : !state.joined ? (
            <>
              <p className="text-xs text-muted">{t('voice.joinHint')}</p>
              {state.error && (
                <p role="alert" className="text-sm text-danger">
                  {t('voice.denied')}
                </p>
              )}
              <p className="text-sm">{others.length ? t('voice.others', { names: others.map((m) => `${m.avatar} ${m.name}`).join(', ') }) : t('voice.nobody')}</p>
              <Button variant="primary" className="w-full" onClick={() => void voice.join()}>
                {t('voice.join')}
              </Button>
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Button aria-pressed={state.muted} onClick={() => voice.setMuted(!state.muted)}>
                  {state.muted ? t('voice.unmute') : t('voice.mute')}
                </Button>
                <Button variant="ghost" onClick={() => voice.leave()}>
                  {t('voice.leave')}
                </Button>
              </div>
              {others.length === 0 ? (
                <p className="text-sm text-muted">{t('voice.nobody')}</p>
              ) : (
                <ul className="space-y-1">
                  {others.map((m) => {
                    const silenced = state.silenced.includes(m.id);
                    return (
                      <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                        <span>
                          {state.speaking.includes(m.id) ? '🔊 ' : ''}
                          <Avatar value={m.avatar} /> {m.name}
                        </span>
                        <span className="flex flex-none gap-1">
                          <Button variant="ghost" className="px-2 py-1 text-xs" aria-pressed={silenced} onClick={() => voice.silence(m.id, !silenced)}>
                            {silenced ? t('voice.unsilence') : t('voice.silence')}
                          </Button>
                          <Button
                            variant="ghost"
                            className="px-2 py-1 text-xs text-danger"
                            aria-label={t('voice.reportOne', { name: m.name })}
                            onClick={() => {
                              if (window.confirm(t('voice.reportConfirm', { name: m.name }))) onReport(m.id);
                            }}
                          >
                            {t('voice.report')}
                          </Button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
