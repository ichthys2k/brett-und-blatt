import { useEffect, useMemo, useState } from 'react';
import { Button, Section } from '../controls';
import { loadHelperState, parseEntryList, randomInt, saveHelperState } from '../../lib/helpers';
import { sound } from '../../lib/sound';

interface StoredRandomPrefs {
  min: number;
  max: number;
  listRaw: string;
  withoutReplace: boolean;
  remaining: string[] | null;
}

const DEFAULT_PREFS: StoredRandomPrefs = {
  min: 1,
  max: 100,
  listRaw: 'Rot\nBlau\nGrün\nGelb',
  withoutReplace: true,
  remaining: null,
};

export function RandomHelper() {
  const initial = useMemo(() => loadHelperState<StoredRandomPrefs>('zufall', DEFAULT_PREFS), []);

  // 1. Münze
  const [coin, setCoin] = useState<'Kopf' | 'Zahl' | null>(null);
  const [coinStats, setCoinStats] = useState({ kopf: 0, zahl: 0 });
  const [coinTick, setCoinTick] = useState(0);

  // 2. Zufallszahl
  const [minVal, setMinVal] = useState(Number.isFinite(initial.min) ? initial.min : 1);
  const [maxVal, setMaxVal] = useState(Number.isFinite(initial.max) ? initial.max : 100);
  const [randomNumber, setRandomNumber] = useState<number | null>(null);
  const [numHistory, setNumHistory] = useState<number[]>([]);

  // 3. Aus Liste ziehen
  const [listRaw, setListRaw] = useState(initial.listRaw ?? DEFAULT_PREFS.listRaw);
  const [withoutReplace, setWithoutReplace] = useState(initial.withoutReplace ?? true);
  const [remaining, setRemaining] = useState<string[] | null>(Array.isArray(initial.remaining) ? initial.remaining : null);
  const [drawn, setDrawn] = useState<string | null>(null);
  const [drawHistory, setDrawHistory] = useState<string[]>([]);

  const allItems = useMemo(() => parseEntryList(listRaw), [listRaw]);

  useEffect(() => {
    saveHelperState<StoredRandomPrefs>('zufall', {
      min: minVal,
      max: maxVal,
      listRaw,
      withoutReplace,
      remaining,
    });
  }, [minVal, maxVal, listRaw, withoutReplace, remaining]);

  const flipCoin = () => {
    const next: 'Kopf' | 'Zahl' = randomInt(0, 1) === 0 ? 'Kopf' : 'Zahl';
    setCoin(next);
    setCoinTick((t) => t + 1);
    setCoinStats((s) => ({
      kopf: s.kopf + (next === 'Kopf' ? 1 : 0),
      zahl: s.zahl + (next === 'Zahl' ? 1 : 0),
    }));
    sound.play('poker-call');
  };

  const rollNumber = () => {
    const val = randomInt(minVal, maxVal);
    setRandomNumber(val);
    setNumHistory((prev) => [val, ...prev].slice(0, 8));
    sound.play('wuerfel-einzeln');
  };

  const activePool = withoutReplace ? (remaining ?? allItems) : allItems;

  const drawFromList = () => {
    if (activePool.length === 0) return;
    const idx = randomInt(0, activePool.length - 1);
    const picked = activePool[idx]!;
    setDrawn(picked);
    setDrawHistory((prev) => [picked, ...prev].slice(0, 10));
    if (withoutReplace) {
      const nextRemaining = [...activePool];
      nextRemaining.splice(idx, 1);
      setRemaining(nextRemaining);
    }
    sound.play('karte-ziehen');
  };

  const resetPool = () => {
    setRemaining(null);
    setDrawn(null);
    setDrawHistory([]);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Section title="Münze werfen">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface-2 p-4">
            <div
              key={coinTick}
              aria-live="polite"
              className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-accent/60 bg-surface text-lg font-bold shadow-md motion-safe:animate-[pop_260ms_ease-out]"
            >
              {coin ? (
                <span className="flex flex-col items-center leading-tight">
                  <span aria-hidden="true" className="text-2xl">{coin === 'Kopf' ? '👑' : '🔢'}</span>
                  <span className="text-xs font-semibold">{coin}</span>
                </span>
              ) : (
                <span className="text-2xl" aria-hidden="true">🪙</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted tabular-nums">
              <span>Kopf: {coinStats.kopf}</span>
              <span>·</span>
              <span>Zahl: {coinStats.zahl}</span>
            </div>
            <Button variant="primary" onClick={flipCoin} className="w-full">
              🪙 Münze werfen
            </Button>
          </div>
        </Section>

        <Section title="Zufallszahl">
          <div className="flex flex-col justify-between gap-3 rounded-2xl border border-line bg-surface-2 p-4">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-muted">
                Von
                <input
                  type="number"
                  value={minVal}
                  onChange={(e) => setMinVal(Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink focus:border-accent focus:outline-none"
                />
              </label>
              <label className="text-xs text-muted">
                Bis
                <input
                  type="number"
                  value={maxVal}
                  onChange={(e) => setMaxVal(Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink focus:border-accent focus:outline-none"
                />
              </label>
            </div>

            <div aria-live="polite" className="flex min-h-14 items-center justify-center rounded-xl bg-surface px-3 py-2">
              {randomNumber !== null ? (
                <strong className="text-3xl font-bold tabular-nums text-accent">{randomNumber}</strong>
              ) : (
                <span className="text-sm text-muted">Noch keine Zahl gezogen</span>
              )}
            </div>

            {numHistory.length > 0 && (
              <p className="truncate text-xs text-muted">Zuletzt: {numHistory.join(', ')}</p>
            )}

            <Button variant="primary" onClick={rollNumber} className="w-full">
              🔢 Zahl ziehen
            </Button>
          </div>
        </Section>
      </div>

      <Section title="Aus einer Liste ziehen">
        <div className="space-y-3 rounded-2xl border border-line bg-surface-2 p-4">
          <label className="block text-xs text-muted">
            Einträge (einer pro Zeile oder mit Komma getrennt):
            <textarea
              rows={4}
              value={listRaw}
              onChange={(e) => {
                setListRaw(e.target.value);
                setRemaining(null);
              }}
              placeholder="z. B. Aufgaben, Namen oder Begriffe"
              className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={withoutReplace}
                onChange={(e) => {
                  setWithoutReplace(e.target.checked);
                  setRemaining(null);
                }}
                className="h-4 w-4 accent-accent"
              />
              <span>Ohne Zurücklegen</span>
            </label>
            <span className="text-xs text-muted tabular-nums">
              Im Stapel: {activePool.length} / {allItems.length}
            </span>
          </div>

          <div aria-live="polite" className="flex min-h-14 items-center justify-center rounded-xl border border-line bg-surface px-4 py-3 text-center">
            {drawn ? (
              <strong className="text-xl font-bold text-accent">{drawn}</strong>
            ) : activePool.length === 0 ? (
              <span className="text-sm text-muted">Der Stapel ist leer – fülle ihn wieder auf.</span>
            ) : (
              <span className="text-sm text-muted">Bereit zum Ziehen</span>
            )}
          </div>

          {drawHistory.length > 0 && (
            <p className="text-xs text-muted">Gezogen: {drawHistory.join(' · ')}</p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={drawFromList} disabled={activePool.length === 0} className="flex-1">
              🎟️ Ziehen
            </Button>
            {(remaining !== null || drawHistory.length > 0) && (
              <Button variant="secondary" onClick={resetPool}>
                Stapel auffüllen
              </Button>
            )}
          </div>
        </div>
      </Section>
    </div>
  );
}
