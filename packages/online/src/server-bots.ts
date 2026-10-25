import { computeBotMove, type AnyGameModule, type BotRunner } from '@brett-und-blatt/engine';

/**
 * Bot-Läufer für den Server. In Cloudflare Workers steht die Uhr während einer
 * Berechnung still (`Date.now()` rückt erst nach Ein- und Ausgaben weiter). Bots,
 * die bis zum Ablauf ihrer Bedenkzeit suchen, kämen so nie zum Ende.
 *
 * Deshalb bekommen sie eine Zähl-Uhr: Jeder Blick auf die Uhr lässt sie um
 * `stepMs` weiterspringen. Aus der Bedenkzeit wird so eine feste Zahl von
 * Rechenschritten – die Suche endet sicher, auch ohne echte Zeitmessung.
 *
 * Wie teuer ein Schritt ist, hängt vom Spiel ab (Schach schaut z. B. alle 256
 * Stellungen auf die Uhr, und jede Stellung ist teuer). Deshalb lässt sich die
 * Schrittweite je Spiel angeben.
 */
export function serverBotRunner(modules: AnyGameModule[], options: { stepMs?: number | Record<string, number> } = {}): BotRunner {
  const byId = new Map(modules.map((m) => [m.info.id, m]));
  const stepOf = (gameId: string) => (typeof options.stepMs === 'number' ? options.stepMs : (options.stepMs?.[gameId] ?? 1));
  return {
    requestMove(request) {
      const module = byId.get(request.gameId);
      if (!module) return Promise.reject(new Error(`Unbekanntes Spiel: ${request.gameId}`));
      const stepMs = stepOf(request.gameId);
      let ticks = 0;
      const now = () => (ticks += stepMs);
      try {
        return Promise.resolve(computeBotMove(module, request, now));
      } catch (error) {
        return Promise.reject(error);
      }
    },
  };
}
