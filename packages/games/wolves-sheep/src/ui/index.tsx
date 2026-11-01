/**
 * Die Oberfläche von Wölfe im Schafspelz. Nachts sieht sie für alle Rollen gleich aus, damit
 * niemand am Bildschirm der Nachbarn etwas abliest. Tags erscheint geheimes Wissen nur, solange
 * die Rollenkarte gedrückt ist – auch weil beim Hot-Seat alle auf dasselbe Gerät schauen.
 */
import type { SeatId } from '@brett-und-blatt/engine';
import type { BoardProps, GameUi } from '@brett-und-blatt/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { nightTargets, type DepartureCause, type Phase, type Role, type WolvesSheepMove, type WolvesSheepState } from '../rules';
import './styles.css';

const ROLE_LABELS: Record<Role, string> = {
  wolf: '🐺 Wolf',
  examiner: '🔍 Prüfer',
  sheep: '🐑 Schaf',
  shepherd: '🧑‍🌾 Hirte',
  hound: '🐕 Hütehund',
  binder: '🎀 Bandstifter',
  lamb: '🐥 Neugieriges Lamm',
  stray: '🐐 Zugelaufenes Schaf',
  narrator: '🎙️ Erzähler',
};

const ROLE_HINTS: Record<Role, string> = {
  wolf: 'Du wählst nachts mit dem Rudel ein Schaf, das versprengt wird. Tags gibst du dich als Schaf aus.',
  examiner: 'Du siehst jede Nacht die Rolle einer Person. Verrate dich nicht zu früh, sonst holen dich die Wölfe.',
  sheep: 'Du hörst zu, beobachtest und stimmst ab. Nachts tippst du an, wer verdächtig wirkt; das bleibt deine Notiz.',
  shepherd: 'Du siehst das Opfer der Nacht. Einmal in der Partie holst du es mit dem Hirtenruf zurück, einmal weist du jemanden mit dem Stab aus.',
  hound: 'Wenn du ausscheidest, packst du noch eine Person, die mit dir die Herde verlässt.',
  binder: 'Du hast in der ersten Nacht zwei Personen verbunden. Geht eine, geht auch die andere.',
  lamb: 'Du darfst einmal je Nacht linsen und siehst dann einen Wolf. Wirst du erwischt, trifft es dich statt des Opfers.',
  stray: 'Du durftest zu Beginn gegen eine der übrigen Karten tauschen. Du bist geblieben, was du warst: ein Schaf.',
  narrator: 'Du leitest das Spiel, spielst nicht mit und siehst alles. Verrate nichts.',
};

/** Erzähltexte zum Vorlesen; sie nennen nichts, was nicht ohnehin alle wissen. */
const STORY: Partial<Record<Phase, string>> = {
  preround: 'Es wird Abend. Die Herde kommt zur Ruhe, und wer neu dazustößt, sucht seinen Platz.',
  night: 'Die Herde schläft. Zwischen den Schafen schleichen Wölfe im Schafspelz umher.',
  dawn: 'Die ersten Sonnenstrahlen kommen. Noch ist es still auf der Weide.',
  election: 'Die Herde wacht auf und kommt zusammen. Wer soll die Glocke tragen?',
  debate: 'Die Sonne steht über der Weide. Die Herde sucht die Wölfe in ihrer Mitte.',
  vote: 'Der Herdenrat tritt zusammen. Alle zeigen auf den, dem sie misstrauen.',
};

/** Die Überschrift einer Phase: öffentlich, also auch für die Tafel. */
function publicTitle(view: WolvesSheepState): string {
  switch (view.phase) {
    case 'preround':
      return '🌒 Vor der ersten Nacht';
    case 'night':
      return `🌙 Nacht ${view.day}`;
    case 'dawn':
      return '🌅 Morgengrauen';
    case 'election':
      return '🔔 Wahl des Leithammels';
    case 'debate':
      return `☀️ Morgen ${view.day}`;
    case 'vote':
      return '⚖️ Herdenrat';
    case 'pending':
      return view.pending[0]?.kind === 'shoot' ? '🐕 Der Hütehund packt zu' : '🔔 Die Glocke geht weiter';
    case 'done':
      if (view.winner === 'wolves') return '🐺 Die Wölfe gewinnen';
      if (view.winner === 'flock') return '🐑 Die Herde gewinnt';
      return view.winner === 'pair' ? '🎀 Die Verbundenen gewinnen' : 'Niemand gewinnt';
  }
}

