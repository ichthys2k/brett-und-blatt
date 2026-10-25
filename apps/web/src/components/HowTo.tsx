import type { GameInfo } from '@brett-und-blatt/engine';
import { t } from '../i18n';
import { Button } from './controls';

/** Die Kurzanleitung eines Spiels als Liste. */
export function HowToList({ info }: { info: GameInfo }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 leading-relaxed">
      {info.howToPlay.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}

/** Anleitung als Einblendung über dem Spielfeld (Knopf „?“ im Spiel). */
export function HowToOverlay({ info, onClose }: { info: GameInfo; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-bg/95 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`${t('howto.title')}: ${info.name}`}>
      <div className="mx-auto max-w-xl space-y-4 rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <h2 className="text-lg font-semibold">
          <span aria-hidden="true">{info.emoji} </span>
          {t('howto.title')}
        </h2>
        <HowToList info={info} />
        <Button variant="primary" className="w-full" onClick={onClose}>
          {t('howto.close')}
        </Button>
      </div>
    </div>
  );
}
