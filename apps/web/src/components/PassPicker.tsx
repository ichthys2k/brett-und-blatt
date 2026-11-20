import { useEffect, useRef, useState, type FormEvent } from 'react';
import { t } from '../i18n';
import { parseCrest } from '@brett-und-blatt/engine';
import { PlayerCrest } from '@brett-und-blatt/ui';
import { passBook, type PassEntry } from '../lib/passes';
import { afterFailure, askAtStart, checkPin, createPinLock, loadAttempts, PIN_MAX, PIN_MIN, remainingSeconds, saveAttempts, setAskAtStart, takeStartAsk, validPin } from '../lib/passLock';
import { navigate, paths } from '../lib/router';
import { newPass, removePass, switchPass, syncPassEntry } from '../lib/playerPass';
import { Button } from './controls';
import { Avatar } from './Avatar';

type PinTask = { id: string; kind: 'switch' | 'remove' | 'clear' | 'set' };

/** Eingabe einer Geräte-PIN: prüft (oder legt fest) lokal, mit wachsender Wartezeit bei Fehlversuchen (#559). */
function PinForm({ entry, task, onDone, onCancel }: { entry: PassEntry; task: PinTask; onDone: () => void; onCancel: () => void }) {
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const name = entry.name || t('passes.noName');
  const setting = task.kind === 'set';
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => first.current?.focus(), []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (setting) {
      if (!validPin(pin)) return setMessage(t('passes.pinInvalid', { min: PIN_MIN, max: PIN_MAX }));
      if (pin !== again) return setMessage(t('passes.pinMismatch'));
      setBusy(true);
      passBook.setLock(entry.id, await createPinLock(pin));
      saveAttempts(entry.id, null);
      return onDone();
    }
    const wait = remainingSeconds(loadAttempts(entry.id), Date.now());
    if (wait > 0) return setMessage(t('passes.pinWait', { s: wait }));
    setBusy(true);
    const ok = entry.lock ? await checkPin(entry.lock, pin) : true;
    setBusy(false);
    if (!ok) {
      const failed = afterFailure(loadAttempts(entry.id), Date.now());
      saveAttempts(entry.id, failed);
      setPin('');
      const left = remainingSeconds(failed, Date.now());
      return setMessage(left > 0 ? t('passes.pinWait', { s: left }) : t('passes.pinWrong'));
    }
    saveAttempts(entry.id, null);
    if (task.kind === 'clear') passBook.setLock(entry.id, null);
    onDone();
  }

  const heading = setting ? `${t('passes.pinSet')}: ${name}` : task.kind === 'switch' ? t('passes.pinAskSwitch', { name }) : task.kind === 'remove' ? t('passes.pinAskRemove', { name }) : t('passes.pinAskClear', { name });
  return (
    <form className="space-y-2 rounded-xl border border-line bg-surface p-3" onSubmit={(event) => void submit(event)} aria-label={heading}>
      <p className="text-sm font-medium">{heading}</p>
      <label className="block text-sm">
        <span className="mb-1 block text-muted">{setting ? t('passes.pinNew', { min: PIN_MIN, max: PIN_MAX }) : t('passes.pinField')}</span>
        <input ref={first} type="password" inputMode="numeric" autoComplete="off" maxLength={PIN_MAX} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} className="min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-ink" />
      </label>
      {setting && (
        <label className="block text-sm">
          <span className="mb-1 block text-muted">{t('passes.pinRepeat')}</span>
          <input type="password" inputMode="numeric" autoComplete="off" maxLength={PIN_MAX} value={again} onChange={(e) => setAgain(e.target.value.replace(/\D/g, ''))} className="min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-ink" />
        </label>
      )}
      <p role="alert" className="min-h-5 text-sm text-red-700 dark:text-red-300">
        {message}
      </p>
      {setting && <p className="text-xs text-muted">{t('passes.pinNote')}</p>}
      <div className="flex gap-2">
        <Button variant="primary" type="submit" disabled={busy || !pin}>
          {t('passes.pinOk')}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t('passes.pinCancel')}
        </Button>
      </div>
    </form>
  );
}

