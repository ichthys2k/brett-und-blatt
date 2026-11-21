import { randomSeed, sanitizeCustomCardCatalog, type GameEvent, type GameSession, type Result, type SeatId } from '@brett-und-blatt/engine';
import {
  CardInspectProvider,
  ClockRing,
  FocusZone,
  MoveCarouselBar,
  PlayerChip,
  formatClock,
  sideShieldSize,
  tableLayout,
  triggerGamepadHaptic,
  useElementSize,
  useInputContext,
  useInputIntent,
  useInputSource,
  usePromptItems,
  collectFocusableCandidates,
  pickZoneEntryTarget,
  type MoveCarouselItem,
} from '@brett-und-blatt/ui';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import type { AlbumSpec } from '@brett-und-blatt/ui';
import { useInputSettings } from '../lib/inputSettings';
import { AfterGameBar } from '../components/AfterGameBar';
import { Ceremony } from '../components/Ceremony';
import { Notes } from '../components/Notes';
import { hasNote, notesKey } from '../lib/notes';
import { Replay, canReplay } from '../components/Replay';
import { usePassRecorder } from '../lib/passRecorder';
import { setHandView, useHandView, useHandViewChoice } from '../lib/handView';
import { Button } from '../components/controls';
import { CustomCardsOverlay } from '../components/CustomCardsOverlay';
import { HowToOverlay } from '../components/HowTo';
import { MoreMenu } from '../components/MoreMenu';
import { PieceSetQuick } from '../components/PieceSetQuick';
import { SoundControl } from '../components/SoundControl';
import { useDismiss } from '../components/useDismiss';
import { t } from '../i18n';
import { getActiveGame, resumeGame, saveProgress, startGame, type ActiveGame } from '../lib/activeGame';
import { levelLabel } from '../lib/format';
import type { AfterState } from '../lib/online';
import type { LoadedGame } from '../lib/registry';
import { useGameMusic } from '../lib/music';
import { categoryOf } from '../lib/rubriken';
import { boardFocusTarget } from '../lib/turnFocus';
import { navigate, paths } from '../lib/router';
import { useSoundSettings } from '../lib/sound';
import { storage, type Profile } from '../lib/storage';
import { useGameSounds } from '../lib/useGameSounds';
import { useGameScene } from '../lib/gameScene';
import { seatIdentity } from '../lib/seatIdentity';
import { crestForRoom } from '../lib/crestText';
import { useWakeLock } from '../lib/useWakeLock';

export function Play() {
  const [active, setActive] = useState<ActiveGame | null>(() => getActiveGame());

  useEffect(() => {
    if (active) return;
    let cancelled = false;
    resumeGame().then((resumed) => {
      if (cancelled) return;
      if (resumed) setActive(resumed);
      else navigate(paths.home);
    });
    return () => {
      cancelled = true;
    };
  }, [active]);

  if (!active) return <p className="p-6 text-center text-muted">{t('play.loading')}</p>;
  return <LocalTable key={active.session.id} active={active} onRestart={setActive} />;
}

/** Eine Partie im Browser: speichern nach jedem Zug, neu starten, Revanche. */
/** Höhe der Kopfzeile über dem Spieltisch (px). */
const TABLE_BAR_HEIGHT = 56;

function LocalTable({ active, onRestart }: { active: ActiveGame; onRestart: (game: ActiveGame) => void }) {
  const restart = async (rotate: boolean) => {
    const config = active.session.config;
    const nextSeats = rotate ? [...config.seats.slice(1), config.seats[0]!] : config.seats;
    onRestart(await startGame({ ...config, seats: nextSeats, seed: randomSeed() }));
  };
  return <GameTable session={active.session} game={active.game} local={{ onChange: () => saveProgress(active.session), onRestart: restart }} />;
}

function resultTitle(result: Result, session: GameSession, online?: OnlineTableProps): string {
  const seats = session.config.seats;
  if (result.kind === 'draw') return t('play.draw');
  if (result.kind === 'loss') return t('play.lost');
  const humans = seats.map((seat, i) => (seat.kind === 'human' ? i : -1)).filter((i) => i >= 0);
  const winners = result.winners;
  const names = winners.map((seat) => { const s = seats[seat]; return s ? (s.avatar ? `${s.avatar} ${s.name}` : s.name) : '?'; }).join(' & ');
  if (online) return online.yourSeat !== null && winners.includes(online.yourSeat) ? t('play.youWon') : t('play.won', { name: names });
  if (seats.length === 1) return humans.length === 1 ? t('play.solved') : t('play.solvedBy', { name: seats[0]?.name ?? '' });
  if (humans.length === 1) return winners.includes(humans[0] as number) ? t('play.youWon') : t('play.botWon');
  return t('play.won', { name: names });
}

/** Was der Tisch online zusätzlich wissen muss. */
export interface OnlineTableProps {
  yourSeat: SeatId | null;
  isHost: boolean;
  /** Ersetzt den Hinweis auf die Raumleitung am Partieende, z. B. in Turnierpartien. */
  finishedNote?: string;
  onRestart?(rotate: boolean): void;
  onLobby(): void;
  onLeave(): void;
  /** Abstimmung am Rundenende (#298): Nochmal, anderes Spiel oder Aussteigen. */
  after?: { info: AfterState; seatCount: number; onVote(choice: 'again' | 'other'): void; onPropose(gameId: string): void; onPick(gameId: string): void };
  /** Avatare (Emojis) der Plätze in Sitzreihenfolge, falls bekannt. */
  avatars?: (string | null)[];
  /** Wappen der Plätze in Sitzreihenfolge, falls bekannt (#492). */
  crests?: (string | null)[];
  /** Z. B. die Plätze zum Übernehmen. */
  extra?: ReactNode;
  /** Knopf 💬 für Reaktionen und Schnellnachrichten; steht immer in der Kopfzeile (`inBar`: über dem Tisch). */
  chat?: (inBar: boolean) => ReactNode;
  /** Raumcode und Einladungslink – Spiele zeigen sie z. B. auf einer Tafel an. */
  invite?: { code: string; link: string };
  /** Leiste über den Knöpfen, etwa die Abstimmung übers Zurücknehmen. */
  bar?: ReactNode;
  /** Tisch-Bildschirm (#100): ohne Zurück-Knopf und Anleitung, nichts zum Bedienen. */
  display?: boolean;
  /** Wie viele Tisch-Bildschirme im Raum verbunden sind; dann bietet der Tisch die Hand-Ansicht an. */
  displays?: number;
}

