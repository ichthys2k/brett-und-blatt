/**
 * QR-Code mit der Kamera lesen (#394), ohne fremde Bibliothek: nur der `BarcodeDetector` des
 * Browsers (Chrome/Android, Edge, neuere Desktop-Chromes). Wo er fehlt, bleibt die Kamera-App
 * des Handys, die den Link ohnehin öffnet. Das Bild verlässt das Gerät nie.
 */
interface DetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
type DetectorCtor = new (options?: { formats: string[] }) => DetectorLike;

function detectorClass(): DetectorCtor | null {
  const ctor = (globalThis as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
  return typeof ctor === 'function' ? ctor : null;
}

/** Kann dieser Browser QR-Codes selbst lesen und hat er eine Kamera-Schnittstelle? */
export function scanSupported(): boolean {
  return detectorClass() !== null && typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
}

/** Nimmt aus dem gelesenen Text einen Raum-Link oder Code; alles andere wird verworfen. */
export function roomTextFromQr(raw: string): string | null {
  const text = raw.trim();
  if (text.length === 0 || text.length > 300) return null;
  return /#\/raum\/[^/?#\s]+/.test(text) ? text : null;
}

export interface Scan {
  stop(): void;
}

/** Startet die Kamera im `video`-Element und ruft `onFound` beim ersten Raum-QR-Code; Fehler (z. B. Kamera verweigert) gehen an `onError`. */
export async function startScan(video: HTMLVideoElement, onFound: (text: string) => void, onError: (message: string) => void): Promise<Scan> {
  const Detector = detectorClass();
  let stream: MediaStream | null = null;
  let stopped = false;
  const stop = () => {
    stopped = true;
    for (const track of stream?.getTracks() ?? []) track.stop();
    video.srcObject = null;
  };
  if (!Detector) {
    onError('Dein Browser kann QR-Codes nicht selbst lesen. Öffne die Kamera-App deines Handys und halte sie auf den Code.');
    return { stop };
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  } catch {
    onError('Die Kamera ist nicht freigegeben.');
    return { stop };
  }
  video.srcObject = stream;
  await video.play().catch(() => {});
  const detector = new Detector({ formats: ['qr_code'] });
  const tick = async () => {
    if (stopped) return;
    try {
      for (const hit of await detector.detect(video)) {
        const text = roomTextFromQr(hit.rawValue);
        if (text) {
          stop();
          onFound(text);
          return;
        }
      }
    } catch {
      // einzelne Bilder dürfen scheitern
    }
    window.setTimeout(tick, 250);
  };
  void tick();
  return { stop };
}
