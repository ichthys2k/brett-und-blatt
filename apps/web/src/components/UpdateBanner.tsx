import { t } from '../i18n';
import { applyUpdateNow, useUpdateReady } from '../lib/appUpdate';
import { Button } from './controls';

/** Hinweisleiste „Neue Version verfügbar“ (#175): erscheint nur, wenn eine Version wartet (also in einer Partie). */
export function UpdateBanner() {
  const ready = useUpdateReady();
  if (!ready) return null;
  return (
    <div role="status" className="fixed inset-x-0 bottom-0 z-[60] flex items-center justify-center gap-3 border-t border-line bg-surface px-3 py-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] shadow-lg">
      <span className="text-sm">{t('update.available')}</span>
      <Button variant="primary" className="min-h-9 px-3 text-sm" onClick={applyUpdateNow}>
        {t('update.apply')}
      </Button>
    </div>
  );
}
