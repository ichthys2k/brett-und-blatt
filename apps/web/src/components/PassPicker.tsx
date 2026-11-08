import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n';
import { passBook } from '../lib/passes';
import { navigate, paths } from '../lib/router';
import { newPass, removePass, switchPass, syncPassEntry } from '../lib/playerPass';
import { Button } from './controls';

/** „Wer spielt?“ (#139): Bild des aktiven Passes, antippen öffnet die Passwahl des Geräts. */
export function PassPicker() {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    syncPassEntry();
    setVersion((v) => v + 1);
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

  return (
    <>
      <button
        type="button"
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm font-medium hover:bg-surface-2"
        aria-label={t('passes.button')}
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true" className="text-xl">
          {active?.avatar || '🙂'}
        </span>
        <span className="max-w-32 truncate">{active?.name || t('passes.button')}</span>
      </button>
      <dialog ref={dialog} className="m-auto w-[min(92vw,28rem)] rounded-2xl border border-line bg-bg p-4 text-ink backdrop:bg-black/50" onClose={() => setOpen(false)}>
        <div className="space-y-3">
          <h2 className="text-xl font-bold">{t('passes.title')}</h2>
          <p className="text-sm text-muted">{t('passes.intro')}</p>
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-center gap-2 rounded-xl border border-line bg-surface p-2">
                <span aria-hidden="true" className="text-2xl">
                  {entry.avatar || '🙂'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{entry.name || t('passes.noName')}</span>
                  {entry.id === activeId && <span className="block text-xs text-muted">{t('passes.active')}</span>}
                </span>
                {entry.id !== activeId && <Button onClick={() => switchPass(entry.id)}>{t('passes.choose')}</Button>}
                <Button
                  variant="ghost"
                  aria-label={`${t('passes.remove')}: ${entry.name || t('passes.noName')}`}
                  onClick={() => {
                    if (!window.confirm(entry.hasCode || entry.guest ? t('passes.removeConfirm') : t('passes.removeNoCode'))) return;
                    removePass(entry.id);
                    setVersion((v) => v + 1);
                  }}
                >
                  🗑
                </Button>
              </li>
            ))}
          </ul>
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
        </div>
      </dialog>
    </>
  );
}
