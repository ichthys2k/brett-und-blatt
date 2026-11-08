import { useEffect, useRef } from 'react';
import { t } from '../i18n';
import { useNote } from '../lib/notes';
import { Button } from './controls';

interface NotesProps {
  /** Schlüssel der Partie (`notesKey`). */
  gameKey: string;
  /** Wessen Notizblock: `ich` oder die Platznummer (Hot-Seat). */
  seat: string;
  /** Beschriftung, z. B. der Name beim Hot-Seat. */
  owner?: string;
  onClose(): void;
}

/** Notizblock zur Partie (#105): einfaches Textfeld, speichert bei jeder Eingabe auf diesem Gerät. */
export function Notes({ gameKey, seat, owner, onClose }: NotesProps) {
  const [text, setText] = useNote(gameKey, seat);
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    area.current?.focus();
  }, []);
  return (
    <div className="absolute inset-0 z-40 flex flex-col gap-2 bg-bg p-3" role="dialog" aria-label={t('notes.title')} onKeyDown={(event) => event.key === 'Escape' && onClose()}>
      <h2 className="text-lg font-semibold">
        📝 {t('notes.title')}
        {owner ? ` – ${owner}` : ''}
      </h2>
      <textarea
        ref={area}
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={4000}
        placeholder={t('notes.placeholder')}
        className="min-h-0 w-full flex-1 resize-none rounded-md border border-line bg-surface p-3 text-base"
      />
      <p className="text-xs text-muted">{t('notes.hint')}</p>
      <div className="flex gap-2">
        <Button variant="primary" onClick={onClose}>
          {t('notes.close')}
        </Button>
        <Button variant="ghost" disabled={text === ''} onClick={() => setText('')}>
          {t('notes.clear')}
        </Button>
      </div>
    </div>
  );
}
