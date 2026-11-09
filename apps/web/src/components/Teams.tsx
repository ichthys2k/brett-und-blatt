import type { LobbySeat } from '@brett-und-blatt/online';
import { t } from '../i18n';

/** Farben der Teams in der Lobby (Gelb/Blau, auch für Farbschwäche unterscheidbar). */
const TEAM_STYLES = ['border-amber-500 bg-amber-500/15', 'border-sky-600 bg-sky-600/15', 'border-emerald-600 bg-emerald-600/15', 'border-rose-600 bg-rose-600/15'];
const TEAM_ICONS = ['☀️', '🌙', '🌿', '🔥'];

export function TeamChip({ names, team, onSwitch }: { names: string[]; team: number; onSwitch?: () => void }) {
  const label = `${TEAM_ICONS[team] ?? '●'} ${names[team] ?? `Team ${team + 1}`}`;
  const className = `rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${TEAM_STYLES[team] ?? ''}`;
  return onSwitch ? (
    <button type="button" className={`${className} min-h-8`} title={t('online.teamSwitch')} aria-label={`${label} – ${t('online.teamSwitch')}`} onClick={onSwitch}>
      {label} ⇄
    </button>
  ) : (
    <span className={className}>{label}</span>
  );
}

/** Wie viele besetzte Plätze je Team – damit die Raumleitung sieht, ob die Teams ausgeglichen sind. */
export function TeamSummary({ names, seats, minPerTeam = 1 }: { names: string[]; seats: LobbySeat[]; minPerTeam?: number }) {
  // Verlangt das Spiel Mindestgrößen (Kreuzbinokel: zwei je Team), zählen alle Plätze – so wertet es die Spielregel.
  const sizes = names.map((_, team) => seats.filter((s) => s.team === team).length);
  const uneven = minPerTeam > 1 && sizes.some((n) => n < minPerTeam);
  const counts = names.map((_, team) => seats.filter((s) => s.team === team && (s.kind === 'bot' || s.memberId !== null)).length);
  return (
    <div className="space-y-1">
      <p className="flex flex-wrap gap-2 text-sm">
        {names.map((name, team) => (
          <span key={team} className={`rounded-full border px-2 py-0.5 ${TEAM_STYLES[team] ?? ''}`}>
            {TEAM_ICONS[team]} {name}: <strong>{counts[team]}</strong>
          </span>
        ))}
      </p>
      {uneven && (
        <p role="status" className="text-xs text-danger">
          {t('online.teamsUneven', { n: minPerTeam })}
        </p>
      )}
    </div>
  );
}

