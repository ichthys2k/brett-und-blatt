/**
 * Die Oberfläche von Wölfe im Schafspelz. Nachts sieht sie für alle Rollen gleich aus, damit
 * niemand am Bildschirm der Nachbarn etwas abliest. Tags erscheint geheimes Wissen nur, solange
 * die Rollenkarte gedrückt ist – auch weil beim Hot-Seat alle auf dasselbe Gerät schauen.
 */
import type { SeatId } from '@brett-und-blatt/engine';
import type { BoardProps, GameUi } from '@brett-und-blatt/ui';
import { useEffect, useState } from 'react';
import type { Role, WolvesSheepMove, WolvesSheepState } from '../rules';
import './styles.css';

const ROLE_LABELS: Record<Role, string> = { wolf: '🐺 Wolf', examiner: '🔍 Prüfer', sheep: '🐑 Schaf' };

const ROLE_HINTS: Record<Role, string> = {
  wolf: 'Du wählst nachts mit dem Rudel ein Schaf, das versprengt wird. Tags gibst du dich als Schaf aus.',
  examiner: 'Du siehst jede Nacht die Rolle einer Person. Verrate dich nicht zu früh, sonst holen dich die Wölfe.',
  sheep: 'Du hörst zu, beobachtest und stimmst ab. Nachts tippst du an, wer verdächtig wirkt; das bleibt deine Notiz.',
};

const CAUSE_LABELS = { wolves: 'versprengt', council: 'vom Rat geschickt', left: 'gegangen' } as const;

function RoleCard({ role, shown, onShow }: { role: Role; shown: boolean; onShow: (shown: boolean) => void }) {
  return (
    <button
      type="button"
      className="ws-card"
      data-shown={shown}
      onPointerDown={() => onShow(true)}
      onPointerUp={() => onShow(false)}
      onPointerCancel={() => onShow(false)}
      onPointerLeave={() => onShow(false)}
      onKeyDown={(event) => event.key === ' ' && onShow(true)}
      onKeyUp={() => onShow(false)}
      onContextMenu={(event) => event.preventDefault()}
    >
      {shown ? (
        <>
          <strong>{ROLE_LABELS[role]}</strong>
          <span>{ROLE_HINTS[role]}</span>
        </>
      ) : (
        'Gedrückt halten: deine Rolle ansehen'
      )}
    </button>
  );
}

/** Restzeit der Beratung. Gezählt wird ab dem Moment, in dem dieses Gerät den Morgen sieht. */
function useCountdown(seconds: number, resetKey: string): number {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    setLeft(seconds);
    if (seconds <= 0) return;
    const started = Date.now();
    const timer = setInterval(() => setLeft(Math.max(0, seconds - Math.floor((Date.now() - started) / 1000))), 1000);
    return () => clearInterval(timer);
  }, [seconds, resetKey]);
  return left;
}

