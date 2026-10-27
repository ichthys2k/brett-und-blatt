/**
 * Bedenkzeit der Bots auf dem Server – als Zahl von Rechenschritten, siehe
 * `serverBotRunner` in packages/online. Die Schrittweiten je Spiel sind so
 * gemessen, dass ein schwerer Bot etwa 0,3 s rechnet (test/bot-timing.test.ts,
 * Stand Oktober 2026, lokal). Auf Cloudflare (Gratis-Tarif) nachgemessen am
 * 26.10.2026, Zug bis Antwort inkl. Netzweg: schwer im Median 0,5–1,1 s,
 * Spitzen bis 1,6 s (Reversi, Mühle, Vier in einer Reihe, Schach).
 */
export const BOT_BUDGET_MS = { easy: 100, medium: 300, hard: 800 };
export const BOT_STEP_MS: Record<string, number> = { chess: 140, checkers: 25, reversi: 35, mill: 16, 'four-in-a-row': 7, go: 2 };
