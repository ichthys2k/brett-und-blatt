import { useEffect, useRef, useState } from 'react';
import { Button, PlayerCount, Section, Segmented } from '../controls';
import { formatCountdownMs } from '../../lib/helpers';
import { sound } from '../../lib/sound';

type TimerMode = 'hourglass' | 'chess';

const HOURGLASS_PRESETS = [
  { label: '30 s', sec: 30 },
  { label: '1 min', sec: 60 },
  { label: '2 min', sec: 120 },
  { label: '3 min', sec: 180 },
  { label: '5 min', sec: 300 },
];

const CHESS_MINUTES = [1, 3, 5, 10, 15];
const CHESS_INCREMENTS = [0, 2, 5, 10];

export function TimerHelper() {
  const [mode, setMode] = useState<TimerMode>('hourglass');

  // --- 1. Sanduhr ---
  const [durationSec, setDurationSec] = useState(60);
  const [remainingMs, setRemainingMs] = useState(60_000);
  const [hourglassRunning, setHourglassRunning] = useState(false);
  const warnedRef = useRef(false);
  const lastTickRef = useRef<number>(0);

  useEffect(() => {
    if (!hourglassRunning) return;
    lastTickRef.current = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      setRemainingMs((prev) => {
        const next = Math.max(0, prev - delta);
        if (next <= 5000 && next > 0 && !warnedRef.current) {
          warnedRef.current = true;
          sound.play('zeit-knapp');
        }
        if (next === 0 && prev > 0) {
          setHourglassRunning(false);
          sound.play('zeit-um');
        }
        return next;
      });
    }, 100);
    return () => window.clearInterval(id);
  }, [hourglassRunning]);

  const selectHourglassSec = (sec: number) => {
    const clamped = Math.max(5, Math.min(3600, Math.round(sec)));
    setHourglassRunning(false);
    setDurationSec(clamped);
    setRemainingMs(clamped * 1000);
    warnedRef.current = false;
  };

  const resetHourglass = () => {
    setHourglassRunning(false);
    setRemainingMs(durationSec * 1000);
    warnedRef.current = false;
  };

  const progressPct = durationSec > 0 ? Math.max(0, Math.min(100, (remainingMs / (durationSec * 1000)) * 100)) : 0;

  // --- 2. Schachuhr (2 bis 6 Spieler) ---
  const [playerCount, setPlayerCount] = useState(2);
  const [baseMinutes, setBaseMinutes] = useState(5);
  const [incrementSec, setIncrementSec] = useState(0);
  const [clocks, setClocks] = useState<number[]>(() => Array.from({ length: 2 }, () => 5 * 60_000));
  const [activePlayer, setActivePlayer] = useState<number>(0);
  const [chessRunning, setChessRunning] = useState(false);
  const chessTickRef = useRef<number>(0);
  const chessWarnedRef = useRef<Record<number, boolean>>({});

  const resetChess = (count = playerCount, mins = baseMinutes) => {
    setChessRunning(false);
    setActivePlayer(0);
    chessWarnedRef.current = {};
    setClocks(Array.from({ length: count }, () => mins * 60_000));
  };

  useEffect(() => {
    if (!chessRunning) return;
    chessTickRef.current = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      const delta = now - chessTickRef.current;
      chessTickRef.current = now;
      setClocks((prev) =>
        prev.map((ms, idx) => {
          if (idx !== activePlayer) return ms;
          const next = Math.max(0, ms - delta);
          if (next <= 5000 && next > 0 && !chessWarnedRef.current[idx]) {
            chessWarnedRef.current[idx] = true;
            sound.play('zeit-knapp');
          }
          if (next === 0 && ms > 0) {
            setChessRunning(false);
            sound.play('zeit-um');
          }
          return next;
        }),
      );
    }, 100);
    return () => window.clearInterval(id);
  }, [chessRunning, activePlayer]);

  const nextTurn = () => {
    if (clocks.every((c) => c === 0)) return;
    setClocks((prev) =>
      prev.map((ms, idx) => (idx === activePlayer && chessRunning ? ms + incrementSec * 1000 : ms)),
    );
    // Nächsten Spieler mit Restzeit > 0 wählen
    let next = (activePlayer + 1) % playerCount;
    for (let step = 0; step < playerCount; step++) {
      const candidate = (activePlayer + 1 + step) % playerCount;
      if ((clocks[candidate] ?? 0) > 0) {
        next = candidate;
        break;
      }
    }
    setActivePlayer(next);
    if (!chessRunning) setChessRunning(true);
    sound.play('stein-setzen');
  };

  // Leertaste schaltet bei der Schachuhr weiter, wenn kein Eingabefeld/Button fokussiert ist.
  useEffect(() => {
    if (mode !== 'chess') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return;
      e.preventDefault();
      nextTurn();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const anyZero = clocks.some((c) => c === 0);

  return (
    <div className="space-y-5">
      <Segmented
        label="Uhr-Art"
        value={mode}
        onChange={(next) => {
          setHourglassRunning(false);
          setChessRunning(false);
          setMode(next);
        }}
        choices={[
          { value: 'hourglass', label: '⏳ Sanduhr' },
          { value: 'chess', label: '⏱️ Schachuhr' },
        ]}
      />

      {mode === 'hourglass' ? (
        <div className="space-y-4">
          <Section title="Zeit wählen">
            <div className="flex flex-wrap gap-2">
              {HOURGLASS_PRESETS.map((p) => (
                <button
                  key={p.sec}
                  type="button"
                  onClick={() => selectHourglassSec(p.sec)}
                  className={`min-h-10 rounded-xl border px-3.5 py-1.5 text-sm font-semibold transition ${
                    durationSec === p.sec
                      ? 'border-accent bg-accent text-accent-ink shadow-sm'
                      : 'border-line bg-surface-2 text-ink hover:bg-surface'
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <label className="flex items-center gap-1.5 text-xs text-muted">
                Sekunden:
                <input
                  type="number"
                  min={5}
                  max={3600}
                  value={durationSec}
                  onChange={(e) => selectHourglassSec(Number(e.target.value) || 60)}
                  className="w-20 rounded-xl border border-line bg-surface-2 px-2.5 py-1.5 text-sm font-semibold text-ink focus:border-accent focus:outline-none"
                />
              </label>
            </div>
          </Section>

          <div className="space-y-4 rounded-2xl border border-line bg-surface-2 p-5 text-center">
            <div className="text-5xl font-bold tabular-nums tracking-tight text-ink" aria-live="off">
              {formatCountdownMs(remainingMs)}
            </div>

            <div className="h-4 w-full overflow-hidden rounded-full bg-surface">
              <div
                style={{ width: `${progressPct}%` }}
                className={`h-full transition-[width] duration-100 ${
                  remainingMs === 0 ? 'bg-red-500' : remainingMs <= 5000 ? 'bg-amber-500' : 'bg-accent'
                }`}
              />
            </div>

            {remainingMs === 0 && (
              <p role="status" className="text-sm font-bold text-red-500">
                ⏰ Die Zeit ist abgelaufen!
              </p>
            )}

            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant="primary"
                className="min-w-36"
                onClick={() => {
                  if (remainingMs === 0) resetHourglass();
                  setHourglassRunning((r) => !r);
                }}
              >
                {hourglassRunning ? '⏸ Pause' : remainingMs === 0 ? '↻ Neu starten' : '▶ Start'}
              </Button>
              <Button variant="secondary" onClick={resetHourglass}>
                Zurücksetzen
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Section title="Spielerzahl">
              <PlayerCount
                value={playerCount}
                min={2}
                max={6}
                label="Spielerzahl"
                onChange={(n) => {
                  setPlayerCount(n);
                  resetChess(n, baseMinutes);
                }}
              />
            </Section>

            <Section title="Bedenkzeit & Bonus">
              <div className="flex flex-wrap gap-1.5">
                {CHESS_MINUTES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setBaseMinutes(m);
                      resetChess(playerCount, m);
                    }}
                    className={`min-h-10 rounded-lg border px-2.5 text-sm font-semibold transition ${
                      baseMinutes === m
                        ? 'border-accent bg-accent text-accent-ink'
                        : 'border-line bg-surface-2 text-ink hover:bg-surface'
                    }`}
                  >
                    {m} min
                  </button>
                ))}
                <select
                  aria-label="Inkrement je Zug"
                  value={incrementSec}
                  onChange={(e) => setIncrementSec(Number(e.target.value))}
                  className="min-h-10 rounded-lg border border-line bg-surface-2 px-2.5 text-sm font-semibold text-ink focus:border-accent focus:outline-none"
                >
                  {CHESS_INCREMENTS.map((inc) => (
                    <option key={inc} value={inc}>
                      +{inc} s/Zug
                    </option>
                  ))}
                </select>
              </div>
            </Section>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            {clocks.map((ms, idx) => {
              const active = idx === activePlayer;
              const expired = ms === 0;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    if (active && !expired) nextTurn();
                  }}
                  className={`flex items-center justify-between rounded-2xl border-2 px-4 py-3 text-left transition ${
                    expired
                      ? 'border-red-500/60 bg-red-500/10'
                      : active
                        ? 'border-accent bg-accent/15 shadow-sm'
                        : 'border-line bg-surface-2 opacity-80'
                  }`}
                >
                  <div>
                    <div className="text-xs font-semibold text-muted uppercase">
                      Spieler {idx + 1} {active && chessRunning ? '· Am Zug' : ''}
                    </div>
                    <div className="text-2xl font-bold tabular-nums text-ink">{formatCountdownMs(ms)}</div>
                  </div>
                  {active && !expired && (
                    <span className="rounded-lg bg-accent px-2.5 py-1 text-xs font-bold text-accent-ink">
                      Weiter
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              className="flex-1 min-h-12 text-base"
              disabled={anyZero && clocks.every((c) => c === 0)}
              onClick={nextTurn}
            >
              ⏭️ Nächster Spieler
            </Button>
            <Button variant="secondary" onClick={() => setChessRunning((r) => !r)} disabled={anyZero}>
              {chessRunning ? '⏸ Pause' : '▶ Weiter'}
            </Button>
            <Button variant="ghost" onClick={() => resetChess()}>
              Zurücksetzen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