interface GameTableProps {
  session: GameSession;
  game: LoadedGame;
  local?: { onChange(): void; onRestart(rotate: boolean): void };
  online?: OnlineTableProps;
}

/** Der Spieltisch – lokal (Solo, Hot-Seat) und online gleichermaßen. */
export function GameTable({ session, game, local, online }: GameTableProps) {
  const { ui, info } = game;
  const isOnline = online !== undefined;
  const handViewChosen = useHandView();
  const handViewChoice = useHandViewChoice();
  /** „Nein“ auf das Angebot gilt, bis die Seite neu geladen wird. */
  const [handViewDeclined, setHandViewDeclined] = useState(false);
  // Hand-Ansicht (#100): nur online mit eigenem Platz und nur in Spielen, die sie können.
  const offerHandView = !handViewDeclined && handViewChoice === null && (online?.displays ?? 0) > 0 && Boolean(ui.handView) && online?.yourSeat !== null && !online?.display && !session.result;
  const handOnly = handViewChosen && Boolean(ui.handView) && online !== undefined && online.yourSeat !== null && !online.display;
  const localRef = useRef(local);
  localRef.current = local;
  // Im Ref, damit Sicht und Ereignisse auch bei Bot-Zügen im selben Durchlauf ankommen.
  const eventsRef = useRef<GameEvent[]>([]);
  const [, setEvents] = useState<GameEvent[]>([]);
  const [, setTick] = useState(0);
  const [hint, setHint] = useState<unknown>(null);
  const [hintMissing, setHintMissing] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  /** Hot-Seat mit Geheimnissen: Wer hat zuletzt seine Sicht aufgedeckt? */
  const [revealedFor, setRevealedFor] = useState<SeatId | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  /** Siegerehrung geschlossen (gilt bis zur nächsten Partie in diesem Tisch). */
  const [ceremonyClosed, setCeremonyClosed] = useState(false);
  /** Nachspielen (#99) geöffnet. */
  const [replaying, setReplaying] = useState(false);
  /** Notizblock (#105) geöffnet. */
  const [notesOpen, setNotesOpen] = useState(false);
  /** Anki-Kartenset Modal geöffnet. */
  const [showCustomCards, setShowCustomCards] = useState(false);

  useSyncExternalStore(
    (onChange) => session.subscribe(onChange),
    () => session.version,
  );

  useEffect(
    () =>
      session.subscribe((change) => {
        eventsRef.current = change.events;
        setEvents(change.events);
        setHint(null);
        setHintMissing(false);
        localRef.current?.onChange();
      }),
    [session],
  );

  const isClient = online !== undefined && !online.isHost;
  const soundSettings = useSoundSettings();
  const playMusic = !soundSettings.musicOff && (!isClient || Boolean(soundSettings.clientMusic));

  useGameSounds(session, ui.sounds, online ? online.yourSeat : undefined, ui.ownSoundsOnly, ui.haptics);
  useGameMusic(info.id, playMusic && !info.ownMusic);
  useGameScene(info.id);

  // Uhren prüfen und anzeigen.
  useEffect(() => {
    if (!session.timed) return;
    const id = window.setInterval(() => {
      session.tick();
      setTick((n) => n + 1);
    }, 200);
    return () => window.clearInterval(id);
  }, [session]);

  // Wer das Fenster wechselt oder das Handy sperrt, soll keine Zeit verlieren (nur lokal – online läuft die Uhr beim Server).
  useEffect(() => {
    if (isOnline) return;
    const onVisibility = () => {
      if (document.hidden && session.timed) session.pause();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [session, isOnline]);

  const seats = session.config.seats;
  const playersRef = useRef<HTMLElement>(null);
  // Zähler der angenommenen Züge von Menschen an diesem Gerät (#608): steht als `data-human-moves` am Spielfeld,
  // damit Proben wie `scripts/controller-audit.mjs` erkennen, ob ein Zug gelungen ist. Wird direkt am Element gesetzt
  // (kein Neuzeichnen); React fasst das Attribut danach nicht mehr an, weil sich sein Wert im JSX nicht ändert.
  const tableRef = useRef<HTMLElement>(null);
  const humanMoves = useRef(0);
  const countHumanMove = (ok: boolean): boolean => {
    if (ok) {
      humanMoves.current += 1;
      tableRef.current?.setAttribute('data-human-moves', String(humanMoves.current));
    }
    return ok;
  };
  const [rootRef, rootSize] = useElementSize<HTMLDivElement>();
  const inputCtx = useInputContext();
  const [sideOpen, setSideOpen] = useState(false);
  const sideBox = useRef<HTMLDivElement>(null);
  useDismiss(sideOpen, useCallback(() => setSideOpen(false), []), sideBox);
  useInputIntent((intent) => {
    if (intent === 'menu') {
      setSideOpen((v) => !v);
      return true;
    }
    if (intent === 'cancel' && sideOpen) {
      setSideOpen(false);
      menuButtonRef.current?.focus();
      return true;
    }
    return false;
  }, 15);
  // Schublade (#485): Beim Öffnen springt der Fokus hinein, nach dem Schließen (Esc, Aktion) zurück auf ☰.
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerWasOpen = useRef(false);
  useEffect(() => {
    if (sideOpen) {
      drawerWasOpen.current = true;
      drawerRef.current?.querySelector<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])')?.focus();
    } else if (drawerWasOpen.current) {
      drawerWasOpen.current = false;
      const active = document.activeElement;
      if (!active || active === document.body || sideBox.current?.contains(active)) menuButtonRef.current?.focus();
    }
  }, [sideOpen]);
  /** Ein Tipp auf einen auslösenden Knopf in der Schublade schließt sie; Schalter (`data-keep-open`) lassen sie offen. */
  const closeDrawerOnAction = (event: ReactMouseEvent) => {
    const button = (event.target as HTMLElement).closest('button');
    if (button && !button.closest('details, [data-keep-open]') && button.getAttribute('aria-pressed') === null) setSideOpen(false);
  };
  const layout = tableLayout({
    width: rootSize.width,
    height: rootSize.height,
    seats: seats.length,
    seatsAround: ui.seatsAround,
    fullBleed: ui.fullBleed,
  });
  const { crowded, collapsed: collapsedSide } = layout;
  const around = layout.mode === 'ring';
  const collapsedTop = layout.mode === 'bar';
  const fullBleed = Boolean(ui.fullBleed) && !around && rootSize.height > 0;
  const sideShield = layout.mode === 'side' ? sideShieldSize(seats.length, rootSize.height) : 0;
  const humans = seats.map((seat, i) => (seat.kind === 'human' ? i : -1)).filter((i) => i >= 0);
  const result = session.result;
  useWakeLock(!result && !session.paused);
  const { trophy: trophyLaid, reward: rewardNote } = usePassRecorder({ session, gameId: info.id, ...(info.ratedAfter ? { ratedAfter: info.ratedAfter } : {}), seatScore: ui.seatScore as ((view: never, seat: number) => number | string | null) | undefined, seriesRoundsDone: ui.seriesRoundsDone as ((view: never) => number) | undefined, album: ui.album as AlbumSpec<never> | undefined, learning: ui.learning as { report: (view: never, seat: number) => { row: string; sure: boolean }[] } | undefined, ...(online ? { online: { yourSeat: online.yourSeat, tournament: online.finishedNote !== undefined, display: online.display } } : {}) });
  const current = session.currentSeats();
  /** Der Mensch, der jetzt am Gerät dran ist – auch während einer Pause. */
  const turnSeat = current.find((seat) => session.isHuman(seat) && !session.isAway(seat));

  // Mehrere Menschen an einem Gerät und Geheimnisse (z. B. Handkarten): Vor jedem
  // Zug wird das Gerät übergeben, erst dann wird die eigene Sicht aufgedeckt.
  const needsHandover = !online && (info.privateViews ?? info.hiddenInformation) && humans.length >= 2;
  const handoverSeat = needsHandover && !result && turnSeat !== undefined && revealedFor !== turnSeat ? turnSeat : null;
  useEffect(() => {
    if (handoverSeat !== null && session.timed) session.pause();
  }, [handoverSeat, session]);

  // Beim Weiterreichen des Geräts schließt der Notizblock, damit der Nächste ihn nicht offen vorfindet.
  useEffect(() => {
    if (handoverSeat !== null) setNotesOpen(false);
  }, [handoverSeat]);
  const actingSeat = handoverSeat === null ? session.humanSeatsToAct()[0] : undefined;
  let viewer: SeatId | 'spectator';
  if (online) viewer = online.yourSeat ?? 'spectator';
  else if (!needsHandover) viewer = humans.length === 1 ? (humans[0] as number) : (actingSeat ?? 'spectator');
  else viewer = revealedFor !== null && revealedFor === turnSeat ? revealedFor : 'spectator';
  const legalMoves = actingSeat !== undefined ? session.legalMoves(actingSeat) : [];
  // Online geht der Hinweis nur an den, dessen Platz der Computer übernommen hat.
  const awaySeats = humans.filter((seat) => session.isAway(seat) && (!online || seat === online.yourSeat));
  const publicView = session.view('spectator');
  // Lokal wie online steht das Kartenset als geprüfter JSON-Text in den Optionen (#270).
  const customCatalog = sanitizeCustomCardCatalog((session.config.options as Record<string, unknown> | undefined)?.customCardCatalog) ?? undefined;
  const cardCatalogChecksum =
    ((publicView as any)?.cardCatalogChecksum as string | undefined) ??
    ((session.config.options as any)?.cardCatalogChecksum as string | undefined) ??
    (customCatalog?.checksum || undefined);

  const askHint = async () => {
    if (actingSeat === undefined) return;
    const move = await session.hint(actingSeat);
    setHint(move);
    setHintMissing(move === null);
  };

  // Deutlich zeigen, wenn ein Mensch an diesem Gerät dran ist (nur bei Spielen, in denen reihum gezogen wird).
  const concealed = !result && (ui.concealTurns?.(publicView) ?? false);
  const yourMove = !concealed && !result && !session.paused && handoverSeat === null && actingSeat !== undefined && current.length === 1 && seats.length > 1;
  useEffect(() => {
    inputCtx?.setActiveSeatIndex(typeof actingSeat === 'number' ? actingSeat : null);
    return () => inputCtx?.setActiveSeatIndex(null);
  }, [inputCtx, actingSeat]);

  useEffect(() => {
    if (!yourMove) return;
    triggerGamepadHaptic('turn', loadHapticsPref());
    const before = document.title;
    document.title = `● ${t('play.yourTurn')} – ${before}`;
    return () => {
      document.title = before;
    };
  }, [yourMove]);

  useEffect(() => {
    if (!result) {
      setCeremonyClosed(false);
      setReplaying(false);
    }
  }, [result]);

  // Wer dran ist, soll auch in einer rollbaren Spielerleiste zu sehen sein.
  const turnChip = concealed ? undefined : current[0];
  useEffect(() => {
    const list = playersRef.current;
    const chip = turnChip === undefined ? undefined : (list?.children[turnChip] as HTMLElement | undefined);
    if (!list || !chip) return;
    list.scrollTo({
      left: chip.offsetLeft - (list.clientWidth - chip.offsetWidth) / 2,
      top: chip.offsetTop - (list.clientHeight - chip.offsetHeight) / 2,
      behavior: 'smooth',
    });
  }, [turnChip, sideOpen]);
  const reasonText =
    result?.reason === 'time' ? t('play.reason.time') : result?.reason === 'resign' ? t('play.reason.resign') : result?.reason === 'agreement' ? t('play.reason.agreement') : null;

  let status: string;
  if (result) status = resultTitle(result, session, online);
  else if (session.paused) status = t('play.paused');
  else {
    const seat = concealed ? undefined : current[0];
    const seatConfig = seat === undefined ? undefined : seats[seat];
    const name = seat === undefined ? '' : (seatConfig?.avatar ? `${seatConfig.avatar} ${seatConfig.name}` : (seatConfig?.name ?? ''));
    if (seat === undefined) status = '';
    // Geteilter Bildschirm (z. B. Kartenblitz): mehrere Menschen am Gerät handeln zugleich.
    else if (!online && current.filter((s) => humans.includes(s)).length > 1) status = t('play.together');
    else if (session.isThinking(seat)) status = t('play.thinking', { name });
    else if (online ? seat === online.yourSeat : humans.length === 1 && seat === humans[0]) status = t('play.yourTurn');
    else status = t('play.turnOf', { name });
  }

  // Wer aufgibt: online der eigene Platz, lokal wer gerade zieht – sonst der erste Mensch,
  // der noch im Spiel ist (bei Vierer-Schach scheidet nur diese Farbe aus).
  const resignSeat = online
    ? (online.yourSeat ?? undefined)
    : actingSeat !== undefined && session.canResign(actingSeat)
      ? actingSeat
      : humans.find((seat) => session.canResign(seat));
  const canResign = resignSeat !== undefined && session.canResign(resignSeat);
  const resign = () => {
    if (resignSeat === undefined) return;
    const resignName = seats[resignSeat]; const resignLabel = resignName ? (resignName.avatar ? `${resignName.avatar} ${resignName.name}` : resignName.name) : '';
    const question = humans.length > 1 && !online ? t('play.resignConfirmNamed', { name: resignLabel }) : t('play.resignConfirm');
    if (window.confirm(question)) session.resign(resignSeat);
  };

  const endAction = result && !online ? (ui.endAction?.(publicView) ?? null) : null;

  // Knöpfe nach Partieende – unter dem Spielfeld und in der Siegerehrung.
  // Nur neu berechnen, wenn sich die Partie ändert (sonst rechnet das Nachspielen bei jedem Zeichnen neu).
  const replayData = useMemo(() => (result ? (session.replayData?.() ?? null) : null), [session, session.version, Boolean(result)]); // eslint-disable-line react-hooks/exhaustive-deps
  const replayButton = canReplay(replayData) ? (
    <Button
      onClick={() => {
        setCeremonyClosed(true);
        setReplaying(true);
      }}
    >
      ▶ {t('replay.open')}
    </Button>
  ) : null;
  const afterBar =
    online?.after?.info.canVote && result ? (
      <AfterGameBar after={online.after.info} gameId={info.id} seatCount={online.after.seatCount} onVote={online.after.onVote} onPropose={online.after.onPropose} onPick={online.after.onPick} onLeave={online.onLeave} />
    ) : null;
  const resultActionsOnline = online ? (
    online.isHost ? (
      <>
        {online.onRestart && (
          <Button variant="primary" data-bub-autofocus="result" onClick={() => online.onRestart?.(true)}>
            {t('play.rematch')}
          </Button>
        )}
        <Button variant={online.onRestart ? 'secondary' : 'primary'} data-bub-autofocus={online.onRestart ? undefined : 'result'} onClick={online.onLobby}>
          {t('online.toLobby')}
        </Button>
      </>
    ) : (
      online.display || afterBar ? null : <p className="text-sm text-muted">{online.finishedNote ?? t('online.waitForHost')}</p>
    )
  ) : null;
  const resultActionsBase = online ? (
    <>
      {afterBar}
      {resultActionsOnline}
    </>
  ) : (
    <>
      {endAction ? (
        <Button variant="primary" data-bub-autofocus="result" onClick={() => navigate(endAction.path)}>
          {endAction.label}
        </Button>
      ) : (
        <Button variant="primary" data-bub-autofocus="result" onClick={() => local?.onRestart(true)}>
          {t('play.rematch')}
        </Button>
      )}
      <Button onClick={() => navigate(paths.setup(info.id))}>{t('play.settings')}</Button>
      <Button variant="ghost" onClick={() => navigate(paths.home)}>
        {t('play.menu')}
      </Button>
    </>
  );
  // Siegerehrung geschlossen: Die eingeklappte Leiste zeigt die wichtigste Aktion (Revanche) selbst (#485).
  const barAction =
    result && ceremonyClosed ? (
      online ? (
        online.isHost && online.onRestart ? (
          <Button variant="primary" className="min-h-9 flex-none px-2.5 text-sm" onClick={() => online.onRestart?.(true)}>
            {t('play.rematch')}
          </Button>
        ) : null
      ) : endAction ? (
        <Button variant="primary" className="min-h-9 flex-none px-2.5 text-sm" onClick={() => navigate(endAction.path)}>
          {endAction.label}
        </Button>
      ) : (
        <Button variant="primary" className="min-h-9 flex-none px-2.5 text-sm" onClick={() => local?.onRestart(true)}>
          {t('play.rematch')}
        </Button>
      )
    ) : null;
  const resultActions = (
    <>
      {replayButton}
      {resultActionsBase}
    </>
  );

  // Controller am Spieltisch (#618): Fokus bei Zugbeginn, Übergabe und Partieende; B verlässt nie die Partie.
  const { inputSource } = useInputSource();
  const inputSettings = useInputSettings();
  const placeBoardFocus = (requireLost: boolean) => {
    if (typeof document === 'undefined') return;
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const zone = document.querySelector<HTMLElement>('[data-focus-zone="play-board"]');
    const focusLost = !active || active === document.body || !active.isConnected || (active as HTMLButtonElement).disabled === true;
    const target = boardFocusTarget({
      source: inputSource,
      focusLost,
      focusInBoard: requireLost ? !focusLost : Boolean(zone && active && zone.contains(active)),
      menuOpen: sideOpen && collapsedSide,
      dialogOpen: showHowTo || document.querySelector('.bub-vkb-key, .bub-inspect-panel') !== null,
      handover: handoverSeat !== null,
      result: Boolean(result),
      yourMove,
    });
    if (target === 'handover' || target === 'result') {
      const el = [...document.querySelectorAll<HTMLElement>(`[data-bub-autofocus="${target}"]`)].find((e) => e.getClientRects().length > 0);
      const fallback = target === 'result' && !ceremonyClosed ? document.querySelector<HTMLElement>('.bub-ceremony-x') : null;
      const goal = el ?? fallback;
      if (goal && goal !== active) goal.focus({ preventScroll: true });
      return;
    }
    if (target !== 'board' || !zone) return;
    const { candidates, byId } = collectFocusableCandidates(zone);
    const entry = inputCtx?.getZones().find((z) => z.id === 'play-board');
    const id = pickZoneEntryTarget(candidates, entry?.lastFocusedId ?? null);
    if (id) byId.get(id)?.focus({ preventScroll: true });
  };
  // Zustandswechsel: eigener Zug beginnt, Übergabe, Ergebnis, Menü oder Fenster zu, Eingabe wechselt.
  useEffect(() => {
    const frame = requestAnimationFrame(() => placeBoardFocus(false));
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yourMove, handoverSeat, Boolean(result), ceremonyClosed, sideOpen, showHowTo, inputSource]);
  // Nach jedem Zug: nur eingreifen, wenn der Fokus verloren ging (z. B. das gewählte Feld verschwand).
  useEffect(() => {
    const frame = requestAnimationFrame(() => placeBoardFocus(true));
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.version]);
  // B vom Controller verlässt nie die Partie: Was kein anderer Baustein verbraucht (Fenster, Menü, Auswahl), endet hier.
  useInputIntent((intent, source) => intent === 'cancel' && source === 'gamepad', -5);
  usePromptItems(
    handoverSeat !== null
      ? [{ key: 'A', label: t('play.prompt.reveal') }]
      : result
        ? [
            { key: 'A', label: t('play.prompt.select') },
            { key: '☰', label: t('play.prompt.menu') },
          ]
        : inputSettings.mode === 'legalMoves'
          ? [
              { key: '◀▶', label: t('play.prompt.chooseMove') },
              { key: 'A', label: t('play.prompt.execute') },
              { key: '☰', label: t('play.prompt.menu') },
            ]
          : [
              { key: 'A', label: t('play.prompt.select') },
              { key: 'B', label: t('play.prompt.cancel') },
              { key: 'X', label: t('play.prompt.inspect') },
              { key: 'LB/RB', label: t('play.prompt.zone') },
              { key: '☰', label: t('play.prompt.menu') },
            ],
  );

  const humanSeats = seats.filter((seat) => seat.kind === 'human');
  // Lokal gilt das eigene Profil nur, wenn genau ein Mensch am Gerät spielt (#492).
  const ownProfile = !online && humanSeats.length === 1 ? {
    avatar: storage.loadProfile()?.avatar ?? null,
    crest: crestForRoom(storage.loadCrestText()) ?? null,
  } : null;

  const seatIdentityFor = (index: SeatId) => {
    const seat = seats[index]!;
    return seatIdentity({
      index,
      kind: seat.kind,
      gameId: info.id,
      seatAvatar: seat.avatar,
      memberAvatar: online?.avatars?.[index],
      memberCrest: online?.crests?.[index],
      own: seat.kind === 'human' ? ownProfile : null,
    });
  };

  const seatChip = (index: SeatId) => {
    const seat = seats[index]!;
    const id = seatIdentityFor(index);
    return (
      <PlayerChip
        key={index}
        name={seat.name}
        avatar={id.avatar}
        crest={id.crest}
        symbol={<ui.SeatSymbol seat={index} seats={seats.length} />}
        score={ui.seatScore?.(publicView, index)}
        detail={ui.seatDetail?.(publicView, index) ?? (seat.kind === 'bot' ? `${ui.seatLabel(index, seats.length)} · ${levelLabel(seat.level ?? 'medium')}` : ui.seatLabel(index, seats.length))}
        active={!concealed && !result && current.includes(index)}
        thinking={!concealed && session.isThinking(index) && seat.kind === 'bot'}
        away={session.isAway(index)}
        winner={result?.kind === 'win' && result.winners.includes(index)}
        clock={session.timed ? session.clock(index) : null}
        // Im Sitzring bestimmt dessen Stufe die Größe (#494, #548); nur in der Leiste gilt `sideShield`.
        size={around ? undefined : sideShield > 0 ? 'card' : 'compact'}
        shieldSize={around ? undefined : sideShield}
      />
    );
  };

  const clockSeat = concealed || result ? undefined : current[0];
  const clockReading = session.timed && clockSeat !== undefined ? session.clock(clockSeat) : null;
  const turnClock = clockReading && clockReading.kind !== 'none' && clockReading.running ? formatClock(clockReading) : null;

  // Schiene (Handy quer, #486): Wer dran ist als Platzzeichen mit ablaufendem Ring; Pause und Partieende als Zeichen.
  const railIndicator = result ? (
    <span className="text-2xl" aria-hidden="true">🏆</span>
  ) : session.paused ? (
    <span className="text-2xl" aria-hidden="true">⏸</span>
  ) : clockSeat === undefined ? null : (
    <span className={`flex items-center justify-center rounded-full ${yourMove ? 'ring-2 ring-accent' : ''} [&_.bub-ring]:h-9 [&_.bub-ring]:w-9`}>
      <ClockRing clock={clockReading}>
        <ui.SeatSymbol seat={clockSeat} seats={seats.length} />
      </ClockRing>
    </span>
  );

  const statusContent = (
    <>
      {yourMove ? (
        <span key={`${session.version}`} className="bub-your-turn">
          <span aria-hidden="true">👉</span>
          {status}
        </span>
      ) : (
        status
      )}
      {result?.reason === 'time' && ` (${t('play.reason.time')})`}
      {result?.reason === 'resign' && ` (${t('play.reason.resign')})`}
      {result?.reason === 'agreement' && ` (${t('play.reason.agreement')})`}
    </>
  );

  const inviteBox = online?.invite && (
    <div className={`flex-none items-center justify-between gap-3 rounded-xl border border-line/70 bg-surface px-3 py-1.5 text-xs text-muted ${around ? 'flex' : collapsedSide ? 'mx-3 mb-1 flex' : 'order-2 mx-3 mb-1 hidden side:flex'}`}>
      <span>
        {t('online.room')}: <strong className="font-semibold text-ink">{online.invite.code}</strong>
      </span>
      <button
        type="button"
        className="cursor-pointer font-medium hover:text-ink"
        onClick={() => {
          navigator.clipboard.writeText(online.invite!.link);
          setCopiedInvite(true);
          setTimeout(() => setCopiedInvite(false), 2000);
        }}
        title={t('online.copyLink')}
      >
        📋 {copiedInvite ? t('online.copied') : t('online.copyLink')}
      </button>
    </div>
  );

  // Oft gebrauchte Knöpfe; am Tisch liegen die übrigen im Menü „⋯“ der Kopfzeile.
  // Notizblock (#105): je Gerät; beim Hot-Seat mit Geheimnissen je Platz und nur hinter der Übergabe.
  const notesSeat = needsHandover ? (revealedFor !== null && revealedFor === turnSeat ? String(revealedFor) : null) : 'ich';
  const noteOwner = needsHandover && notesSeat !== null ? seats[Number(notesSeat)]?.name : undefined;
  const gameKey = notesKey(info.id, session.id);
  const notesButton =
    online?.display || notesSeat === null || handoverSeat !== null ? null : (
      <Button onClick={() => setNotesOpen(true)} title={t('notes.title')}>
        📝{hasNote(gameKey, notesSeat) ? '•' : ''}
        <span className="sr-only"> {t('notes.open')}</span>
      </Button>
    );
  const primaryControls = result ? (
    <>
      {ceremonyClosed && (
        <Button variant="ghost" onClick={() => setCeremonyClosed(false)}>
          {t('ceremony.show')}
        </Button>
      )}
      {notesButton}
      {resultActions}
    </>
  ) : (
    <>
      {notesButton}
      {!online && humans.length > 0 && !info.noUndo && (
        <Button disabled={!session.canUndo()} onClick={() => session.undo()}>
          ↶ {t('play.undo')}
        </Button>
      )}
      {online && online.yourSeat !== null && info.takeBack && !info.noUndo && (
        <Button disabled={!session.canUndo()} title={t('online.takeBackAskTitle')} onClick={() => session.undo()}>
          ↶ {t('online.takeBackAsk')}
        </Button>
      )}
      {info.hints && actingSeat !== undefined && <Button onClick={askHint}>💡 {t('play.hint')}</Button>}
    </>
  );
  const secondaryControls = online ? (
    <>
      <PieceSetQuick gameId={info.id} />
      {online.isHost && online.onRestart && (
        <Button
          onClick={() => {
            if (window.confirm(t('play.restartConfirm'))) {
              online.onRestart?.(false);
            }
          }}
        >
          {t('play.restart')}
        </Button>
      )}
      {online.isHost && (
        <Button
          variant="ghost"
          onClick={() => {
            if (window.confirm(t('online.toLobbyConfirm'))) {
              online.onLobby();
            }
          }}
        >
          {t('online.toLobby')}
        </Button>
      )}
      {ui.handView && online.yourSeat !== null && !online.display && (
        <Button variant="ghost" aria-pressed={handOnly} onClick={() => setHandView(!handOnly)}>
          🃏 {handOnly ? t('play.handViewOff') : t('play.handView')}
        </Button>
      )}
      {canResign && (
        <Button variant="ghost" onClick={resign}>
          {t('play.resign')}
        </Button>
      )}
    </>
  ) : (
    <>
      <PieceSetQuick gameId={info.id} />
      <Button onClick={() => local?.onRestart(false)}>{t('play.restart')}</Button>
      {canResign && (
        <Button variant="ghost" onClick={resign}>
          {t('play.resign')}
        </Button>
      )}
    </>
  );

  // Meldungen, die man ohne ☰ sehen muss (#485): eingeklappt über dem Spielfeld, sonst wie bisher in der Spalte.
  const noticeOrder = around || collapsedSide ? '' : 'order-2';
  const noticeItems = (
    <>
        {hintMissing && <p className={`flex-none pt-2 text-center text-sm text-muted ${noticeOrder}`}>{t('play.noHint')}</p>}

        {online?.bar && !result && <div className={`flex-none ${noticeOrder}`}>{online.bar}</div>}
        {offerHandView && (
          <div className={`flex flex-none flex-wrap items-center gap-2 px-3 py-1 text-sm ${noticeOrder}`} role="status">
            <span className="min-w-0 flex-1">📺 {t('play.handViewOffer')}</span>
            <Button className="min-h-9 px-3" variant="primary" onClick={() => setHandView(true)}>
              {t('play.handViewYes')}
            </Button>
            <Button className="min-h-9 px-3" variant="ghost" onClick={() => setHandViewDeclined(true)}>
              {t('play.handViewNo')}
            </Button>
          </div>
        )}

        {awaySeats.length > 0 && !result && (
          <div className={`mx-3 mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-3 text-sm ${noticeOrder}`}>
            {awaySeats.map((seat) => (
              <span key={seat} className="flex flex-1 flex-wrap items-center gap-2">
                {online ? t('online.away') : t('play.away', { name: seats[seat]?.name ?? '' })}
                <Button variant="primary" onClick={() => session.returnSeat(seat)}>
                  {t('play.takeBack')}
                </Button>
              </span>
            ))}
          </div>
        )}
    </>
  );

  // Großansicht (#418/#422) für Spielfeld, Spielerchips und Sitzring; Spiele mit eigenem Provider dürfen ihn ersetzen.
  return (
    <CardInspectProvider>
    <div
      ref={rootRef}
      className={`flex ${online?.display ? 'h-full' : 'h-dvh'} flex-col pt-[env(safe-area-inset-top)] ${fullBleed || collapsedSide ? 'pb-[env(safe-area-inset-bottom)]' : 'pb-[max(env(safe-area-inset-bottom),0.75rem)]'} side:pl-[env(safe-area-inset-left)] side:pr-[env(safe-area-inset-right)] ${around || collapsedTop ? '' : 'side:flex-row'}`}
    >
      {/* Eingeklappt (Hochformat: Leiste oben, Querformat: Schiene links) liegt alles hinter ☰; die Seitenleiste ist eine Spalte. */}
      <div ref={sideBox} className={collapsedSide ? 'relative flex-none' : 'contents'}>
      {collapsedSide && (
        <div className={collapsedTop ? 'flex h-11 items-center gap-2 px-2' : 'flex h-full w-11 flex-col items-center gap-2 py-2'}>
          <button
            ref={menuButtonRef}
            type="button"
            className="relative flex min-h-10 min-w-10 flex-none cursor-pointer items-center justify-center rounded-lg border border-line bg-surface text-lg hover:bg-surface-2"
            data-bub-menu
            aria-expanded={sideOpen}
            aria-label={sideOpen ? t('play.hideMenu') : t('play.showMenu')}
            title={sideOpen ? t('play.hideMenu') : t('play.showMenu')}
            onClick={() => setSideOpen(!sideOpen)}
          >
            <span aria-hidden="true">☰</span>
            {yourMove && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-pulse rounded-full border border-surface bg-accent" aria-hidden="true" />}
          </button>
          {collapsedTop && (
            <p className="min-w-0 flex-1 truncate text-center text-sm font-medium" aria-live="polite">
              {statusContent}
            </p>
          )}
          {collapsedTop && turnClock && (
            <span className="flex-none rounded-full bg-surface-2 px-2 py-0.5 text-sm font-semibold tabular-nums" title={t('play.clock')}>
              ⏱ {turnClock}
            </span>
          )}
          {!collapsedTop && (
            <>
              <p className="sr-only" aria-live="polite">
                {statusContent}
              </p>
              {railIndicator && (
                <div className="flex flex-none flex-col items-center gap-0.5" title={status} role="img" aria-label={status}>
                  {railIndicator}
                  {turnClock && <span className="text-center text-[0.7rem] font-semibold leading-tight tabular-nums">{turnClock}</span>}
                </div>
              )}
              {online?.chat && <div className="relative mt-auto flex flex-none">{online.chat(false)}</div>}
            </>
          )}
          {collapsedTop && barAction}
          {collapsedTop && online?.chat && <div className="relative flex flex-none">{online.chat(true)}</div>}
        </div>
      )}
      <FocusZone id="play-menu" order={2} label="Spielmenü" trap={collapsedSide && sideOpen} className="contents">
      <div
        ref={drawerRef}
        className={
          collapsedSide
            ? sideOpen
              ? collapsedTop
                ? 'absolute left-0 top-11 z-50 flex max-h-[85dvh] w-[min(20rem,100%)] flex-col overflow-y-auto rounded-br-xl border border-line bg-surface pb-1 shadow-xl'
                : 'absolute left-11 top-0 z-50 flex h-full w-72 flex-col overflow-y-auto rounded-r-xl border border-line bg-surface shadow-xl'
              : 'hidden'
            : around
              ? 'contents'
              : 'contents side:flex side:flex-none side:flex-col side:overflow-y-auto'
        }
        style={layout.mode === 'side' ? { width: layout.sideWidth } : undefined}
      >
        <header className={`flex h-14 flex-none items-center gap-2 px-3 ${around ? 'relative z-30' : collapsedSide ? 'sticky top-0 z-10 bg-surface' : ''}`}>
          {!online?.display && (
            <Button variant="ghost" className="px-3" aria-label={online ? t('online.leave') : t('play.back')} onClick={() => (online ? online.onLeave() : navigate(paths.home))}>
              ←
            </Button>
          )}
          <h1 className="min-w-0 truncate text-lg font-semibold">
            <span aria-hidden="true">{info.emoji} </span>
            {info.name}
          </h1>
          {cardCatalogChecksum && (
            <button
              type="button"
              onClick={() => setShowCustomCards(true)}
              className="inline-flex flex-none items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent hover:bg-accent/20 cursor-pointer transition"
              title={`Eigenes Kartenset (Anki) #${cardCatalogChecksum} – Details anzeigen`}
            >
              <span>✨ Anki #{cardCatalogChecksum}</span>
            </button>
          )}
          {around && inviteBox}
          {around && (
            <footer className="ml-auto flex flex-none items-center gap-1 [&>button]:min-h-9 [&>button]:px-2 [&>button]:text-sm [&>button]:whitespace-nowrap">
              {primaryControls}
              {!result && <MoreMenu>{secondaryControls}</MoreMenu>}
            </footer>
          )}
          {online?.chat && !collapsedSide && <div className={`flex flex-none ${around ? '' : 'ml-auto'}`}>{online.chat(around)}</div>}
          {!online?.display && (
            <Button variant="ghost" className={`px-3 text-lg ${around || (online?.chat && !collapsedSide) ? '' : 'ml-auto'}`} aria-label={t('howto.open')} title={t('howto.open')} onClick={() => { setShowHowTo(true); setSideOpen(false); }}>
              ?
            </Button>
          )}
          <SoundControl gameId={info.id} isClient={isClient} ownMusic={info.ownMusic} inBar={around} />
          {session.timed && !result && !online && (
            <Button
              variant="ghost"
              className="px-3 text-xl"
              aria-label={session.paused ? t('play.resume') : t('play.pause')}
              title={session.paused ? t('play.resume') : t('play.pause')}
              onClick={() => (session.paused ? session.resume() : session.pause())}
            >
              {session.paused ? '▶' : '⏸'}
            </Button>
          )}
        </header>

        {!around && inviteBox}

        {/* Spielerliste: in Seitenleiste und Schublade immer offen untereinander (#485); die Statuszeile steht nur in der Seitenleiste, eingeklappt in der Leiste. */}
        {!around && (
          <>
            <section
              ref={playersRef}
              id="bub-players"
              className={`bub-players flex min-h-20 flex-initial flex-col flex-nowrap gap-2 overflow-x-hidden overflow-y-auto px-3 ${collapsedSide ? 'py-1' : 'py-0'}`}
              data-crowded={crowded || undefined}
              aria-label={t('play.players')}
            >
              {seats.map((_, index) => seatChip(index))}
            </section>
            {!collapsedSide && (
              <div className="flex items-center justify-center gap-2 px-3 py-2">
                <p className="min-w-0 text-center font-medium" aria-live="polite">
                  {statusContent}
                </p>
              </div>
            )}
          </>
        )}

        {!collapsedSide && noticeItems}
        {!around && (
          <footer
            className={
              collapsedSide
                ? 'flex flex-none flex-col gap-2 px-3 py-2 [&>*]:w-full [&>button]:min-h-10'
                : 'order-2 flex flex-none side:mt-auto flex-wrap justify-center gap-2 px-3 pt-3 pb-1 [&>button]:px-3'
            }
            onClick={collapsedSide ? closeDrawerOnAction : undefined}
          >
            {primaryControls}
            {!result && secondaryControls}
          </footer>
        )}
        {!collapsedSide && (around ? online?.extra && <div className="order-2 flex-none">{online.extra}</div> : online?.extra)}
      </div>
      </FocusZone>
      </div>

      <FocusZone id="play-board" order={1} label="Spielfeld" className="order-1 flex min-h-0 min-w-0 flex-1 flex-col">
      {collapsedSide && (
        <div className="flex max-h-[40dvh] flex-none flex-col overflow-y-auto empty:hidden">
          {noticeItems}
          {online?.extra}
        </div>
      )}
      <main
        ref={tableRef}
        data-human-moves={0}
        className={`bub-table relative min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain ${fullBleed ? 'p-0' : collapsedSide ? 'px-1 py-0' : 'px-3 side:py-2 side:px-4'}`}
        data-category={categoryOf(info.id)}
        data-collapsed={collapsedSide || undefined}
      >
        {yourMove && <div key={`${session.version}`} className="bub-turn-frame" aria-hidden="true" />}
        {yourMove && legalMoves.length > 0 && (
          <PlayMoveCarousel
            game={game}
            view={session.view(viewer)}
            legalMoves={legalMoves}
            onMove={(move) => {
              const seat = actingSeat !== undefined ? actingSeat : (typeof viewer === 'number' ? viewer : undefined);
              if (seat === undefined) return;
              const ok = session.submit(seat, move);
              countHumanMove(ok);
              triggerGamepadHaptic(ok ? 'confirm' : 'error', loadHapticsPref());
            }}
          />
        )}
        <ui.Board
          view={session.view(viewer)}
          legalMoves={legalMoves}
          onMove={(move) => {
            const seat = actingSeat !== undefined ? actingSeat : (typeof viewer === 'number' ? viewer : undefined);
            if (seat === undefined) return false;
            const ok = session.submit(seat, move);
            countHumanMove(ok);
            triggerGamepadHaptic(ok ? 'confirm' : 'error', loadHapticsPref());
            return ok;
          }}
          events={eventsRef.current}
          clock={session.timed && current[0] !== undefined ? session.clock(current[0]) : null}
          activeSeat={current[0] ?? null}
          hint={hint}
          viewer={viewer}
          seatNames={seats.map((seat) => seat.name)}
          audio={{ muted: soundSettings.effectsOff && soundSettings.musicOff, music: playMusic ? soundSettings.music : 0, effects: soundSettings.effectsOff ? 0 : soundSettings.effects }}
          invite={online?.invite}
          table={around && !handOnly ? { seatChip, status: statusContent } : undefined}
          handOnly={handOnly}
          display={online?.display}
          canJoinSeat={session.canJoinSeat ? (seat) => session.canJoinSeat!(seat) : undefined}
          onJoinSeat={session.joinSeat ? (seat, kind, name) => session.joinSeat!(seat, kind, name) : undefined}
          canLeaveSeat={session.canLeaveSeat ? (seat) => session.canLeaveSeat!(seat) : undefined}
          onLeaveSeat={session.leaveSeat ? (seat) => session.leaveSeat!(seat) : undefined}
          humanSeats={
            !online && !needsHandover && humans.length > 1
              ? humans.map((seat) => ({ seat, legalMoves: session.isAway(seat) || session.paused ? [] : session.legalMoves(seat), onMove: (move: unknown) => countHumanMove(session.submit(seat, move)) }))
              : undefined
          }
        />
        {notesOpen && notesSeat !== null && handoverSeat === null && <Notes gameKey={gameKey} seat={notesSeat} owner={noteOwner} onClose={() => setNotesOpen(false)} />}
        {replaying && canReplay(replayData) && (
          <Replay
            game={game}
            data={replayData}
            seatNames={seats.map((seat) => seat.name)}
            startViewer={online ? (online.yourSeat ?? 'spectator') : humans.length === 1 ? (humans[0] as number) : 'spectator'}
            display={online?.display}
            onClose={() => setReplaying(false)}
          />
        )}
        {showHowTo && <HowToOverlay info={info} onClose={() => setShowHowTo(false)} />}
        {showCustomCards && cardCatalogChecksum && (
          <CustomCardsOverlay
            checksum={cardCatalogChecksum}
            catalog={customCatalog}
            customCards={(publicView as any)?.customCards}
            customMods={(publicView as any)?.customMods}
            customCardSet={(publicView as any)?.customCardSet}
            onClose={() => setShowCustomCards(false)}
          />
        )}
        {result && !ceremonyClosed && (
          <Ceremony
            result={result}
            title={status}
            reason={reasonText}
            seats={seats.map((seat, index) => {
              const id = seatIdentityFor(index);
              return {
                seat: index,
                name: seat.name,
                avatar: id.avatar,
                crest: id.crest,
                symbol: <ui.SeatSymbol seat={index} seats={seats.length} />,
                score: ui.seatScore?.(publicView, index) ?? null,
                you: online ? index === online.yourSeat : seat.kind === 'human',
              };
            })}
            actions={resultActions}
            trophyNote={trophyLaid}
            rewardNote={rewardNote}
            onClose={() => setCeremonyClosed(true)}
          />
        )}
        {handoverSeat !== null ? (
          <div className="absolute inset-0 z-40 grid place-items-center bg-bg px-6 text-center">
            <div className="space-y-3">
              <p className="text-4xl" aria-hidden="true">
                🤫
              </p>
              <p className="text-xl font-semibold">{t('play.handover', { name: (seats[handoverSeat]?.avatar ? `${seats[handoverSeat]?.avatar} ${seats[handoverSeat]?.name}` : (seats[handoverSeat]?.name ?? '')) })}</p>
              <p className="text-muted">{t('play.handoverHint')}</p>
              <Button
                variant="primary"
                data-bub-autofocus="handover"
                onClick={() => {
                  setRevealedFor(handoverSeat);
                  session.resume();
                }}
              >
                {t('play.handoverReveal', { name: (seats[handoverSeat]?.avatar ? `${seats[handoverSeat]?.avatar} ${seats[handoverSeat]?.name}` : (seats[handoverSeat]?.name ?? '')) })}
              </Button>
            </div>
          </div>
        ) : session.paused && !result && (
          <button type="button" className="absolute inset-0 z-40 grid place-items-center bg-bg/80 text-xl font-semibold backdrop-blur-sm" onClick={() => session.resume()}>
            ▶ {t('play.resume')}
          </button>
        )}
      </main>
      </FocusZone>
    </div>
    </CardInspectProvider>
  );
}

function loadHapticsPref(): boolean {
  try {
    const raw = localStorage.getItem('brett-und-blatt:eingabe');
    if (!raw) return true;
    const parsed = JSON.parse(raw) as { haptics?: boolean };
    return parsed.haptics !== false;
  } catch {
    return true;
  }
}

function PlayMoveCarousel({
  game,
  view,
  legalMoves,
  onMove,
}: {
  game: LoadedGame;
  view: unknown;
  legalMoves: readonly unknown[];
  onMove: (move: unknown) => void;
}) {
  const settings = useInputSettings();
  const items = useMemo<MoveCarouselItem[]>(() => {
    if (settings.mode !== 'legalMoves') return [];
    const describe = game.module.describeMove as ((v: unknown, m: unknown) => string) | undefined;
    return legalMoves.slice(0, 120).map((move, idx) => ({
      id: String(idx),
      label: describe ? describe(view, move) : `Zug ${idx + 1}`,
    }));
  }, [settings.mode, game.module, view, legalMoves]);

  if (settings.mode !== 'legalMoves' || items.length === 0) return null;

  return (
    <div className="mb-2 flex justify-center">
      <MoveCarouselBar
        items={items}
        onExecuteMove={(id) => {
          const idx = Number(id);
          if (Number.isFinite(idx) && legalMoves[idx] !== undefined) {
            onMove(legalMoves[idx]);
          }
        }}
      />
    </div>
  );
}