/** „Wer spielt?“ (#139): Bild des aktiven Passes, antippen öffnet die Passwahl des Geräts. */
export function PassPicker() {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const [version, setVersion] = useState(0);
  const [task, setTask] = useState<PinTask | null>(null);
  const [startAsk, setStartAsk] = useState(askAtStart);

  useEffect(() => {
    syncPassEntry();
    setVersion((v) => v + 1);
    if (takeStartAsk() && passBook.list().length > 0) setOpen(true);
  }, []);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  void version;
  const entries = passBook.list();
  const activeId = passBook.activeId();
  const active = entries.find((entry) => entry.id === activeId);
  const taskEntry = task ? entries.find((entry) => entry.id === task.id) : undefined;

  function confirmRemove(entry: PassEntry) {
    if (!window.confirm(entry.hasCode || entry.guest ? t('passes.removeConfirm') : t('passes.removeNoCode'))) return;
    removePass(entry.id);
    setVersion((v) => v + 1);
  }
  function finishTask() {
    if (!task || !taskEntry) return;
    const { kind } = task;
    setTask(null);
    setVersion((v) => v + 1);
    if (kind === 'switch') switchPass(taskEntry.id);
    else if (kind === 'remove') confirmRemove(taskEntry);
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm font-medium hover:bg-surface-2"
        onClick={() => navigate(paths.pass)}
      >
        {t('pass.chronik.link')}
      </button>
      <button
        type="button"
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm font-medium hover:bg-surface-2"
        aria-label={t('passes.button')}
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true" className="text-xl">
          {active?.avatar ? <Avatar value={active.avatar} /> : '🙂'}
        </span>
        <span className="max-w-32 truncate">{active?.name || t('passes.button')}</span>
      </button>
      <dialog ref={dialog} className="m-auto w-[min(92vw,28rem)] rounded-2xl border border-line bg-bg p-4 text-ink backdrop:bg-black/50" onClose={() => {
          setOpen(false);
          setTask(null);
        }}>
        <div className="space-y-3">
          <h2 className="text-xl font-bold">{t('passes.title')}</h2>
          <p className="text-sm text-muted">{t('passes.intro')}</p>
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-center gap-2 rounded-xl border border-line bg-surface p-2">
                {parseCrest(entry.crest) ? (
                  <span className="text-ink">
                    <PlayerCrest spec={parseCrest(entry.crest)!} size={40} label={t('crest.of', { name: entry.name || t('passes.noName') })} />
                  </span>
                ) : (
                  <span aria-hidden="true" className="text-2xl">
                    {entry.avatar ? <Avatar value={entry.avatar} /> : '🙂'}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{entry.name || t('passes.noName')}</span>
                  {entry.id === activeId && <span className="block text-xs text-muted">{t('passes.active')}</span>}
                  {entry.lock && <span className="block text-xs text-muted">🔒 {t('passes.lockedBadge')}</span>}
                </span>
                {entry.id !== activeId && <Button onClick={() => (entry.lock ? setTask({ id: entry.id, kind: 'switch' }) : switchPass(entry.id))}>{t('passes.choose')}</Button>}
                {entry.id === activeId && !entry.guest && (
                  <Button variant="ghost" onClick={() => setTask({ id: entry.id, kind: entry.lock ? 'clear' : 'set' })}>
                    {entry.lock ? t('passes.pinClear') : t('passes.pinSet')}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  aria-label={`${t('passes.remove')}: ${entry.name || t('passes.noName')}`}
                  onClick={() => {
                    if (entry.lock) return setTask({ id: entry.id, kind: 'remove' });
                    confirmRemove(entry);
                  }}
                >
                  🗑
                </Button>
              </li>
            ))}
          </ul>
          {task && taskEntry && <PinForm key={`${task.id}:${task.kind}`} entry={taskEntry} task={task} onDone={finishTask} onCancel={() => setTask(null)} />}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => newPass()}>
              {t('passes.new')}
            </Button>
            <Button onClick={() => newPass({ guest: true })}>{t('passes.guest')}</Button>
            <Button
              onClick={() => {
                setOpen(false);
                navigate(paths.pass);
              }}
            >
              {t('pass.chronik.link')}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('passes.close')}
            </Button>
          </div>
          <p className="text-xs text-muted">{t('passes.guestHint')}</p>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={startAsk}
              onChange={(event) => {
                setAskAtStart(event.target.checked);
                setStartAsk(event.target.checked);
              }}
            />
            {t('passes.askAtStart')}
          </label>
          <p className="text-xs text-muted">{t('passes.askAtStartHint')}</p>
        </div>
      </dialog>
    </div>
  );
}
