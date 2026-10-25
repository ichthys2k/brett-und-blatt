/**
 * Bedenkzeit der Bots auf dem Server – als Zahl von Rechenschritten, siehe
 * `serverBotRunner` in packages/online. Die Schrittweiten je Spiel sind so
 * gemessen, dass ein schwerer Bot etwa 0,3 s rechnet (test/bot-timing.test.ts,
 * Stand Oktober 2026, lokal). Auf Cloudflare selbst noch nachmessen.
 */
export const BOT_BUDGET_MS = { easy: 100, medium: 300, hard: 800 };
export const BOT_STEP_MS: Record<string, number> = { chess: 140, reversi: 35, mill: 16, 'four-in-a-row': 7 };
