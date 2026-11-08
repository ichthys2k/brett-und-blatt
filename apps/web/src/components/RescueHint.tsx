import { createSync, useSyncState } from '@brett-und-blatt/ui/sync';
import { useState } from 'react';
import { t } from '../i18n';
import { printEmergencyCard } from '../lib/emergencyCard';
import { emergencyCard, emergencyLink, passBlock } from '../lib/playerPass';
import { rescueState } from '../lib/rescue';
import { storage } from '../lib/storage';
import { Button } from './controls';

/** Erinnert an die Rettungskarte, bis sie gedruckt und sicher weggelegt ist (siehe `rescue.ts`). */
export function RescueHint({ onChange }: { onChange?: () => void }) {
  const sync = useSyncState();
  const [marked, setMarked] = useState(() => storage.loadRescue());
  const state = rescueState(storage.loadPlayerCode() !== null, sync.code !== null, marked);
  if (state === 'none' || state === 'ok') return null;

  const card = emergencyCard();
  return (
    <section className="space-y-2 rounded-2xl border-2 border-accent bg-surface p-4" aria-labelledby="rescue-title" role="note">
      <h2 id="rescue-title" className="text-lg font-bold">
        {t('rescue.title')}
      </h2>
      <p className="text-sm">{state === 'create' ? t('rescue.noCode') : t('rescue.text')}</p>
      {state === 'create' ? (
        <Button
          variant="primary"
          disabled={sync.busy}
          onClick={() =>
            void createSync(passBlock).then(() => {
              onChange?.();
            })
          }
        >
          {t('rescue.create')}
        </Button>
      ) : (
        <div className="space-y-2">
          <Button
            variant="primary"
            disabled={!card}
            onClick={() => {
              if (!card) return;
              printEmergencyCard(card, emergencyLink(card.syncCode));
              if (marked === null) {
                storage.saveRescue('gedruckt');
                setMarked('gedruckt');
              }
            }}
          >
            {t('rescue.print')}
          </Button>
          {marked === 'gedruckt' && <p className="text-sm text-muted">{t('rescue.printed')}</p>}
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-5 accent-accent"
              checked={false}
              onChange={() => {
                storage.saveRescue('gesichert');
                setMarked('gesichert');
                onChange?.();
              }}
            />
            {t('rescue.done')}
          </label>
        </div>
      )}
    </section>
  );
}