const CAUSE_LABELS: Record<DepartureCause, string> = { wolves: 'wurde versprengt', council: 'wurde vom Rat geschickt', hound: 'wurde vom Hütehund gepackt', grief: 'ist mitgegangen', left: 'ist gegangen' };

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

/** Was zuletzt öffentlich geschah: das Ergebnis des Rats, der Nacht oder der Wahl. */
function newsText(view: WolvesSheepState, name: (seat: SeatId) => string): string {
  const of = (causes: DepartureCause[], day: number) =>
    view.departures
      .filter((entry) => entry.day === day && causes.includes(entry.cause))
      .map((entry) => `${name(entry.seat)} (${ROLE_LABELS[entry.role]}) ${CAUSE_LABELS[entry.cause]}.`)
      .join(' ');
  if (view.phase === 'night') {
    const council = view.history.at(-1);
    if (!council || council.day !== view.day - 1) return '';
    const tie = council.out === null ? 'Der Rat war sich nicht einig. Niemand musste gehen.' : '';
    return [tie, of(['council', 'hound', 'grief'], view.day - 1)].filter(Boolean).join(' ');
  }
  if (view.phase === 'election' || view.phase === 'debate' || view.phase === 'pending') {
    const night = of(['wolves', 'hound', 'grief', 'council'], view.day);
    const election = view.phase === 'debate' ? view.elections.at(-1) : undefined;
    const bell = election && election.day === view.day ? (election.elected === null ? 'Die Wahl ging unentschieden aus.' : `${name(election.elected)} trägt jetzt die Glocke.`) : '';
    return [night || (view.phase === 'pending' ? '' : 'Diese Nacht blieb die Herde ganz.'), bell].filter(Boolean).join(' ');
  }
  return '';
}

/** Wer in der laufenden Runde noch fehlt. Nur der Erzähler sieht das; allen anderen fehlen die Einträge. */
function waitingFor(view: WolvesSheepState): SeatId[] {
  const voting = view.phase === 'election' || view.phase === 'vote';
  return view.alive.flatMap((alive, seat) => (alive && !(voting ? view.voted[seat] : view.confirmed[seat]) ? [seat] : []));
}

/**
 * Die Tafel für den Beamer. Sie liest nur öffentliche Felder (Phase, Ausgeschiedene, Glocke,
 * abgeschlossene Abstimmungen), ist also auch dann sicher, wenn der Erzähler sie öffnet.
 */
