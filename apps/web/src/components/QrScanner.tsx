import { useEffect, useRef, useState } from 'react';
import { startScan, scanSupported, type Scan } from '../lib/qrScan';
import { Button } from './controls';

/** Knopf „QR-Code scannen“: öffnet die Kamera, liest einen Raum-QR-Code und meldet den Link. */
export function QrScanner({ onFound }: { onFound: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const scan = useRef<Scan | null>(null);

  useEffect(() => {
    if (!open || !video.current) return;
    let cancelled = false;
    void startScan(
      video.current,
      (text) => {
        setOpen(false);
        onFound(text);
      },
      (error) => setMessage(error),
    ).then((s) => {
      if (cancelled) s.stop();
      else scan.current = s;
    });
    return () => {
      cancelled = true;
      scan.current?.stop();
      scan.current = null;
    };
    // onFound ändert sich bei jedem Aufbau; die Kamera soll deshalb nicht neu starten
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className="space-y-2">
      <Button
        onClick={() => {
          setMessage(scanSupported() ? null : 'Dein Browser kann QR-Codes nicht selbst lesen. Öffne die Kamera-App deines Handys und halte sie auf den Code.');
          setOpen((o) => !o);
        }}
      >
        📷 {open ? 'Scannen beenden' : 'QR-Code scannen'}
      </Button>
      {open && scanSupported() && <video ref={video} className="mx-auto aspect-square w-full max-w-64 rounded-xl bg-black object-cover" playsInline muted aria-label="Kamerabild zum Scannen" />}
      {message && (
        <p className="text-sm text-muted" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
