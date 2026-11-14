import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Button, PlayerCount, Section, Segmented } from '../controls';
import { loadHelperState, parseEntryList, randomInt, saveHelperState, splitIntoTeams } from '../../lib/helpers';
import { sound } from '../../lib/sound';

type StarterMode = 'names' | 'fingers';

interface TouchFinger {
  id: number;
  x: number;
  y: number;
  color: string;
  simulated?: boolean;
}

const FINGER_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];

interface StoredStarterPrefs {
  namesRaw: string;
  teamCount: number;
}

const DEFAULT_PREFS: StoredStarterPrefs = {
  namesRaw: 'Anna\nBen\nClara\nDavid',
  teamCount: 2,
};

export function StarterHelper() {
  const initial = useMemo(() => loadHelperState<StoredStarterPrefs>('startspieler', DEFAULT_PREFS), []);
  const [mode, setMode] = useState<StarterMode>('names');

  // Modus 1: Namen & Teams
  const [namesRaw, setNamesRaw] = useState(initial.namesRaw ?? DEFAULT_PREFS.namesRaw);
  const [teamCount, setTeamCount] = useState(Math.max(2, Math.min(6, initial.teamCount || 2)));
  const [chosenStarter, setChosenStarter] = useState<string | null>(null);
  const [teams, setTeams] = useState<string[][] | null>(null);

  const names = useMemo(() => parseEntryList(namesRaw), [namesRaw]);

  useEffect(() => {
    saveHelperState<StoredStarterPrefs>('startspieler', { namesRaw, teamCount });
  }, [namesRaw, teamCount]);

  const pickStarter = () => {
    if (names.length === 0) return;
    const winner = names[randomInt(0, names.length - 1)]!;
    setChosenStarter(winner);
    setTeams(null);
    sound.play('ansage');
  };

  const makeTeams = () => {
    if (names.length < 2) return;
    setTeams(splitIntoTeams(names, teamCount));
    setChosenStarter(null);
    sound.play('dein-zug');
  };

  // Modus 2: Finger auflegen
  const padRef = useRef<HTMLDivElement>(null);
  const [fingers, setFingers] = useState<TouchFinger[]>([]);
  const [winnerFingerId, setWinnerFingerId] = useState<number | null>(null);
  const [countdownMs, setCountdownMs] = useState<number | null>(null);

  useEffect(() => {
    if (winnerFingerId !== null) return;
    if (fingers.length < 2) {
      setCountdownMs(null);
      return;
    }
    const started = Date.now();
    const duration = 2000;
    setCountdownMs(duration);

    const timer = window.setInterval(() => {
      const left = duration - (Date.now() - started);
      if (left <= 0) {
        window.clearInterval(timer);
        setCountdownMs(0);
        setFingers((current) => {
          if (current.length >= 2) {
            const picked = current[randomInt(0, current.length - 1)]!;
            setWinnerFingerId(picked.id);
            sound.play('sieg');
          }
          return current;
        });
      } else {
        setCountdownMs(left);
      }
    }, 80);

    return () => window.clearInterval(timer);
  }, [fingers.length, winnerFingerId]);

  const toLocalPercent = (clientX: number, clientY: number) => {
    const rect = padRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 50, y: 50 };
    return {
      x: Math.max(8, Math.min(92, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(12, Math.min(88, ((clientY - rect.top) / rect.height) * 100)),
    };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (winnerFingerId !== null) {
      // Nach einem Ergebnis startet ein neuer Tipp eine frische Runde.
      setWinnerFingerId(null);
      setFingers([]);
    }
    const pos = toLocalPercent(e.clientX, e.clientY);
    setFingers((prev) => {
      if (prev.some((f) => f.id === e.pointerId)) return prev;
      const color = FINGER_COLORS[prev.length % FINGER_COLORS.length]!;
      return [...prev, { id: e.pointerId, x: pos.x, y: pos.y, color }];
    });
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (winnerFingerId !== null) return;
    const pos = toLocalPercent(e.clientX, e.clientY);
    setFingers((prev) => prev.map((f) => (f.id === e.pointerId ? { ...f, x: pos.x, y: pos.y } : f)));
  };

  const onPointerUpOrCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (winnerFingerId !== null) return;
    setFingers((prev) => prev.filter((f) => f.id !== e.pointerId || f.simulated));
  };

  const addSimulatedFinger = () => {
    setWinnerFingerId(null);
    setFingers((prev) => {
      if (prev.length >= 6) return prev;
      const id = -1 - prev.length;
      const angle = (prev.length / 6) * Math.PI * 2;
      const x = 50 + Math.cos(angle) * 26;
      const y = 50 + Math.sin(angle) * 26;
      const color = FINGER_COLORS[prev.length % FINGER_COLORS.length]!;
      return [...prev, { id, x, y, color, simulated: true }];
    });
  };

  const resetFingers = () => {
    setFingers([]);
    setWinnerFingerId(null);
    setCountdownMs(null);
  };

  return (
    <div className="space-y-5">
      <Segmented
        label="Auswahlart"
        value={mode}
        onChange={setMode}
        choices={[
          { value: 'names', label: '📝 Namen & Teams' },
          { value: 'fingers', label: '👆 Finger auflegen' },
        ]}
      />

      {mode === 'names' ? (
        <div className="space-y-5">
          <Section title="Mitspieler">
            <div className="space-y-3 rounded-2xl border border-line bg-surface-2 p-4">
              <label className="block text-xs text-muted">
                Namen (einer pro Zeile oder mit Komma getrennt):
                <textarea
                  rows={4}
                  value={namesRaw}
                  onChange={(e) => setNamesRaw(e.target.value)}
                  placeholder="Anna&#10;Ben&#10;Clara"
                  className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                />
              </label>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                <span>{names.length} {names.length === 1 ? 'Person' : 'Personen'}</span>
                <div className="flex gap-1.5">
                  {[2, 4, 6].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setNamesRaw(Array.from({ length: n }, (_, i) => `Spieler ${i + 1}`).join('\n'))}
                      className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink hover:border-accent"
                    >
                      1–{n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="primary" onClick={pickStarter} disabled={names.length === 0}>
                  🎯 Startspieler auslosen
                </Button>
                <Button variant="secondary" onClick={makeTeams} disabled={names.length < 2}>
                  🤝 Teams auslosen
                </Button>
              </div>
            </div>
          </Section>

          <Section title="Team-Anzahl">
            <PlayerCount value={teamCount} min={2} max={6} onChange={setTeamCount} label="Anzahl Teams" />
          </Section>

          {chosenStarter && (
            <div aria-live="polite" className="rounded-2xl border-2 border-accent bg-surface-2 p-5 text-center shadow-sm">
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">Es beginnt</p>
              <p className="mt-1 text-2xl font-bold text-accent">👑 {chosenStarter}</p>
            </div>
          )}

          {teams && (
            <Section title="Ausgeloste Teams">
              <div aria-live="polite" className="grid gap-3 sm:grid-cols-2">
                {teams.map((members, idx) => (
                  <div key={idx} className="rounded-2xl border border-line bg-surface-2 p-3">
                    <h3 className="text-sm font-bold text-accent">Team {idx + 1}</h3>
                    {members.length > 0 ? (
                      <ul className="mt-1.5 space-y-1 text-sm">
                        {members.map((m, mi) => (
                          <li key={mi} className="rounded-lg bg-surface px-2.5 py-1 font-medium">
                            {m}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-xs text-muted">–</p>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      ) : (
        <Section title="Alle legen gleichzeitig einen Finger auf das Feld">
          <div className="space-y-3">
            <div
              ref={padRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUpOrCancel}
              onPointerCancel={onPointerUpOrCancel}
              style={{ touchAction: 'none' }}
              className="relative h-72 w-full select-none overflow-hidden rounded-2xl border-2 border-dashed border-accent/60 bg-surface-2"
            >
              {fingers.length === 0 && (
                <div className="pointer-events-none flex h-full flex-col items-center justify-center gap-1 p-4 text-center text-sm text-muted">
                  <span className="text-3xl" aria-hidden="true">🖐️</span>
                  <span>Mindestens 2 Finger auf das Feld legen und kurz halten</span>
                </div>
              )}

              {countdownMs !== null && countdownMs > 0 && winnerFingerId === null && (
                <div className="pointer-events-none absolute inset-x-0 top-3 text-center">
                  <span className="rounded-full bg-surface/90 px-3 py-1 text-xs font-bold tabular-nums shadow">
                    Auswahl in {(countdownMs / 1000).toFixed(1)} s …
                  </span>
                </div>
              )}

              {winnerFingerId !== null && (
                <div className="pointer-events-none absolute inset-x-0 top-3 text-center">
                  <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-ink shadow">
                    👑 Dieser Finger beginnt! (Tippen für neue Runde)
                  </span>
                </div>
              )}

              {fingers.map((f, idx) => {
                const isWinner = winnerFingerId === f.id;
                const faded = winnerFingerId !== null && !isWinner;
                return (
                  <div
                    key={f.id}
                    style={{
                      left: `${f.x}%`,
                      top: `${f.y}%`,
                      backgroundColor: f.color,
                    }}
                    className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-200 flex items-center justify-center font-bold text-white shadow-lg ${
                      isWinner ? 'h-20 w-20 ring-4 ring-white scale-110' : 'h-16 w-16'
                    } ${faded ? 'opacity-25 scale-75' : 'opacity-95'}`}
                  >
                    {isWinner ? '👑' : idx + 1}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted">
                Am Desktop ohne Touch kannst du Test-Finger hinzufügen:
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={addSimulatedFinger} disabled={fingers.length >= 6}>
                  + Test-Finger
                </Button>
                {fingers.length > 0 && (
                  <Button variant="ghost" onClick={resetFingers}>
                    Zurücksetzen
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}