function clockText(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Was zuletzt öffentlich geschah: das Ergebnis des Rats oder der Nacht. */
function newsText(view: WolvesSheepState, name: (seat: SeatId) => string): string {
  if (view.phase === 'night') {
    const council = view.history.at(-1);
    if (!council || council.day !== view.day - 1) return '';
    if (council.out === null) return 'Der Rat war sich nicht einig. Niemand musste gehen.';
    const role = view.departures.find((entry) => entry.seat === council.out)?.role;
    return `${name(council.out)} musste die Herde verlassen${role ? ` und war: ${ROLE_LABELS[role]}` : ''}.`;
  }
  if (view.phase === 'debate') {
    const taken = view.departures.filter((entry) => entry.day === view.day && entry.cause === 'wolves');
    if (taken.length === 0) return 'Diese Nacht blieb die Herde ganz.';
    return taken.map((entry) => `${name(entry.seat)} wurde versprengt und war: ${ROLE_LABELS[entry.role]}.`).join(' ');
  }
  return '';
}

function Board({ view, legalMoves, onMove, viewer, seatNames }: BoardProps<WolvesSheepState, WolvesSheepMove>) {
  const [cardShown, setCardShown] = useState(false);
  const [chosenBallot, setBallot] = useState<SeatId | null>(null);
  const roundKey = `${view.phase}-${view.day}`;
  const debateLeft = useCountdown(view.phase === 'debate' ? view.debateSeconds : 0, roundKey);
  // Beim Hot-Seat bleibt die Oberfläche stehen, wenn das Gerät weitergeht: Die Auswahl gehört nur dem, der sie traf.
  useEffect(() => setBallot(null), [roundKey, viewer]);

  const name = (seat: SeatId) => seatNames[seat] ?? `Platz ${seat + 1}`;
  const ownSeat = viewer === 'spectator' ? null : viewer;
  const ownRole = ownSeat === null ? null : view.roles[ownSeat];
  const ownAlive = ownSeat !== null && view.alive[ownSeat] === true;
  const finished = view.phase === 'done';
  const isNight = view.phase === 'night';

  const tapTargets = new Set(legalMoves.flatMap((move) => (move.type === 'tap' ? [move.target] : [])));
  // Nach der ersten Wahl liefert `legalMoves` nur die Bestätigung; umentscheiden bleibt erlaubt.
  const canRetap = isNight && ownAlive && !view.locked[ownSeat!];
  const voteTargets = new Set(legalMoves.flatMap((move) => (move.type === 'vote' && move.target !== null ? [move.target] : [])));
  const ballot = chosenBallot !== null && voteTargets.has(chosenBallot) ? chosenBallot : null;
  const ownPick = ownSeat === null ? null : view.picks[ownSeat];
  const locked = ownSeat !== null && view.locked[ownSeat] === true;
  const nightDone = ownSeat !== null && view.confirmed[ownSeat] === true;
  const voted = ownSeat !== null && view.voted[ownSeat] === true;
  const lastCouncil = view.history.at(-1);

  // Tags ist Wissen nur beim Drücken der Karte sichtbar. Ausgeschiedene und das Ende verbergen nichts.
  const showKnowledge = finished || !ownAlive || isNight || cardShown;
  const secretMark = (seat: SeatId): Role | null => {
    if (!showKnowledge) return null;
    if (seat === ownSeat) return ownRole ?? null;
    const examined = view.examinations.filter((entry) => entry.target === seat).at(-1);
    return view.roles[seat] ?? examined?.role ?? null;
  };

  const selectable = (seat: SeatId): boolean => {
    if (voteTargets.has(seat)) return true;
    if (tapTargets.has(seat)) return true;
    if (!canRetap || !view.alive[seat] || seat === ownSeat) return false;
    return !(ownRole === 'wolf' && view.roles[seat] === 'wolf');
  };
  const choose = (seat: SeatId) => {
    if (voteTargets.has(seat)) setBallot(seat);
    else onMove({ type: 'tap', target: seat });
  };
  const packOn = (seat: SeatId) => (ownRole === 'wolf' && ownAlive ? view.picks.filter((pick, other) => pick === seat && other !== ownSeat && view.roles[other] === 'wolf').length : 0);

  const latestExam = locked && ownRole === 'examiner' ? view.examinations.at(-1) : undefined;
  const debateTimed = view.phase === 'debate' && view.debateSeconds > 0;

  let title = '';
  let hint = '';
  switch (view.phase) {
    case 'night':
      title = `🌙 Nacht ${view.day}`;
      if (!ownAlive) hint = ownSeat === null ? 'Die Herde schläft.' : 'Die Herde schläft. Du siehst jetzt alles, darfst aber nichts verraten.';
      else if (nightDone) hint = 'Du bist fertig. Warte auf den Morgen.';
      else if (locked) hint = latestExam ? `${name(latestExam.target)} ist: ${ROLE_LABELS[latestExam.role]}. Merke es dir gut.` : 'Deine Wahl steht.';
      else if (ownRole === 'wolf') hint = 'Wähle mit dem Rudel ein Schaf aus.';
      else if (ownRole === 'examiner') hint = 'Wessen Rolle möchtest du sehen?';
      else hint = 'Wer wirkt auf dich verdächtig?';
      break;
    case 'debate':
      title = `☀️ Morgen ${view.day}`;
      hint = debateTimed ? `Beratet euch, wer ein Wolf sein könnte. Noch ${clockText(debateLeft)}.` : 'Beratet euch, wer ein Wolf sein könnte.';
      break;
    case 'vote':
      title = '🔔 Herdenrat';
      if (!ownAlive) hint = 'Der Rat stimmt ab.';
      else hint = voted ? 'Deine Stimme ist abgegeben.' : 'Wer soll die Herde verlassen?';
      break;
    case 'done':
      title = view.winner === 'wolves' ? '🐺 Die Wölfe gewinnen' : view.winner === 'flock' ? '🐑 Die Herde gewinnt' : 'Niemand gewinnt';
      hint = view.winner === 'wolves' ? 'Das letzte Schaf ist fort.' : view.winner === 'flock' ? 'Alle Wölfe sind entdeckt.' : 'Es ist niemand mehr übrig.';
      break;
  }
  const news = newsText(view, name);

  return (
    <div className="ws-board" data-night={isNight}>
      <div className="ws-status" role="status">
        <strong>{title}</strong>
        {news && <span className="ws-news">{news}</span>}
        <span>{hint}</span>
      </div>
      {ownRole && !finished && <RoleCard role={ownRole} shown={cardShown} onShow={setCardShown} />}
      <div className="ws-circle">
        {seatNames.map((seatName, seat) => {
          const mark = view.alive[seat] ? secretMark(seat) : view.roles[seat];
          const pack = packOn(seat);
          const chosen = (isNight && ownPick === seat) || ballot === seat || (voted && ownSeat !== null && view.votes[ownSeat] === seat);
          const lastVotes = view.phase !== 'night' && lastCouncil ? lastCouncil.votes.filter((vote) => vote === seat).length : 0;
          return (
            <button key={seat} type="button" className="ws-person" disabled={!selectable(seat)} data-chosen={chosen} data-gone={!view.alive[seat]} onClick={() => choose(seat)}>
              <span className="ws-person-name">
                {seatName}
                {seat === ownSeat ? ' (du)' : ''}
              </span>
              {mark && <small>{ROLE_LABELS[mark]}</small>}
              {pack > 0 && <small>🐺 × {pack}</small>}
              {finished && lastVotes > 0 && <small>{lastVotes} Stimmen zuletzt</small>}
            </button>
          );
        })}
      </div>
      {isNight && ownAlive && !nightDone && !locked && (
        <button type="button" className="ws-action" disabled={ownPick === null} onClick={() => onMove({ type: 'confirm' })}>
          Wahl festlegen
        </button>
      )}
      {isNight && ownAlive && locked && !nightDone && (
        <button type="button" className="ws-action" onClick={() => onMove({ type: 'done' })}>
          Weiter
        </button>
      )}
      {view.phase === 'vote' && ownAlive && !voted && (
        <button type="button" className="ws-action" disabled={ballot === null} onClick={() => ballot !== null && onMove({ type: 'vote', target: ballot })}>
          {ballot === null ? 'Stimme abgeben' : `Für ${name(ballot)} stimmen`}
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
  seatDetail: (view, seat) => {
    const departure = view.departures.find((entry) => entry.seat === seat);
    return departure ? `${ROLE_LABELS[departure.role]}, ${CAUSE_LABELS[departure.cause]}` : null;
  },
  concealTurns: (view) => view.phase === 'night' || view.phase === 'vote',
};
