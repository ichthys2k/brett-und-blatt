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
export function TeamSummary({ names, seats }: { names: string[]; seats: LobbySeat[] }) {
  const counts = names.map((_, team) => seats.filter((s) => s.team === team && (s.kind === 'bot' || s.memberId !== null)).length);
  return (
    <p className="flex flex-wrap gap-2 text-sm">
      {names.map((name, team) => (
        <span key={team} className={`rounded-full border px-2 py-0.5 ${TEAM_STYLES[team] ?? ''}`}>
          {TEAM_ICONS[team]} {name}: <strong>{counts[team]}</strong>
        </span>
      ))}
    </p>
  );
}

