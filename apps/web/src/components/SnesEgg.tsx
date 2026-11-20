import { useCallback, useEffect, useRef, useState } from 'react';
import { SNES_OPEN_EVENT, resetSnesSave } from '../lib/snesEgg';

/**
 * Easter Egg (#596): „Brett & Blatt 16“ im Browser. Der Dialog ist erst nach dem Auslöser
 * (siehe `lib/snesEgg.ts`) im DOM; erst dann lädt der Iframe Emulator und ROM unter `snes/`.
 */
export function SnesEgg() {
  const [open, setOpen] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);
  const dialog = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    frame.current?.contentWindow?.postMessage('speichern', window.location.origin);
    // Kurz warten, damit der Spielstand noch geschrieben wird, bevor der Iframe verschwindet.
    window.setTimeout(() => setOpen(false), 150);
  }, []);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(SNES_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(SNES_OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // Tasten im Iframe erreichen diese Seite nicht; Escape schließt also nur, solange der Fokus außerhalb liegt.
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    dialog.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open) return null;

  const base = import.meta.env.BASE_URL;
  const reset = async () => {
    if (!window.confirm('Gespeicherte Statistik von „Brett & Blatt 16“ wirklich löschen?')) return;
    setOpen(false);
    await resetSnesSave();
    setFrameKey((k) => k + 1);
    window.setTimeout(() => setOpen(true), 50);
  };

  return (
    <div className="bub-snes-backdrop" role="dialog" aria-modal="true" aria-label="Brett & Blatt 16 (Super Nintendo)" ref={dialog} tabIndex={-1}>
      <div className="bub-snes-bar">
        <span className="bub-snes-title">Brett &amp; Blatt 16</span>
        <button type="button" className="bub-snes-btn" onClick={reset}>
          Spielstand löschen
        </button>
        <button type="button" className="bub-snes-btn" onClick={close} aria-label="Schließen">
          ✕ Schließen
        </button>
      </div>
      <iframe
        key={frameKey}
        ref={frame}
        className="bub-snes-frame"
        title="Brett & Blatt 16 im Emulator"
        src={`${base}snes/index.html`}
        allow="autoplay; gamepad; fullscreen"
        referrerPolicy="no-referrer"
      />
      <p className="bub-snes-hint">Steuerung: Pfeiltasten, X = A, Z = B, Enter = Start. Am Handy erscheinen Tasten auf dem Bildschirm.</p>
    </div>
  );
}
