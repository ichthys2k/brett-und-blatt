import { useCallback, useRef, useState, type ReactNode } from 'react';
import { t } from '../i18n';
import { Button } from './controls';
import { useDismiss } from './useDismiss';

/** Knopf „⋯“ mit selten gebrauchten Knöpfen, für die Kopfzeile am Spieltisch. */
export function MoreMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useDismiss(open, useCallback(() => setOpen(false), []), box);

  return (
    <div ref={box} className="relative">
      <Button variant="ghost" className="px-3" aria-label={t('play.more')} title={t('play.more')} aria-expanded={open} onClick={() => setOpen(!open)}>
        ⋯
      </Button>
      {open && (
        <div className="absolute top-full right-0 z-30 mt-1 flex w-52 flex-col gap-1 rounded-xl border border-line bg-surface p-2 shadow-md [&>button]:w-full" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}
