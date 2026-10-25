import { computeBotMove, type BotRequest } from '@brett-und-blatt/engine';
import { loadRules } from './lib/modules';

/** Der Hintergrund-Thread für Bots: bekommt eine Anfrage, schickt einen Zug zurück. */
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<{ id: number; request: BotRequest }>) => void) | null;
  postMessage(message: unknown): void;
};

scope.onmessage = async (event) => {
  const { id, request } = event.data;
  try {
    const module = await loadRules(request.gameId);
    scope.postMessage({ id, move: computeBotMove(module, request, () => performance.now()) });
  } catch (error) {
    scope.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
