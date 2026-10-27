import type { SeatId } from '@brett-und-blatt/engine';
import type { BoardProps, GameUi } from '@brett-und-blatt/ui';
import { useEffect, useId, useMemo, useState } from 'react';
import {
  rankRacers,
  result,
  type DuckRallyMove,
  type DuckRallyState,
  type RacerState,
} from '../rules';
import './styles.css';

/** Barrierefreie, kräftige Entenfarben (Okabe-Ito-inspiriert + erweiterte Palette). */
const DUCK_COLORS = [
  '#facc15', // 1: Sonnengelb (Klassische Quietscheente)
  '#ef4444', // 2: Korallrot
  '#3b82f6', // 3: Ozeanblau
  '#10b981', // 4: Smaragdgrün
  '#a855f7', // 5: Violett
  '#f97316', // 6: Mandarine
  '#06b6d4', // 7: Türkis
  '#ec4899', // 8: Pink
];

function duckColorOf(seat: SeatId): string {
  return DUCK_COLORS[seat % DUCK_COLORS.length]!;
}

/** 3D-schattierte Gummiente als SVG (übernommen aus `KopfrechenArena.jsx` in Der Große Preis). */
function RubberDuckSVG({
  color = '#facc15',
  size = 44,
  className = 'dr-duck-svg',
}: {
  color?: string;
  size?: number | string;
  className?: string;
}) {
  const uid = useId();
  const shadeId = `duck-shade-${uid}`;
  const glossId = `duck-gloss-${uid}`;
  const dim = typeof size === 'number' ? `${size}px` : size;

  return (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 100 100"
      className={className}
      style={{ width: dim, height: dim, flexShrink: 0 }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={shadeId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="40%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="60%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.32" />
        </linearGradient>
        <linearGradient id={glossId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Enten-Bürzel */}
      <path
        d="M 20 63 C 14 52, 15 46, 21 42 C 27 42, 26 52, 20 63 Z"
        fill={color}
        stroke="#0f172a"
        strokeWidth="2.5"
      />
      <path d="M 20 63 C 14 52, 15 46, 21 42 C 27 42, 26 52, 20 63 Z" fill={`url(#${shadeId})`} />

      {/* Enten-Körper */}
      <path
        d="M 82 60 C 82 36, 54 36, 48 58 C 42 58, 18 53, 18 68 C 18 82, 62 82, 72 82 C 84 82, 82 70, 82 60 Z"
        fill={color}
        stroke="#0f172a"
        strokeWidth="3"
      />
      <path
        d="M 82 60 C 82 36, 54 36, 48 58 C 42 58, 18 53, 18 68 C 18 82, 62 82, 72 82 C 84 82, 82 70, 82 60 Z"
        fill={`url(#${shadeId})`}
      />

      {/* Enten-Kopf */}
      <circle cx="65" cy="40" r="19" fill={color} stroke="#0f172a" strokeWidth="3" />
      <circle cx="65" cy="40" r="19" fill={`url(#${shadeId})`} />

      {/* Auge (blickt nach rechts Richtung Ziellinie) */}
      <ellipse cx="70" cy="36" rx="6" ry="8" fill="#ffffff" stroke="#0f172a" strokeWidth="2.2" />
      <ellipse cx="71.5" cy="36" rx="4.2" ry="5.8" fill="#1e293b" />
      <circle cx="73.5" cy="33.5" r="1.8" fill="#ffffff" />
      <circle cx="69.8" cy="38.5" r="0.9" fill="#ffffff" />

      {/* Bäckchen */}
      <ellipse cx="58" cy="45" rx="4.5" ry="3.5" fill="#f43f5e" opacity="0.38" />

      {/* Oranger Schnabel */}
      <path d="M 77 38 C 89 34, 91 46, 77 47 Z" fill="#f97316" stroke="#0f172a" strokeWidth="2.5" />
      <path
        d="M 79 40 C 83 38, 85 38, 87 39"
        fill="none"
        stroke="#fed7aa"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Flügel */}
      <path
        d="M 67 64 C 67 53, 41 52, 41 66 C 41 72, 55 74, 67 64 Z"
        fill={color}
        stroke="#0f172a"
        strokeWidth="2.5"
      />
      <path
        d="M 67 64 C 67 53, 41 52, 41 66 C 41 72, 55 74, 67 64 Z"
        fill={`url(#${shadeId})`}
      />
      <path
        d="M 60 65 C 56 60, 48 60, 47 66"
        fill="none"
        stroke="#0f172a"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.25"
      />

      {/* Glanzlichter */}
      <path
        d="M 50 31 A 19 19 0 0 1 65 21"
        fill="none"
        stroke={`url(#${glossId})`}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M 79 78 A 20 20 0 0 0 80 65"
        fill="none"
        stroke={`url(#${glossId})`}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.8"
      />
    </svg>
  );
}

function SeatDuckSymbol({ seat, className }: { seat: SeatId; className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center ${className ?? ''}`}>
      <RubberDuckSVG color={duckColorOf(seat)} size={22} className="" />
    </span>
  );
}

/** Einzelnes Aufgaben-Cockpit für einen Spieler (wird einzeln oder im Splitscreen gerendert). */
function RacerCockpit({
  racer,
  target,
  name,
  canPlay,
  enableKeyboard,
  onSubmit,
}: {
  racer: RacerState;
  target: number;
  name: string;
  canPlay: boolean;
  enableKeyboard: boolean;
  onSubmit: (value: number) => void;
}) {
  const [input, setInput] = useState('');
  const [flashWrong, setFlashWrong] = useState(false);
  const [flashCorrect, setFlashCorrect] = useState(false);

  const color = duckColorOf(racer.seat);
  const problem = racer.currentProblem;
  const isFinished = racer.solvedCount >= target;
  const progressPct = Math.min(100, Math.round((racer.solvedCount / target) * 100));

  // Bei neuer Aufgabe (oder neuem Versuch) Eingabe leeren und kurzes Feedback zeigen
  useEffect(() => {
    setInput('');
    if (racer.lastResult === 'wrong' && racer.mistakes > 0) {
      setFlashWrong(true);
      const t = window.setTimeout(() => setFlashWrong(false), 420);
      return () => window.clearTimeout(t);
    }
    if (racer.lastResult === 'correct' && racer.solvedCount > 0) {
      setFlashCorrect(true);
      const t = window.setTimeout(() => setFlashCorrect(false), 320);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [problem?.id, racer.solvedCount, racer.mistakes, racer.lastResult]);

  const handleDigit = (digit: string) => {
    if (!canPlay || isFinished || !problem || problem.kind === 'prime') return;
    setInput((prev) => (prev.length < 5 ? prev + digit : prev));
  };

  const handleBackspace = () => {
    if (!canPlay || isFinished) return;
    setInput((prev) => prev.slice(0, -1));
  };

  const handleEnter = () => {
    if (!canPlay || isFinished || !problem || problem.kind === 'prime') return;
    const trimmed = input.trim();
    if (!trimmed) return;
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed)) return;
    setInput('');
    onSubmit(parsed);
  };

  // Tastatursteuerung, wenn nur ein einzelnes menschliches Cockpit aktiv ist
  useEffect(() => {
    if (!enableKeyboard || !canPlay || isFinished || !problem) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        if (problem.kind !== 'prime') {
          setInput((prev) => (prev.length < 5 ? prev + e.key : prev));
        }
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        setInput((prev) => prev.slice(0, -1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (problem.kind !== 'prime' && input.trim().length > 0) {
          const parsed = Number.parseInt(input.trim(), 10);
          if (Number.isFinite(parsed)) {
            setInput('');
            onSubmit(parsed);
          }
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enableKeyboard, canPlay, isFinished, problem, input, onSubmit]);

  return (
    <div className="dr-cockpit-card" style={{ borderTopColor: color }}>
      {/* Kopfzeile mit Enten-Badge, Etappe & Serie */}
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
        <span
          className="inline-flex items-center gap-1.5 truncate rounded-full px-2.5 py-0.5 font-extrabold text-slate-950 shadow-xs"
          style={{ backgroundColor: color }}
        >
          🦆 {name} ({progressPct} %)
        </span>
        <span className="font-semibold text-muted">
          {isFinished ? '🏁 Im Ziel!' : `Aufgabe ${racer.solvedCount + 1} / ${target}`}
          {racer.streak >= 2 && (
            <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
              🔥 {racer.streak}
            </span>
          )}
        </span>
      </div>

      {isFinished || !problem ? (
        <div className="my-auto flex flex-col items-center justify-center gap-1.5 py-6 text-center">
          <RubberDuckSVG color={color} size={58} />
          <p className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
            🏁 Ziel erreicht!
          </p>
          <p className="text-xs text-muted">
            {racer.solvedCount} gelöst · {racer.mistakes} Fehler · Beste Serie: {racer.bestStreak}
          </p>
        </div>
      ) : (
        <>
          {/* Aufgaben-Anzeige */}
          <div
            className={`dr-problem-box ${flashWrong ? 'dr-problem-box-wrong' : ''} ${flashCorrect ? 'dr-problem-box-correct' : ''}`}
          >
            <div className="text-center text-lg font-extrabold tracking-tight sm:text-xl">
              {problem.prompt}
            </div>

            {problem.kind !== 'prime' && (
              <div
                className={`mt-1.5 flex min-h-9 min-w-24 items-center justify-center rounded-lg border-2 bg-surface px-3 text-lg font-black ${
                  flashWrong ? 'border-red-500 text-red-500' : 'border-line text-ink'
                }`}
                aria-live="polite"
              >
                {input || '?'}
              </div>
            )}
          </div>

          {/* Eingabebereich: 6er-Primzahl-Auswahl oder 3x4 Touch-Ziffernblock */}
          {problem.kind === 'prime' && problem.options ? (
            <div className="dr-prime-grid">
              {problem.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  disabled={!canPlay}
                  className="dr-key-btn border-2 py-2.5 text-base font-black"
                  style={{ borderColor: color }}
                  onClick={() => onSubmit(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <div className="dr-numpad">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  disabled={!canPlay}
                  className="dr-key-btn"
                  onClick={() => handleDigit(digit)}
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                disabled={!canPlay || input.length === 0}
                className="dr-key-btn text-red-500"
                aria-label="Löschen"
                onClick={handleBackspace}
              >
                ⌫
              </button>
              <button
                type="button"
                disabled={!canPlay}
                className="dr-key-btn"
                onClick={() => handleDigit('0')}
              >
                0
              </button>
              <button
                type="button"
                disabled={!canPlay || input.trim().length === 0}
                className="dr-key-btn font-black text-slate-950"
                style={{ backgroundColor: color, borderColor: color }}
                onClick={handleEnter}
              >
                GO!
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Siegertreppchen (Podest) nach Rennende. */
function VictoryPodium({
  view,
  seatNames,
}: {
  view: DuckRallyState;
  seatNames?: string[];
}) {
  const ranked = useMemo(() => rankRacers(view), [view]);
  const winnerColor = duckColorOf(ranked[0]?.seat ?? 0);

  const nameOf = (seat: SeatId) => seatNames?.[seat] ?? `Ente ${seat + 1}`;

  const podiumCols = [
    { item: ranked[1], medal: '🥈', height: '74%', bg: 'linear-gradient(to top, #94a3b8, #e2e8f0)', duckSize: 56 },
    { item: ranked[0], medal: '🥇', height: '100%', bg: 'linear-gradient(to top, #f59e0b, #fde047)', duckSize: 68 },
    { item: ranked[2], medal: '🥉', height: '62%', bg: 'linear-gradient(to top, #d97706, #fdba74)', duckSize: 48 },
  ];

  return (
    <div
      className="flex flex-1 flex-col items-center justify-between overflow-y-auto rounded-2xl border-4 bg-surface p-4 text-center shadow-md"
      style={{ borderColor: winnerColor }}
    >
      <div>
        <div className="text-3xl" aria-hidden="true">
          🏆
        </div>
        <h2 className="text-xl font-black tracking-wide uppercase sm:text-2xl">
          Zieleinlauf der Enten-Rallye!
        </h2>
        {ranked[0] && (
          <p className="text-xs font-semibold text-muted sm:text-sm">
            {nameOf(ranked[0].seat)} gewinnt mit {ranked[0].solvedCount} gelösten Aufgaben (
            {ranked[0].mistakes === 0 ? 'fehlerfrei!' : `${ranked[0].mistakes} Fehler`})
          </p>
        )}
      </div>

      {/* Podest für Platz 1 bis 3 */}
      <div className="dr-podium-stage">
        {podiumCols.map((col, idx) => {
          if (!col.item) return null;
          const r = col.item;
          const color = duckColorOf(r.seat);
          return (
            <div key={r.seat} className="dr-podium-col" style={{ zIndex: idx === 1 ? 5 : 2 }}>
              <div className="mb-1 max-w-28 truncate text-xs font-extrabold sm:text-sm" style={{ color }}>
                {nameOf(r.seat)}
              </div>
              <div className="mb-1 text-[11px] font-semibold text-muted">
                {r.solvedCount}/{view.target} · {r.mistakes} F.
              </div>
              <div
                className="dr-podium-pedestal"
                style={{ height: col.height, background: col.bg }}
              >
                <span className="text-xl">{col.medal}</span>
                <RubberDuckSVG color={color} size={col.duckSize} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Weitere Plätze ab Platz 4 */}
      {ranked.length > 3 && (
        <div className="mt-2 flex max-h-24 w-full max-w-lg flex-wrap justify-center gap-1.5 overflow-y-auto">
          {ranked.slice(3).map((r, i) => (
            <span
              key={r.seat}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-bg px-2.5 py-0.5 text-xs font-semibold"
            >
              <span className="text-muted">#{i + 4}</span>
              <span style={{ color: duckColorOf(r.seat) }}>{nameOf(r.seat)}</span>
              <span className="text-muted">
                ({r.solvedCount}/{view.target})
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Board({
  view,
  viewer,
  legalMoves,
  onMove,
  seatNames,
  humanSeats,
}: BoardProps<DuckRallyState, DuckRallyMove>) {
  const gameResult = result(view);
  const mySeat: SeatId = typeof viewer === 'number' ? viewer : 0;
  const nameOf = (seat: SeatId) => seatNames?.[seat] ?? `Ente ${seat + 1}`;

  // Bei mehr als 4 Menschen im Hot-Seat: umschaltbarer Tab, bis 4 Menschen echter Splitscreen
  const [activeTabSeat, setActiveTabSeat] = useState<SeatId>(0);

  // Welche Bahnen werden im Fluss angezeigt? (Bis 8 Plätze alle; darüber Top 5 + eigener Platz)
  const visibleLanes = useMemo(() => {
    if (view.racers.length <= 8) return view.racers;
    const ranked = rankRacers(view);
    const top = ranked.slice(0, 5);
    if (!top.some((r) => r.seat === mySeat)) {
      const mine = view.racers[mySeat];
      if (mine) top.push(mine);
    }
    return top.sort((a, b) => a.seat - b.seat);
  }, [view, mySeat]);

  const duckSizePx = visibleLanes.length <= 2 ? 52 : visibleLanes.length <= 4 ? 44 : 34;

  // Führende Ente für den farbigen Fluss-Rahmen bestimmen
  const leaderSeat = useMemo(() => {
    const ranked = rankRacers(view);
    return ranked[0]?.solvedCount ? ranked[0].seat : null;
  }, [view]);

  return (
    <div className="dr-root">
      {/* 1. Oben: Animierter Enten-Fluss */}
      <div
        className="dr-river"
        style={{
          borderColor: leaderSeat !== null ? duckColorOf(leaderSeat) : '#1d4ed8',
        }}
      >
        <div className="dr-river-waves" />
        <div className="dr-bank-top" />
        <div className="dr-bank-bottom" />

        <div className="pointer-events-none absolute top-3 left-3 z-3 text-[11px] font-extrabold tracking-wider text-white/60">
          ◀ START
        </div>
        <div className="dr-finish-line" />
        <div className="pointer-events-none absolute right-2 bottom-3 z-3 text-[11px] font-extrabold text-white/85">
          ZIEL 🏁
        </div>

        {visibleLanes.map((racer) => {
          const progress = Math.min(100, (racer.solvedCount / view.target) * 100);
          const color = duckColorOf(racer.seat);
          const leftCalc = `calc(14px + (${progress} / 100) * (100% - ${duckSizePx}px - 68px))`;

          return (
            <div key={racer.seat} className="dr-lane">
              <div className="dr-lane-info">
                <span
                  className="inline-block h-2.5 w-2.5 flex-none rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="truncate">{nameOf(racer.seat)}</span>
                <span className="opacity-80">
                  {racer.solvedCount}/{view.target}
                </span>
              </div>

              <div
                className={`dr-duck-wrap ${racer.lastResult === 'correct' && racer.solvedCount > 0 ? 'dr-duck-boosting' : ''}`}
                style={{ left: leftCalc, width: duckSizePx, height: duckSizePx }}
              >
                <RubberDuckSVG color={color} size={duckSizePx} />
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. Unten: Siegertreppchen bei Spielende, sonst Cockpit(s) */}
      {gameResult ? (
        <VictoryPodium view={view} seatNames={seatNames} />
      ) : humanSeats && humanSeats.length > 1 ? (
        humanSeats.length <= 4 ? (
          /* Hot-Seat Splitscreen für 2–4 Spieler am selben Gerät / Smartboard */
          <div
            className="dr-cockpit-grid"
            style={{
              gridTemplateColumns: `repeat(${humanSeats.length}, minmax(200px, 1fr))`,
              overflowX: 'auto',
            }}
          >
            {humanSeats.map((hs) => {
              const racer = view.racers[hs.seat];
              if (!racer) return null;
              return (
                <RacerCockpit
                  key={hs.seat}
                  racer={racer}
                  target={view.target}
                  name={nameOf(hs.seat)}
                  canPlay={hs.legalMoves.length > 0}
                  enableKeyboard={false}
                  onSubmit={(val) => hs.onMove({ type: 'answer', value: val })}
                />
              );
            })}
          </div>
        ) : (
          /* Ab 5+ Menschen an einem Gerät: Schnellwahl-Leiste + aktives Cockpit */
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap gap-1.5">
              {humanSeats.map((hs) => {
                const r = view.racers[hs.seat];
                const selected = hs.seat === activeTabSeat;
                return (
                  <button
                    key={hs.seat}
                    type="button"
                    className={`rounded-full border px-3 py-1 text-xs font-bold ${
                      selected ? 'border-ink bg-surface text-ink shadow-xs' : 'border-line text-muted'
                    }`}
                    onClick={() => setActiveTabSeat(hs.seat)}
                  >
                    🦆 {nameOf(hs.seat)} ({r?.solvedCount ?? 0}/{view.target})
                  </button>
                );
              })}
            </div>
            {(() => {
              const activeHs = humanSeats.find((h) => h.seat === activeTabSeat) ?? humanSeats[0]!;
              const racer = view.racers[activeHs.seat];
              if (!racer) return null;
              return (
                <RacerCockpit
                  key={activeHs.seat}
                  racer={racer}
                  target={view.target}
                  name={nameOf(activeHs.seat)}
                  canPlay={activeHs.legalMoves.length > 0}
                  enableKeyboard={true}
                  onSubmit={(val) => activeHs.onMove({ type: 'answer', value: val })}
                />
              );
            })()}
          </div>
        )
      ) : (
        /* Einzel-Cockpit (Solo, gegen Bots oder Online am eigenen Gerät) */
        <div className="dr-cockpit-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
          {view.racers[mySeat] && (
            <RacerCockpit
              racer={view.racers[mySeat]!}
              target={view.target}
              name={nameOf(mySeat)}
              canPlay={legalMoves.length > 0}
              enableKeyboard={true}
              onSubmit={(val) => onMove({ type: 'answer', value: val })}
            />
          )}
        </div>
      )}
    </div>
  );
}

export const gameUi: GameUi<DuckRallyState, DuckRallyMove> = {
  Board,
  SeatSymbol: SeatDuckSymbol,
  seatLabel: (seat) => `Ente ${seat + 1}`,
  seatDetail: (view, seat) => {
    const r = view.racers[seat];
    if (!r) return '';
    return `${r.solvedCount}/${view.target}${r.streak >= 2 ? ` · 🔥${r.streak}` : ''}`;
  },
  sounds: {
    boost: 'paar',
    mistake: 'kein-paar',
  },
};
