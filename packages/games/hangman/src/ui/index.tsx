import type { SeatId } from '@brett-und-blatt/engine';
import type { BoardProps, GameUi } from '@brett-und-blatt/ui';
import { useEffect, useState } from 'react';
import {
  ALPHABET,
  result,
  revealedStats,
  type HangmanCategory,
  type HangmanMove,
  type HangmanState,
  type HangmanTheme,
} from '../index';
import './styles.css';

const CATEGORY_LABELS: Record<HangmanCategory, string> = {
  alltag: '🎒 Alltag, Schule & Freizeit',
  tiere: '🐾 Tiere & Natur',
  knifflig: '🧠 Knifflige Wörter',
  mathe: '📐 Mathe & Geometrie (Kl. 5/6)',
};

const SEAT_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899', '#84cc16'];

function HangmanSymbol({ seat, className }: { seat: SeatId; className?: string }) {
  const color = SEAT_COLORS[seat % SEAT_COLORS.length]!;
  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded-md text-xs font-black text-white ${className ?? ''}`}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      {String.fromCharCode(65 + (seat % 26))}
    </span>
  );
}

/** SVG-Grafik für Galgen, Schneemann oder Blume passend zum aktuellen Fehlerstand. */
function ThemeIllustration({
  theme,
  mistakes,
  maxMistakes,
}: {
  theme: HangmanTheme;
  mistakes: number;
  maxMistakes: number;
}) {
  // Auf 10 Normschritte abbilden, damit 6, 8 und 10 Fehlversuche die ganze Grafik nutzen
  const scaledMistakes = Math.round((mistakes / maxMistakes) * 10);
  const remaining = Math.max(0, maxMistakes - mistakes);

  if (theme === 'snowman') {
    // 10 Teile des Schneemanns verschwinden nach und nach von oben/außen
    const showRightArm = scaledMistakes < 1;
    const showLeftArm = scaledMistakes < 2;
    const showHat = scaledMistakes < 3;
    const showScarf = scaledMistakes < 4;
    const showNose = scaledMistakes < 5;
    const showSmile = scaledMistakes < 6;
    const showEyes = scaledMistakes < 7;
    const showHead = scaledMistakes < 8;
    const showMiddle = scaledMistakes < 9;
    const showBottom = scaledMistakes < 10;

    return (
      <svg viewBox="0 0 180 140" className="h-32 w-44 sm:h-36 sm:w-48" aria-label={`Noch ${remaining} Versuche`}>
        {/* Boden & Schmelzpfütze */}
        <ellipse
          cx="90"
          cy="126"
          rx={28 + scaledMistakes * 3.5}
          ry={6 + scaledMistakes * 0.4}
          fill="#bae6fd"
          opacity="0.85"
        />
        {/* Unterer Schneeball */}
        {showBottom && (
          <circle cx="90" cy="102" r="24" fill="#f8fafc" stroke="#64748b" strokeWidth="2.5" />
        )}
        {/* Mittlerer Schneeball */}
        {showMiddle && (
          <>
            <circle cx="90" cy="68" r="18" fill="#f8fafc" stroke="#64748b" strokeWidth="2.5" />
            <circle cx="90" cy="63" r="2" fill="#1e293b" />
            <circle cx="90" cy="73" r="2" fill="#1e293b" />
          </>
        )}
        {/* Zweig-Arme */}
        {showLeftArm && (
          <path d="M 72 64 L 46 50 M 54 54 L 48 44" stroke="#78350f" strokeWidth="3" strokeLinecap="round" />
        )}
        {showRightArm && (
          <path d="M 108 64 L 134 50 M 126 54 L 132 44" stroke="#78350f" strokeWidth="3" strokeLinecap="round" />
        )}
        {/* Kopf */}
        {showHead && (
          <circle cx="90" cy="39" r="14" fill="#f8fafc" stroke="#64748b" strokeWidth="2.5" />
        )}
        {/* Augen */}
        {showHead && showEyes && (
          <>
            <circle cx="85" cy="35" r="2" fill="#0f172a" />
            <circle cx="95" cy="35" r="2" fill="#0f172a" />
          </>
        )}
        {/* Karottennase */}
        {showHead && showNose && (
          <polygon points="90,38 106,41 90,43" fill="#f97316" />
        )}
        {/* Lächeln */}
        {showHead && showSmile && (
          <path d="M 84 45 Q 90 50 96 45" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
        )}
        {/* Roter Schal */}
        {showMiddle && showScarf && (
          <>
            <path d="M 76 52 Q 90 57 104 52" fill="none" stroke="#ef4444" strokeWidth="5" strokeLinecap="round" />
            <path d="M 98 53 L 103 68" stroke="#ef4444" strokeWidth="4.5" strokeLinecap="round" />
          </>
        )}
        {/* Zylinderhut */}
        {showHead && showHat && (
          <>
            <rect x="74" y="23" width="32" height="4" rx="2" fill="#1e293b" />
            <rect x="80" y="9" width="20" height="15" rx="2" fill="#1e293b" />
            <rect x="80" y="19" width="20" height="3" fill="#ef4444" />
          </>
        )}
      </svg>
    );
  }

  if (theme === 'flower') {
    const petals = Array.from({ length: maxMistakes }, (_, i) => i);
    return (
      <svg viewBox="0 0 180 140" className="h-32 w-44 sm:h-36 sm:w-48" aria-label={`Noch ${remaining} Blütenblätter`}>
        {/* Hügel & Stängel */}
        <ellipse cx="90" cy="130" rx="48" ry="8" fill="#22c55e" opacity="0.35" />
        <path d="M 90 62 Q 94 95 90 128" fill="none" stroke="#16a34a" strokeWidth="5" strokeLinecap="round" />
        <path d="M 91 96 Q 112 84 116 94 Q 104 104 91 98" fill="#22c55e" />
        <path d="M 89 104 Q 68 92 64 102 Q 76 112 89 106" fill="#22c55e" />

        {/* Blütenblätter (verschwinden mit jedem Fehler) */}
        {petals.map((idx) => {
          const active = idx < remaining;
          const angleDeg = (idx / maxMistakes) * 360 - 90;
          const rad = (angleDeg * Math.PI) / 180;
          const cx = 90 + Math.cos(rad) * 28;
          const cy = 54 + Math.sin(rad) * 28;
          return (
            <ellipse
              key={idx}
              cx={cx}
              cy={cy}
              rx="13"
              ry="7.5"
              transform={`rotate(${angleDeg} ${cx} ${cy})`}
              fill={active ? '#facc15' : '#cbd5e1'}
              stroke={active ? '#eab308' : '#94a3b8'}
              strokeWidth="1.8"
              opacity={active ? 1 : 0.22}
            />
          );
        })}

        {/* Blütenmitte */}
        <circle cx="90" cy="54" r="15" fill="#f97316" stroke="#c2410c" strokeWidth="2.5" />
        <circle cx="85" cy="51" r="2" fill="#0f172a" />
        <circle cx="95" cy="51" r="2" fill="#0f172a" />
        {remaining > 0 ? (
          <path d="M 84 58 Q 90 63 96 58" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
        ) : (
          <path d="M 84 61 Q 90 56 96 61" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
        )}
      </svg>
    );
  }

  // Klassischer Galgen ('gallows')
  return (
    <svg viewBox="0 0 180 140" className="h-32 w-44 sm:h-36 sm:w-48" aria-label={`${mistakes} von ${maxMistakes} Fehlern`}>
      {/* 1: Bodenbalken */}
      {scaledMistakes >= 1 && (
        <line x1="25" y1="128" x2="115" y2="128" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
      )}
      {/* 2: Senkrechter Pfosten */}
      {scaledMistakes >= 2 && (
        <line x1="50" y1="128" x2="50" y2="18" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
      )}
      {/* 3: Querbalken */}
      {scaledMistakes >= 3 && (
        <line x1="50" y1="18" x2="118" y2="18" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
      )}
      {/* 4: Stützstrebe */}
      {scaledMistakes >= 4 && (
        <line x1="50" y1="42" x2="74" y2="18" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      )}
      {/* 5: Seil */}
      {scaledMistakes >= 5 && (
        <line x1="118" y1="18" x2="118" y2="36" stroke="#d97706" strokeWidth="3" strokeLinecap="round" />
      )}
      {/* 6: Kopf */}
      {scaledMistakes >= 6 && (
        <circle cx="118" cy="48" r="12" fill="none" stroke="currentColor" strokeWidth="3.2" />
      )}
      {/* 7: Rumpf */}
      {scaledMistakes >= 7 && (
        <line x1="118" y1="60" x2="118" y2="92" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      )}
      {/* 8: Linker Arm */}
      {scaledMistakes >= 8 && (
        <line x1="118" y1="68" x2="100" y2="82" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      )}
      {/* 9: Rechter Arm */}
      {scaledMistakes >= 9 && (
        <line x1="118" y1="68" x2="136" y2="82" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      )}
      {/* 10: Beine */}
      {scaledMistakes >= 10 && (
        <>
          <line x1="118" y1="92" x2="103" y2="114" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
          <line x1="118" y1="92" x2="133" y2="114" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function Board({
  view,
  viewer,
  legalMoves,
  onMove,
  seatNames,
  humanSeats,
}: BoardProps<HangmanState, HangmanMove>) {
  const gameResult = result(view);
  const [activeHumanSeat, setActiveHumanSeat] = useState<SeatId>(0);

  // Welches Sitzplatz-Brett wird angezeigt?
  const isRace = view.mode === 'race';
  const defaultSeat: SeatId =
    typeof viewer === 'number'
      ? viewer
      : humanSeats && humanSeats.length > 0
        ? humanSeats[0]!.seat
        : 0;

  const activeSeat: SeatId =
    isRace && humanSeats && humanSeats.length > 1
      ? (humanSeats.find((h) => h.seat === activeHumanSeat)?.seat ?? defaultSeat)
      : defaultSeat;

  const activeHs =
    isRace && humanSeats && humanSeats.length > 1
      ? humanSeats.find((h) => h.seat === activeSeat)
      : undefined;

  const effectiveMoves = activeHs ? activeHs.legalMoves : legalMoves;
  const triggerMove = (move: HangmanMove) => {
    if (activeHs) activeHs.onMove(move);
    else onMove(move);
  };

  const board = isRace ? (view.boards[activeSeat] ?? view.boards[0]!) : view.boards[0]!;
  const canGuess = !gameResult && !board.done && effectiveMoves.length > 0;
  const guessedSet = new Set(board.guessedLetters);
  const wrongSet = new Set(board.wrongLetters);

  const nameOf = (s: SeatId) => seatNames?.[s] ?? `Platz ${s + 1}`;

  // Physische Tastaturunterstützung
  useEffect(() => {
    if (!canGuess) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const upper = e.key.toUpperCase();
      if (ALPHABET.includes(upper) && !guessedSet.has(upper)) {
        e.preventDefault();
        triggerMove({ type: 'guess', letter: upper });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canGuess, board.guessedLetters, activeSeat]);

  return (
    <div className="hm-root">
      {/* Im Wettrennen-Modus: kompakte Fortschrittsleiste aller Spieler oben */}
      {isRace && view.seats > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-2.5 py-1.5 text-xs">
          {view.boards.map((b, sIdx) => {
            const stats = revealedStats(b.maskedWord);
            const isMe = sIdx === activeSeat;
            return (
              <button
                key={sIdx}
                type="button"
                disabled={!humanSeats || humanSeats.length <= 1}
                onClick={() => humanSeats && humanSeats.length > 1 && setActiveHumanSeat(sIdx)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-bold ${
                  isMe ? 'border-ink bg-bg text-ink' : 'border-line text-muted'
                }`}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: SEAT_COLORS[sIdx % SEAT_COLORS.length] }}
                />
                <span>{nameOf(sIdx)}</span>
                <span className="opacity-80">
                  {b.done
                    ? `🏁 ${b.wordsWon}/${view.totalRounds}`
                    : `Wort ${b.roundIndex + 1}/${view.totalRounds} (${stats.revealed}/${stats.total})`}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Hauptbühne */}
      <div className="hm-stage">
        {/* Kopfzeile mit Themenpaket, Wort-Nummer & verbleibenden Versuchen */}
        <div className="flex w-full flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
          <span className="rounded-full border border-line bg-bg px-3 py-1 font-bold">
            {CATEGORY_LABELS[view.category]}
          </span>
          <span className="font-bold text-muted">
            {board.done
              ? `Alle ${view.totalRounds} Wörter beendet (${board.wordsWon} gelöst)`
              : `Wort ${board.roundIndex + 1} von ${view.totalRounds} · Noch ${Math.max(0, view.maxMistakes - board.mistakes)} Versuche`}
          </span>
        </div>

        {/* Rückblick auf das soeben abgeschlossene Wort */}
        {board.lastWord && (
          <div
            className={`w-full max-w-md rounded-xl border px-3 py-1.5 text-center text-xs font-bold sm:text-sm ${
              board.lastWord.won
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300'
            }`}
          >
            {board.lastWord.won ? '🎉 Gelöst: ' : '💡 Gesucht war: '}
            <strong className="underline">{board.lastWord.displayWord}</strong> (Wort {board.lastWord.round},{' '}
            {board.lastWord.mistakes} Fehler)
          </div>
        )}

        {/* Illustration (Schneemann / Blume / Galgen) */}
        <div className="flex flex-col items-center">
          <ThemeIllustration
            theme={view.theme}
            mistakes={board.mistakes}
            maxMistakes={view.maxMistakes}
          />
        </div>

        {/* Gesuchtes Wort als Buchstaben-Slots */}
        <div className="hm-word-box" aria-live="polite">
          {[...board.maskedWord].map((ch, idx) => {
            if (ch === ' ' || ch === '-') {
              return (
                <span key={idx} className="hm-letter-sep">
                  {ch === '-' ? '–' : ' '}
                </span>
              );
            }
            const revealed = ch !== '_';
            return (
              <span
                key={idx}
                className={`hm-letter-slot ${revealed ? 'hm-letter-slot-revealed' : ''}`}
              >
                {revealed ? ch : ''}
              </span>
            );
          })}
        </div>

        {/* Bildschirm-Tastatur A–Z + Ä, Ö, Ü */}
        {!gameResult && !board.done && (
          <div className="hm-keyboard" role="group" aria-label="Buchstaben wählen">
            {ALPHABET.map((letter) => {
              const isGuessed = guessedSet.has(letter);
              const isWrong = wrongSet.has(letter);
              const isHit = isGuessed && !isWrong;

              return (
                <button
                  key={letter}
                  type="button"
                  disabled={!canGuess || isGuessed}
                  onClick={() => triggerMove({ type: 'guess', letter })}
                  className={`hm-key ${isHit ? 'hm-key-hit' : ''} ${isWrong ? 'hm-key-miss' : ''}`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export const gameUi: GameUi<HangmanState, HangmanMove> = {
  Board,
  SeatSymbol: HangmanSymbol,
  seatLabel: (seat) => `Platz ${seat + 1}`,
  seatDetail: (view, seat) => {
    const score = view.scores[seat] ?? 0;
    const b = view.mode === 'coop' ? view.boards[0] : view.boards[seat];
    return `${score} Pkt.${b ? ` · ${b.wordsWon}/${view.totalRounds} ✓` : ''}`;
  },
  sounds: {
    hit: 'buchstabe-richtig',
    miss: 'galgen-falsch',
    wordWon: 'paar',
    wordLost: 'galgen-verloren',
  },
};
