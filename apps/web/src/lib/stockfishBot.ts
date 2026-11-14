/**
 * Lädt Stockfish (WebAssembly, Einzelthread-Lite-Fassung) erst bei Bedarf in einen
 * eigenen Web Worker und spricht mit ihm über das UCI-Protokoll.
 */

const UCI_MOVE = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/;

interface StockfishMove {
  type: 'move';
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
}

function parseUci(uci: string): StockfishMove | null {
  const match = UCI_MOVE.exec(uci.trim());
  if (!match) return null;
  const promotion = match[3] as StockfishMove['promotion'] | undefined;
  return promotion ? { type: 'move', from: match[1]!, to: match[2]!, promotion } : { type: 'move', from: match[1]!, to: match[2]! };
}

class StockfishEngine {
  private worker: Worker | null = null;
  private ready: Promise<Worker> | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private listener: ((line: string) => void) | null = null;

  private init(): Promise<Worker> {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      if (typeof Worker === 'undefined' || typeof WebAssembly === 'undefined') {
        throw new Error('WebAssembly oder Web Worker nicht verfügbar.');
      }
      const [{ default: jsUrl }, { default: wasmUrl }] = await Promise.all([
        import('stockfish/bin/stockfish-19-lite-single.js?url'),
        import('stockfish/bin/stockfish-19-lite-single.wasm?url'),
      ]);
      const wasmAbsolute = new URL(wasmUrl, window.location.href).href;
      // stockfish-19-lite-single.js liest die WASM-Adresse aus dem Hash der Worker-URL.
      const worker = new Worker(`${jsUrl}#${encodeURIComponent(wasmAbsolute)}`);
      this.worker = worker;

      await new Promise<void>((resolve, reject) => {
        let phase: 'uci' | 'ready' = 'uci';
        const timer = setTimeout(() => reject(new Error('Stockfish-Start hat zu lange gedauert.')), 15_000);
        const fail = () => {
          clearTimeout(timer);
          reject(new Error('Stockfish-Worker konnte nicht gestartet werden.'));
        };
        worker.onerror = fail;
        worker.onmessage = (event: MessageEvent<unknown>) => {
          const line = String(event.data ?? '');
          if (phase === 'uci' && line === 'uciok') {
            phase = 'ready';
            worker.postMessage('isready');
            return;
          }
          if (phase === 'ready' && line === 'readyok') {
            clearTimeout(timer);
            resolve();
            return;
          }
          this.listener?.(line);
        };
        worker.postMessage('uci');
      });

      worker.onmessage = (event: MessageEvent<unknown>) => {
        this.listener?.(String(event.data ?? ''));
      };
      worker.onerror = () => {
        this.dispose();
      };
      return worker;
    })().catch((error) => {
      this.dispose();
      throw error;
    });
    return this.ready;
  }

  bestMove(fen: string, timeBudgetMs: number): Promise<StockfishMove> {
    const task = this.queue.then(async () => {
      const worker = await this.init();
      const movetime = Math.max(150, Math.min(Number.isFinite(timeBudgetMs) ? Math.round(timeBudgetMs) : 1500, 2000));
      return new Promise<StockfishMove>((resolve, reject) => {
        const timer = setTimeout(() => {
          this.listener = null;
          this.dispose();
          reject(new Error('Stockfish-Zeitüberschreitung.'));
        }, movetime + 8000);

        this.listener = (line: string) => {
          if (!line.startsWith('bestmove ')) return;
          clearTimeout(timer);
          this.listener = null;
          const raw = line.slice('bestmove '.length).split(/\s+/)[0] ?? '';
          const parsed = parseUci(raw);
          if (!parsed) reject(new Error(`Ungültiger Stockfish-Zug: ${raw}`));
          else resolve(parsed);
        };

        worker.postMessage(`position fen ${fen}`);
        worker.postMessage(`go movetime ${movetime}`);
      });
    });
    this.queue = task.catch(() => undefined);
    return task;
  }

  dispose(): void {
    this.listener = null;
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
  }
}

let engine: StockfishEngine | null = null;

export function requestStockfishMove(fen: string, timeBudgetMs: number): Promise<StockfishMove> {
  engine ??= new StockfishEngine();
  return engine.bestMove(fen, timeBudgetMs);
}

export function disposeStockfish(): void {
  engine?.dispose();
  engine = null;
}
