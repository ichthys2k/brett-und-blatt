/** Die zuletzt gespielten Spiele ohne Doppelte, neueste zuerst, höchstens `limit`; unbekannte ids fallen weg (#615). */
export function recentGameIds(recent: readonly { gameId: string; endedAt: number }[], known: ReadonlySet<string>, limit = 10): string[] {
  const ids: string[] = [];
  for (const entry of [...recent].sort((a, b) => b.endedAt - a.endedAt)) {
    if (!known.has(entry.gameId) || ids.includes(entry.gameId)) continue;
    ids.push(entry.gameId);
    if (ids.length >= limit) break;
  }
  return ids;
}
