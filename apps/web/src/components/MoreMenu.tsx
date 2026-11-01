import { useEffect, useRef, useState, type ReactNode } from 'react';
import { t } from '../i18n';
import { Button } from './controls';

/** Knopf „⋯“ mit selten gebrauchten Knöpfen, für die Kopfzeile am Spieltisch. */
export function MoreMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

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
