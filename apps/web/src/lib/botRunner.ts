import { computeBotMove, type BotRequest, type BotRunner } from '@brett-und-blatt/engine';
import { loadRules } from './modules';

type Reply = { id: number; move: unknown } | { id: number; error: string };

/**
 * Lässt Bots in einem Web Worker rechnen, damit die Oberfläche flüssig bleibt.
 * Ein Bot „überlegt“ sichtbar mindestens einen kurzen Moment – das fühlt sich
 * natürlicher an als ein Zug im selben Augenblick.
 */
export function createBotRunner(minThinkMs = 450): BotRunner & { dispose(): void } {
  let worker: Worker | null = null;
  let nextId = 1;
  const pending = new Map<number, { resolve: (move: unknown) => void; reject: (error: Error) => void }>();

  const rejectAll = (error: Error) => {
    for (const job of pending.values()) job.reject(error);
    pending.clear();
  };

  const getWorker = (): Worker | null => {
    if (worker) return worker;
    if (typeof Worker === 'undefined') return null;
    try {
      worker = new Worker(new URL('../bot.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      return null;
    }
    worker.onmessage = (event: MessageEvent<Reply>) => {
      const job = pending.get(event.data.id);
      if (!job) return;
      pending.delete(event.data.id);
      if ('error' in event.data) job.reject(new Error(event.data.error));
      else job.resolve(event.data.move);
    };
    worker.onerror = () => {
      rejectAll(new Error('Der Bot-Worker ist ausgefallen.'));
      worker?.terminate();
      worker = null;
    };
    return worker;
  };

  return {
    requestMove(request: BotRequest) {
      const started = performance.now();
      const delay = minThinkMs + Math.random() * 350;
      const withPause = (move: unknown) =>
        new Promise<unknown>((resolve) => setTimeout(() => resolve(move), Math.max(0, delay - (performance.now() - started))));

      const target = getWorker();
      if (!target) {
        // Ohne Worker rechnet der Bot im Hauptfenster.
        return loadRules(request.gameId).then((module) => withPause(computeBotMove(module, request)));
      }
      const id = nextId++;
      return new Promise<unknown>((resolve, reject) => {
        pending.set(id, { resolve: (move) => withPause(move).then(resolve), reject });
        target.postMessage({ id, request });
      });
    },
    dispose() {
      rejectAll(new Error('beendet'));
      worker?.terminate();
      worker = null;
    },
  };
}