function Wallboard({ view, seatNames, invite, debateLeft, onClose }: { view: WolvesSheepState; seatNames: string[]; invite?: { code: string; link: string }; debateLeft: number; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Vollbild, wo der Browser es erlaubt; sonst füllt die Tafel einfach das Fenster.
    ref.current?.requestFullscreen?.().catch(() => undefined);
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    const onChange = () => !document.fullscreenElement && onClose();
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onChange);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
    };
  }, [onClose]);
  const name = (seat: SeatId) => seatNames[seat] ?? `Platz ${seat + 1}`;
  const finished = view.phase === 'done';
  const council = view.history.at(-1);
  const showCount = view.phase === 'night' && council?.day === view.day - 1;
  return (
    <div ref={ref} className="ws-wall" data-night={view.phase === 'preround' || view.phase === 'night' || view.phase === 'dawn'} role="dialog" aria-label="Tafel">
      <button type="button" className="ws-wall-close" aria-label="Tafel schließen" onClick={onClose}>
        ✕
      </button>
      <h2>{publicTitle(view)}</h2>
      {STORY[view.phase] && <p className="ws-story">{STORY[view.phase]}</p>}
      {view.phase === 'debate' && view.debateSeconds > 0 && <p className="ws-wall-clock">{clockText(debateLeft)}</p>}
      <p className="ws-news">{newsText(view, name)}</p>
      <div className="ws-wall-people">
        {seatNames.map((seatName, seat) => {
          if (seat === view.narrator) return null;
          const gone = view.departures.find((entry) => entry.seat === seat);
          const role = gone?.role ?? (finished ? view.roles[seat] : null);
          const votes = showCount ? council!.votes.reduce<number>((sum, vote, voter) => sum + (vote === seat ? (voter === view.leader ? 2 : 1) : 0), 0) : 0;
          return (
            <div key={seat} className="ws-wall-person" data-gone={gone !== undefined}>
              <span>
                {seat === view.leader && view.alive[seat] ? '🔔 ' : ''}
                {seatName}
              </span>
              {role && <small>{ROLE_LABELS[role]}</small>}
              {votes > 0 && <small>{votes === 1 ? '1 Stimme' : `${votes} Stimmen`}</small>}
            </div>
          );
        })}
      </div>
      {invite && <p className="ws-wall-code">Raum: {invite.code}</p>}
    </div>
  );
}

