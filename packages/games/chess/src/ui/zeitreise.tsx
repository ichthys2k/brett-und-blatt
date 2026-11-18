import { createContext, useState, useSyncExternalStore, type CSSProperties } from 'react';

/**
 * Zeitmaschine (Easter Egg, #512): Ein kleines Astrolabium rechts oben im Schachspiel reist bei jedem
 * Klick in den nächsten Jahrgang. Brett, Figuren und Leisten erscheinen dann im Stil dieser Zeit –
 * vom Buchdruck 1455 bis zum OLED-Bildschirm 2026, danach wieder die gewohnte Ansicht.
 * Alles ist reines CSS (`zeitreise.css`); die Wahl gilt je Gerät.
 */
export const ERAS = ['1455', '1910', '1948', '1982', '1986', '1988', '1989', '2007', '2026'] as const;
export type Era = (typeof ERAS)[number];

export const ERA_NAMES: Record<Era, string> = {
  '1455': 'Buchdruck',
  '1910': 'Zeitung',
  '1948': 'Wochenschau',
  '1982': 'Terminal',
  '1986': 'Videoband',
  '1988': 'Pixelschlacht',
  '1989': 'Taschen-LCD',
  '2007': 'E-Paper',
  '2026': 'OLED',
};

const KEY = 'brett-und-blatt:schach-zeitreise';
const listeners = new Set<() => void>();

function isEra(value: unknown): value is Era {
  return typeof value === 'string' && (ERAS as readonly string[]).includes(value);
}

function load(): Era | null {
  try {
    const raw = typeof window === 'undefined' ? null : window.localStorage.getItem(KEY);
    return isEra(raw) ? raw : null;
  } catch {
    return null;
  }
}

let current: Era | null = load();

/** Der Jahrgang nach `era`; nach dem letzten geht es zurück in die Gegenwart (`null`). */
export function nextEra(era: Era | null): Era | null {
  if (era === null) return ERAS[0];
  return ERAS[ERAS.indexOf(era) + 1] ?? null;
}

export function setChessEra(era: Era | null): void {
  current = era;
  try {
    if (era) window.localStorage.setItem(KEY, era);
    else window.localStorage.removeItem(KEY);
  } catch {
    // Ohne Speicher gilt die Wahl nur bis zum Neuladen.
  }
  for (const listener of listeners) listener();
}

export function useChessEra(): Era | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => null,
  );
}

/** Steht ein Jahrgang fest, zeigen alle Figuren Zeichen statt gemalter Bilder – die lassen sich umfärben. */
export const EraContext = createContext<Era | null>(null);

/** Körnung für Papier und Film als SVG-Rauschen; als CSS-Variable gesetzt, damit die Adresse nicht im CSS steht. */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export const eraStyle = (era: Era | null): CSSProperties | undefined => (era ? ({ '--ch-era-grain': GRAIN } as CSSProperties) : undefined);

/** Das Astrolabium mit Sanduhr – die mittelalterliche Zeitmaschine. */
export function TimeMachine({ era }: { era: Era | null }) {
  const [spin, setSpin] = useState(0);
  const next = nextEra(era);
  const label = `Zeitmaschine${era ? ` – jetzt ${era}, ${ERA_NAMES[era]}` : ''}. Weiter ${next ? `nach ${next} (${ERA_NAMES[next]})` : 'in die Gegenwart'}`;
  return (
    <div className="ch-time">
      {era && (
        <span className="ch-time-year" aria-hidden="true">
          {era}
        </span>
      )}
      <button
        type="button"
        className={`ch-time-machine ${era ? 'ch-time-on' : ''}`}
        aria-label={label}
        title={label}
        onClick={() => {
          setSpin((s) => s + 1);
          setChessEra(next);
        }}
      >
        <svg key={spin} className={spin ? 'ch-time-spin' : undefined} viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="13.5" className="ch-time-ring" />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i * Math.PI) / 6;
            return <line key={i} x1={16 + Math.sin(a) * 11} y1={16 - Math.cos(a) * 11} x2={16 + Math.sin(a) * 13.5} y2={16 - Math.cos(a) * 13.5} className="ch-time-tick" />;
          })}
          <circle cx="16" cy="16" r="8.6" className="ch-time-rete" />
          <path d="M12.2 9.4h7.6M12.2 22.6h7.6M13 9.4c0 4 5.4 4.8 5.4 6.6S13 18.6 13 22.6M19 9.4c0 4-5.4 4.8-5.4 6.6s5.4 2.6 5.4 6.6" className="ch-time-glass" />
          <path d="M14.4 20.8h3.2L16 18.6z" className="ch-time-sand" />
          <circle cx="16" cy="2.5" r="1.6" className="ch-time-ring" />
        </svg>
      </button>
    </div>
  );
}
