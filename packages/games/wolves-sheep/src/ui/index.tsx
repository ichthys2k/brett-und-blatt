/**
 * Erste, schlichte Oberfläche von Wölfe im Schafspelz: Dorfkreis, Rollenkarte und ein
 * Hauptknopf. Nachts sieht sie für alle Rollen gleich aus, damit niemand am Bildschirm
 * der Nachbarn etwas abliest. Die Gestaltung folgt in Schritt 2 des Spielplans.
 */
import type { SeatId } from '@brett-und-blatt/engine';
import type { BoardProps, GameUi } from '@brett-und-blatt/ui';
import { useState } from 'react';
import type { Role, WolvesSheepMove, WolvesSheepState } from '../rules';
import './styles.css';

const ROLE_LABELS: Record<Role, string> = { wolf: '🐺 Wolf im Schafspelz', examiner: '🔍 Prüfer', sheep: '🐑 Schaf' };

const ROLE_HINTS: Record<Role, string> = {
  wolf: 'Wählt nachts mit dem Rudel ein Schaf, das versprengt wird.',
  examiner: 'Sieht jede Nacht die Rolle einer Person. Verrate dich nicht zu früh.',
  sheep: 'Tippt nachts an, wer verdächtig wirkt. Das bleibt deine eigene Notiz.',
};

function RoleCard({ role }: { role: Role }) {
  const [shown, setShown] = useState(false);
  return (
    <button
      type="button"
      className="ws-card"
      onPointerDown={() => setShown(true)}
      onPointerUp={() => setShown(false)}
      onPointerCancel={() => setShown(false)}
      onPointerLeave={() => setShown(false)}
      onKeyDown={(event) => event.key === ' ' && setShown(true)}
      onKeyUp={() => setShown(false)}
    >
      {shown ? `${ROLE_LABELS[role]}: ${ROLE_HINTS[role]}` : 'Gedrückt halten: deine Rolle ansehen'}
    </button>
  );
}

function statusText(view: WolvesSheepState, viewer: SeatId | 'spectator', seatNames: string[]): [string, string] {
  const name = (seat: SeatId) => seatNames[seat] ?? `Platz ${seat + 1}`;
  const alive = viewer !== 'spectator' && view.alive[viewer];
  switch (view.phase) {
    case 'night':
      if (!alive) return [`Nacht ${view.day}`, 'Die Herde schläft. Du schaust nur noch zu und schweigst.'];
      if (view.confirmed[viewer as SeatId]) return [`Nacht ${view.day}`, 'Du hast bestätigt. Warte auf den Morgen.'];
      return [`Nacht ${view.day}`, 'Tippe eine Person an und bestätige.'];
    case 'debate': {
      const last = view.departures.at(-1);
      const news = last && last.day === view.day && last.cause === 'wolves' ? `${name(last.seat)} wurde versprengt.` : 'Diese Nacht blieb die Herde ganz.';
      return [`Morgen ${view.day}`, `${news} Beratet euch, wer ein Wolf sein könnte.`];
    }
    case 'vote':
      return ['Herdenrat', alive ? 'Wer soll die Herde verlassen?' : 'Der Herdenrat stimmt ab.'];
    case 'done':
      if (view.winner === 'wolves') return ['Die Wölfe gewinnen', 'Das letzte Schaf ist fort.'];
      if (view.winner === 'flock') return ['Die Herde gewinnt', 'Alle Wölfe sind entdeckt.'];
      return ['Niemand gewinnt', 'Es ist niemand mehr übrig.'];
  }
}

function Board({ view, legalMoves, onMove, viewer, seatNames }: BoardProps<WolvesSheepState, WolvesSheepMove>) {
  const [title, text] = statusText(view, viewer, seatNames);
  const ownSeat = viewer === 'spectator' ? null : viewer;
  const ownRole = ownSeat === null ? null : view.roles[ownSeat];
  const canTap = view.phase === 'night' && ownSeat !== null && view.alive[ownSeat] === true && !view.confirmed[ownSeat];
  const ownPick = ownSeat === null ? null : view.picks[ownSeat];
  const voteTargets = new Set(legalMoves.flatMap((move) => (move.type === 'vote' && move.target !== null ? [move.target] : [])));
  const lastVote = view.history.at(-1);
  const packPicks = (seat: SeatId) => (ownRole === 'wolf' ? view.picks.filter((pick, other) => pick === seat && other !== ownSeat && view.roles[other] === 'wolf').length : 0);

  const selectable = (seat: SeatId) => {
    if (voteTargets.has(seat)) return true;
    if (!canTap || !view.alive[seat] || seat === ownSeat) return false;
    return !(ownRole === 'wolf' && view.roles[seat] === 'wolf');
  };
  const choose = (seat: SeatId) => onMove(voteTargets.has(seat) ? { type: 'vote', target: seat } : { type: 'tap', target: seat });

  return (
    <div className="ws-board">
      <div className="ws-status" role="status">
        <strong>{title}</strong>
        {text}
      </div>
      {ownRole && view.phase !== 'done' && <RoleCard role={ownRole} />}
      <div className="ws-circle">
        {seatNames.map((seatName, seat) => {
          const role = view.roles[seat];
          const examined = view.examinations.filter((entry) => entry.target === seat).at(-1);
          const known = !view.alive[seat] || view.phase === 'done' ? role : examined?.role ?? (ownRole === 'wolf' && role === 'wolf' ? role : null);
          const packCount = packPicks(seat);
          return (
            <button
              key={seat}
              type="button"
              className="ws-person"
              disabled={!selectable(seat)}
              data-chosen={view.phase === 'night' && ownPick === seat}
              data-gone={!view.alive[seat]}
              onClick={() => choose(seat)}
            >
              {seatName}
              {known && <small>{ROLE_LABELS[known]}</small>}
              {packCount > 0 && <small>🐺 × {packCount}</small>}
              {lastVote && view.phase !== 'night' && <small>{lastVote.votes.filter((vote) => vote === seat).length || ''}</small>}
            </button>
          );
        })}
      </div>
      {canTap && (
        <button type="button" className="ws-action" disabled={ownPick === null} onClick={() => onMove({ type: 'confirm' })}>
          Bestätigen
        </button>
      )}
      {legalMoves.some((move) => move.type === 'endDebate') && (
        <button type="button" className="ws-action" onClick={() => onMove({ type: 'endDebate' })}>
          Herdenrat eröffnen
        </button>
      )}
    </div>
  );
}

function SeatSymbol({ seat, className = '' }: { seat: SeatId; className?: string }) {
  return <span className={`ws-symbol ${className}`}>{seat + 1}</span>;
}

export const gameUi: GameUi<WolvesSheepState, WolvesSheepMove> = {
  Board,
  SeatSymbol,
  seatLabel: (seat) => `Platz ${seat + 1}`,
};