function Board({ view, legalMoves, onMove, viewer, seatNames, invite }: BoardProps<WolvesSheepState, WolvesSheepMove>) {
  const [wall, setWall] = useState(false);
  const closeWall = useCallback(() => setWall(false), []);
  const [cardShown, setCardShown] = useState(false);
  const [chosenBallot, setBallot] = useState<SeatId | null>(null);
  const [save, setSave] = useState(false);
  const [expel, setExpel] = useState<SeatId | null>(null);
  const [binding, setBinding] = useState<SeatId[]>([]);
  const roundKey = `${view.phase}-${view.day}`;
  const debateLeft = useCountdown(view.phase === 'debate' ? view.debateSeconds : 0, roundKey);
  // Beim Hot-Seat bleibt die Oberfläche stehen, wenn das Gerät weitergeht: Die Auswahl gehört nur dem, der sie traf.
  useEffect(() => {
    setBallot(null);
    setSave(false);
    setExpel(null);
    setBinding([]);
  }, [roundKey, viewer]);

  const name = (seat: SeatId) => seatNames[seat] ?? `Platz ${seat + 1}`;
  const ownSeat = viewer === 'spectator' ? null : viewer;
  const ownRole = ownSeat === null ? null : view.roles[ownSeat];
  const ownAlive = ownSeat !== null && view.alive[ownSeat] === true;
  const isNarrator = ownSeat !== null && ownSeat === view.narrator;
  const finished = view.phase === 'done';
  const inRound = view.phase === 'preround' || view.phase === 'night' || view.phase === 'dawn';
  const dark = inRound;

  const firstMove = legalMoves[0];
  const pendingHead = view.phase === 'pending' ? view.pending[0] : undefined;
  const ownTurnPending = pendingHead !== undefined && pendingHead.seat === ownSeat;
  const isStrayChoice = firstMove?.type === 'swap';
  const isBinding = firstMove?.type === 'bind';
  const isShepherd = firstMove?.type === 'shepherd';
  // Nach der ersten Wahl liefert `legalMoves` nur das Festlegen; umentscheiden bleibt erlaubt.
  const picking = legalMoves.some((move) => move.type === 'tap' || move.type === 'confirm');
  const ownPick = ownSeat === null ? null : view.picks[ownSeat];
  const locked = ownSeat !== null && view.locked[ownSeat] === true;
  const roundDone = ownSeat !== null && view.confirmed[ownSeat] === true;
  const voted = ownSeat !== null && view.voted[ownSeat] === true;

  const ballotTargets = new Set(legalMoves.flatMap((move) => (move.type === 'vote' || move.type === 'elect' || move.type === 'shoot' || move.type === 'passBell') && move.target !== null ? [move.target] : []));
  const ballot = chosenBallot !== null && ballotTargets.has(chosenBallot) ? chosenBallot : null;
  const expelTargets = new Set(legalMoves.flatMap((move) => (move.type === 'shepherd' && move.expel !== null ? [move.expel] : [])));
  const canSave = legalMoves.some((move) => move.type === 'shepherd' && move.save);

  // Tags ist Wissen nur beim Drücken der Karte sichtbar. Ausgeschiedene und das Ende verbergen nichts.
  const allKnowing = finished || (ownSeat !== null && !ownAlive && !ownTurnPending);
  const showKnowledge = allKnowing || dark || cardShown;
  const secretMark = (seat: SeatId): Role | null => {
    if (!showKnowledge) return null;
    if (seat === ownSeat) return ownRole ?? null;
    const examined = view.examinations.filter((entry) => entry.target === seat).at(-1);
    if (view.lambSights.some((sight) => sight.target === seat)) return 'wolf';
    return view.roles[seat] ?? examined?.role ?? null;
  };
  const boundMark = (seat: SeatId) => showKnowledge && view.bound !== null && view.bound.includes(seat);

  const selectable = (seat: SeatId): boolean => {
    if (ballotTargets.has(seat) || expelTargets.has(seat)) return true;
    if (isBinding) return view.alive[seat] === true;
    return picking && ownSeat !== null && nightTargets(view, ownSeat).includes(seat);
  };
  const choose = (seat: SeatId) => {
    if (ballotTargets.has(seat)) setBallot(seat);
    else if (isShepherd) setExpel(expel === seat ? null : seat);
    else if (isBinding) setBinding(binding.includes(seat) ? binding.filter((entry) => entry !== seat) : [...binding.slice(-1), seat]);
    else onMove({ type: 'tap', target: seat });
  };
  const packOn = (seat: SeatId) => (ownRole === 'wolf' && view.phase === 'night' ? view.picks.filter((pick, other) => pick === seat && other !== ownSeat && view.roles[other] === 'wolf').length : 0);

  const latestExam = locked && view.phase === 'night' && ownRole === 'examiner' ? view.examinations.at(-1) : undefined;
  const latestSight = view.phase === 'night' && view.lambPeeked ? view.lambSights.at(-1) : undefined;
  const debateTimed = view.phase === 'debate' && view.debateSeconds > 0;

  const title = publicTitle(view);
  let hint = '';
  switch (view.phase) {
    case 'preround':
      if (roundDone) hint = 'Du bist fertig. Gleich wird es dunkel.';
      else if (isStrayChoice) hint = 'Das sind die zwei übrigen Karten. Du darfst eine nehmen oder bleiben, was du bist.';
      else if (isBinding) hint = 'Wähle zwei Personen, die ab jetzt verbunden sind. Du darfst dich selbst wählen.';
      else if (locked) hint = 'Deine Wahl steht.';
      else if (ownAlive) hint = 'Wer wirkt auf dich verdächtig?';
      else hint = 'Die Herde legt sich schlafen.';
      break;
    case 'night':
      if (!ownAlive) hint = ownSeat === null ? 'Die Herde schläft.' : 'Die Herde schläft. Du siehst jetzt alles, darfst aber nichts verraten.';
      else if (roundDone) hint = 'Du bist fertig. Warte auf den Morgen.';
      else if (locked) hint = latestExam ? `${name(latestExam.target)} ist: ${ROLE_LABELS[latestExam.role]}. Merke es dir gut.` : 'Deine Wahl steht.';
      else if (ownRole === 'wolf') hint = 'Wähle mit dem Rudel ein Schaf aus.';
      else if (ownRole === 'examiner') hint = 'Wessen Rolle möchtest du sehen?';
      else hint = 'Wer wirkt auf dich verdächtig?';
      break;
    case 'dawn':
      if (!ownAlive) hint = ownSeat === null ? 'Der Morgen naht.' : 'Der Morgen naht. Du darfst nichts verraten.';
      else if (roundDone) hint = 'Du bist fertig. Gleich wird es hell.';
      else if (isShepherd) hint = view.nightVictim === null ? 'Heute Nacht gibt es kein Opfer.' : `Heute Nacht trifft es ${name(view.nightVictim)}.`;
      else if (locked) hint = 'Deine Entscheidung steht.';
      else hint = 'Die Nacht geht zu Ende.';
      break;
    case 'election':
      if (!ownAlive) hint = 'Die Herde wählt.';
      else hint = voted ? 'Deine Stimme ist abgegeben.' : 'Wer soll die Glocke tragen? Seine Stimme zählt im Rat doppelt.';
      break;
    case 'debate':
      hint = debateTimed ? `Beratet euch, wer ein Wolf sein könnte. Noch ${clockText(debateLeft)}.` : 'Beratet euch, wer ein Wolf sein könnte.';
      break;
    case 'vote':
      if (!ownAlive) hint = 'Der Rat stimmt ab.';
      else hint = voted ? 'Deine Stimme ist abgegeben.' : 'Wer soll die Herde verlassen?';
      break;
    case 'pending':
      if (pendingHead?.kind === 'shoot') {
        hint = ownTurnPending ? 'Du scheidest aus. Wen packst du noch?' : `${name(pendingHead.seat)} war der Hütehund und wählt jetzt.`;
      } else if (pendingHead) {
        hint = ownTurnPending ? 'Wem gibst du die Glocke?' : `${name(pendingHead.seat)} bestimmt, wer die Glocke trägt.`;
      }
      break;
    case 'done':
      if (view.winner === 'wolves') {
        hint = 'Das letzte Schaf ist fort.';
      } else if (view.winner === 'flock') {
        hint = 'Alle Wölfe sind entdeckt.';
      } else if (view.winner === 'pair') {
        hint = 'Der Wolf wohnt beim Lamm: Nur diese zwei sind übrig.';
      } else {
        hint = 'Es ist niemand mehr übrig.';
      }
      break;
  }
  if (isNarrator && !finished) {
    const open = waitingFor(view).map(name);
    if (view.phase === 'debate') hint = debateTimed ? `Noch ${clockText(debateLeft)}. Du kannst den Rat auch früher eröffnen.` : 'Eröffne den Rat, wenn alle so weit sind.';
    else if (view.phase !== 'pending') hint = open.length > 0 ? `Es fehlen noch: ${open.join(', ')}.` : 'Alle sind fertig.';
  }
  const news = newsText(view, name);
  const story = STORY[view.phase];

  const submitBallot = () => {
    if (ballot === null || !firstMove) return;
    if (firstMove.type === 'vote' || firstMove.type === 'elect' || firstMove.type === 'shoot' || firstMove.type === 'passBell') onMove({ type: firstMove.type, target: ballot });
  };
  const ballotLabel = firstMove?.type === 'shoot' ? 'Zupacken' : firstMove?.type === 'passBell' ? 'Glocke weitergeben' : firstMove?.type === 'elect' ? 'Wählen' : 'Stimme abgeben';

  return (
    <div className="ws-board" data-night={dark}>
      <div className="ws-status" role="status">
        <strong>{title}</strong>
        {story && <em className="ws-story">{story}</em>}
        {news && <span className="ws-news">{news}</span>}
        <span>{hint}</span>
        {latestSight && !locked && <span>Du hast gelinst: {name(latestSight.target)} ist ein Wolf.</span>}
      </div>
      {(viewer === 'spectator' || isNarrator) && (
        <button type="button" className="ws-action ws-action-quiet" onClick={() => setWall(true)}>
          📺 Tafel für den Beamer
        </button>
      )}
      {wall && <Wallboard view={view} seatNames={seatNames} invite={invite} debateLeft={debateLeft} onClose={closeWall} />}
      {ownRole && !finished && !isNarrator && <RoleCard role={ownRole} shown={cardShown} onShow={setCardShown} />}
      {isStrayChoice && (
        <div className="ws-choices">
          {view.middle.map((card, index) => (
            <button key={index} type="button" className="ws-person" onClick={() => onMove({ type: 'swap', card: index })}>
              {card ? ROLE_LABELS[card] : '?'} nehmen
            </button>
          ))}
          {legalMoves.some((move) => move.type === 'swap' && move.card === null) && (
            <button type="button" className="ws-person" onClick={() => onMove({ type: 'swap', card: null })}>
              Bleiben
            </button>
          )}
        </div>
      )}
      {!isStrayChoice && (
        <div className="ws-circle">
          {seatNames.map((seatName, seat) => {
            if (seat === view.narrator) return null;
            const mark = view.alive[seat] ? secretMark(seat) : view.roles[seat];
            const pack = packOn(seat);
            const chosen =
              ((view.phase === 'night' || view.phase === 'preround') && ownPick === seat) ||
              ballot === seat ||
              (isShepherd && expel === seat) ||
              (isBinding && binding.includes(seat)) ||
              (voted && ownSeat !== null && view.votes[ownSeat] === seat);
            return (
              <button key={seat} type="button" className="ws-person" disabled={!selectable(seat)} data-chosen={chosen} data-gone={!view.alive[seat]} onClick={() => choose(seat)}>
                <span className="ws-person-name">
                  {seat === view.leader && view.alive[seat] ? '🔔 ' : ''}
                  {seatName}
                  {seat === ownSeat ? ' (du)' : ''}
                </span>
                {mark && <small>{ROLE_LABELS[mark]}</small>}
                {boundMark(seat) && <small>🎀 verbunden</small>}
                {pack > 0 && <small>🐺 × {pack}</small>}
              </button>
            );
          })}
        </div>
      )}
      {isShepherd && (
        <div className="ws-shepherd">
          {canSave && (
            <label className="ws-check">
              <input type="checkbox" checked={save} onChange={(event) => setSave(event.target.checked)} /> Hirtenruf: Opfer zurückholen
            </label>
          )}
          <p>{expelTargets.size > 0 ? (expel === null ? 'Hirtenstab: Tippe jemanden an, um ihn auszuweisen. Du darfst es auch lassen.' : `Hirtenstab: ${name(expel)} wird ausgewiesen.`) : 'Dein Hirtenstab ist verbraucht.'}</p>
          <button type="button" className="ws-action" onClick={() => onMove({ type: 'shepherd', save: save && canSave, expel })}>
            Entscheidung festlegen
          </button>
        </div>
      )}
      {isBinding && (
        <button type="button" className="ws-action" disabled={binding.length !== 2} onClick={() => onMove({ type: 'bind', a: binding[0]!, b: binding[1]! })}>
          {binding.length === 2 ? `${name(binding[0]!)} und ${name(binding[1]!)} verbinden` : 'Zwei Personen wählen'}
        </button>
      )}
      {legalMoves.some((move) => move.type === 'peek') && (
        <button type="button" className="ws-action ws-action-quiet" onClick={() => onMove({ type: 'peek' })}>
          👀 Linsen
        </button>
      )}
      {picking && (
        <button type="button" className="ws-action" disabled={ownPick === null} onClick={() => onMove({ type: 'confirm' })}>
          Wahl festlegen
        </button>
      )}
      {legalMoves.some((move) => move.type === 'done') && (
        <button type="button" className="ws-action" onClick={() => onMove({ type: 'done' })}>
          Weiter
        </button>
      )}
      {ballotTargets.size > 0 && (
        <button type="button" className="ws-action" disabled={ballot === null} onClick={submitBallot}>
          {ballot === null ? ballotLabel : `${ballotLabel}: ${name(ballot)}`}
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
    if (seat === view.narrator) return ROLE_LABELS.narrator;
    const departure = view.departures.find((entry) => entry.seat === seat);
    // Nur die Rolle: Mit dem Grund würde die Zeile für die schmale Spielerleiste zu lang.
    return departure ? ROLE_LABELS[departure.role] : null;
  },
  concealTurns: (view) => ['preround', 'night', 'dawn', 'election', 'vote'].includes(view.phase),
};
