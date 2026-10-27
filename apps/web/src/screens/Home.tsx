import type { GameInfo, SessionSnapshot } from '@brett-und-blatt/engine';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/controls';
import { t } from '../i18n';
import { discardGame } from '../lib/activeGame';
import { GAME_SERVER, fetchOpenRooms, type OpenRoomListing } from '../lib/online';
import { findGame, games } from '../lib/registry';
import { navigate, paths } from '../lib/router';
import { storage } from '../lib/storage';

type CategoryId = 'board' | 'cards' | 'family' | 'math';
type FilterId = 'all' | CategoryId;

interface CategorySpec {
  id: CategoryId;
  icon: string;
  title: string;
  subtitle: string;
  gameIds: readonly string[];
}

const CATEGORIES: readonly CategorySpec[] = [
  {
    id: 'board',
    icon: '♟️',
    title: 'Strategie- & Brettspiele',
    subtitle: 'Klassische Denk- und Positionsspiele auf dem Spielbrett.',
    gameIds: [
      'chess',
      'four-player-chess',
      'checkers',
      'go',
      'mill',
      'reversi',
      'four-in-a-row',
      'ultimate-tic-tac-toe',
      'tic-tac-toe',
    ],
  },
  {
    id: 'cards',
    icon: '🃏',
    title: 'Karten- & Stichspiele',
    subtitle: 'Traditionelle Stichspiele, Ablegespiele, Deckbau und Patiencen.',
    gameIds: [
      'skat',
      'schafkopf',
      'doppelkopf',
      'poker',
      'uno',
      'drachenspiel',
      'color-sorter',
      'solitaire',
      'quartett',
      'black-peter',
    ],
  },
  {
    id: 'family',
    icon: '🎲',
    title: 'Familien-, Lege- & Gesellschaftsspiele',
    subtitle: 'Gemeinsam würfeln, kombinieren, merken und raten – auch in großer Runde.',
    gameIds: ['ludo', 'dominoes', 'color-and-shape', 'battleship', 'maexle', 'pairs', 'bingo'],
  },
  {
    id: 'math',
    icon: '📐',
    title: 'Mathe- & Rechenspiele (Kl. 5/6)',
    subtitle: 'Kopfrechnen, Klammerterme, Teiler, Vielfache und Zahlenmauern spielerisch trainieren.',
    gameIds: ['target-number', 'factor-grid', 'number-wall'],
  },
];

interface MathPresetCard {
  id: string;
  gameId: string;
  emoji: string;
  title: string;
  description: string;
  badge: string;
  params: Record<string, string>;
}

const MATH_CLASSIC_PRESETS: readonly MathPresetCard[] = [
  {
    id: 'math-bingo',
    gameId: 'bingo',
    emoji: '🎱',
    title: 'Mathe-Bingo',
    description: 'Kleines & großes 1×1, Kopfrechnen, Größen, Teiler, Brüche oder Ganze Zahlen für bis zu 30 Plätze.',
    badge: '1–30 Spieler · 7 Themenpakete',
    params: { content: 'einmaleins' },
  },
  {
    id: 'math-pairs',
    gameId: 'pairs',
    emoji: '🃏',
    title: 'Mathe-Paare finden',
    description: 'Wertgleiche Brüche & Prozente, Einheiten, Potenzen oder Einmaleins-Paare im Gedächtnisspiel aufdecken.',
    badge: '1–6 Spieler · 7 Themenpakete',
    params: { content: 'brueche' },
  },
  {
    id: 'math-battleship',
    gameId: 'battleship',
    emoji: '🚢',
    title: 'Koordinaten-Schiffe-versenken',
    description: 'Schiffe im 1. Quadranten P(1|1)..P(10|10) oder im Achsenkreuz aller 4 Quadranten (−5 bis +5) orten.',
    badge: '2 Spieler · Koordinatensystem',
    params: { coords: 'quadrants4' },
  },
  {
    id: 'math-dominoes',
    gameId: 'dominoes',
    emoji: '🁣',
    title: 'Mathe-Domino',
    description: 'Dominosteine mit Rechentermen (Kl. 5) oder Brüchen & Dezimalzahlen (Kl. 6) passend anlegen.',
    badge: '2–4 Spieler · Terme & Brüche',
    params: { display: 'terms' },
  },
  {
    id: 'math-uno',
    gameId: 'uno',
    emoji: '🃏',
    title: 'Mathe-Eins!',
    description: 'Zahlenkarten (0–9) zeigen Kopfrechenaufgaben, Potenzen und Brüche statt der Ziffer.',
    badge: '2–10 Spieler · Kopfrechnen',
    params: { mathLabels: 'on' },
  },
  {
    id: 'math-quartett',
    gameId: 'quartett',
    emoji: '📐',
    title: 'Geometrie-Quartett',
    description: '32 ebene Figuren und räumliche Körper nach Ecken, Kanten, Flächen, Symmetrien und Größe vergleichen.',
    badge: '2–6 Spieler · 32 Geometrie-Karten',
    params: { set: 'geometrie' },
  },
  {
    id: 'math-black-peter',
    gameId: 'black-peter',
    emoji: '🎩',
    title: 'Mathe-Schwarzer-Peter',
    description: 'Aufgabe und passende Lösung als Kartenpaare ablegen – wer behält am Ende den Schwarzen Peter?',
    badge: '2–6 Spieler · 7 Themenpakete',
    params: { content: 'kopfrechnen' },
  },
];

const FILTER_TABS: readonly { id: FilterId; icon: string; label: string }[] = [
  { id: 'all', icon: '🎲', label: 'Alle' },
  { id: 'board', icon: '♟️', label: 'Strategie & Brett' },
  { id: 'cards', icon: '🃏', label: 'Karten & Stich' },
  { id: 'family', icon: '🎲', label: 'Familie & Gesellschaft' },
  { id: 'math', icon: '📐', label: 'Mathe (Kl. 5/6)' },
];

function playerCount(info: GameInfo): string {
  const { min, max } = info.players;
  return min === max ? t('home.playersFixed', { count: min }) : t('home.players', { min, max });
}

function formatTimeAgo(timeMs: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timeMs) / 1000));
  if (diffSec < 60) return t('home.openGames.justNow');
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return t('home.openGames.minAgo', { n: diffMin });
  const diffHours = Math.floor(diffMin / 60);
  return t('home.openGames.hoursAgo', { n: diffHours });
}

function OpenGameCard({ room }: { room: OpenRoomListing }) {
  const freeSeats = room.totalSeats - room.filledSeats;
  const seatsText =
    freeSeats === 1
      ? t('home.openGames.oneSeat', { total: room.totalSeats })
      : t('home.openGames.seats', { free: freeSeats, total: room.totalSeats });

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm transition hover:shadow-md">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="text-3xl" aria-hidden="true">
          {room.gameEmoji}
        </span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="truncate font-semibold">{room.gameName}</p>
          <p className="truncate text-xs text-muted">
            <span aria-hidden="true">{room.hostAvatar} </span>
            {room.hostName} · {seatsText}
          </p>
          <p className="text-[11px] text-muted">{formatTimeAgo(room.updatedAt)}</p>
        </div>
      </div>
      <Button variant="primary" onClick={() => navigate(paths.room(room.code))}>
        {t('home.openGames.join')}
      </Button>
    </div>
  );
}

function ResumeCard({ snapshot, onDiscard }: { snapshot: SessionSnapshot; onDiscard: () => void }) {
  const info = findGame(snapshot.config.gameId);
  if (!info) return null;
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <span className="text-3xl" aria-hidden="true">
        {info.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted">{t('home.resume')}</p>
        <p className="truncate font-semibold">
          {info.name}: {snapshot.config.seats.map((seat) => seat.name).join(' gegen ')}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onDiscard}>
          {t('home.resume.discard')}
        </Button>
        <Button variant="primary" onClick={() => navigate(paths.play)}>
          {t('home.resume.play')}
        </Button>
      </div>
    </section>
  );
}

function GameCard({ info }: { info: GameInfo }) {
  return (
    <li>
      <a
        href={paths.setup(info.id)}
        className="flex h-full items-start gap-4 rounded-2xl border border-line bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-3 focus-visible:outline-accent"
      >
        <span className="text-4xl leading-none" aria-hidden="true">
          {info.emoji}
        </span>
        <span className="min-w-0 space-y-1">
          <span className="block font-semibold">{info.name}</span>
          <span className="block text-sm text-muted">{info.description}</span>
          <span className="block text-xs text-muted">{playerCount(info)}</span>
        </span>
      </a>
    </li>
  );
}

export function Home({ initialFilter }: { initialFilter?: string }) {
  const [snapshot, setSnapshot] = useState(() => storage.loadActive());
  const [openRooms, setOpenRooms] = useState<OpenRoomListing[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterId>(() => {
    if (
      initialFilter === 'board' ||
      initialFilter === 'cards' ||
      initialFilter === 'family' ||
      initialFilter === 'math'
    ) {
      return initialFilter;
    }
    if (initialFilter === 'mathe') return 'math';
    return 'all';
  });

  useEffect(() => {
    if (
      initialFilter === 'board' ||
      initialFilter === 'cards' ||
      initialFilter === 'family' ||
      initialFilter === 'math'
    ) {
      setActiveFilter(initialFilter);
    } else if (initialFilter === 'mathe') {
      setActiveFilter('math');
    }
  }, [initialFilter]);

  const categorizedGames = useMemo(() => {
    const byId = new Map(games.map((g) => [g.id, g]));
    const assigned = new Set<string>();
    const groups = CATEGORIES.map((cat) => {
      const list: GameInfo[] = [];
      for (const id of cat.gameIds) {
        const g = byId.get(id);
        if (g) {
          list.push(g);
          assigned.add(id);
        }
      }
      return { ...cat, games: list };
    });
    // Falls weitere Spiele hinzukommen, die noch keiner Liste zugeordnet sind: in Familie einsortieren
    const unassigned = games.filter((g) => !assigned.has(g.id));
    if (unassigned.length > 0) {
      const fam = groups.find((g) => g.id === 'family');
      if (fam) fam.games.push(...unassigned);
    }
    return groups;
  }, []);

  const visibleGroups = useMemo(
    () =>
      activeFilter === 'all'
        ? categorizedGames
        : categorizedGames.filter((g) => g.id === activeFilter),
    [activeFilter, categorizedGames],
  );

  const loadRooms = () => {
    if (!GAME_SERVER) return;
    setLoadingRooms(true);
    fetchOpenRooms()
      .then(setOpenRooms)
      .finally(() => setLoadingRooms(false));
  };

  useEffect(() => {
    loadRooms();
  }, []);

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-6 px-4 pt-[max(env(safe-area-inset-top),1.5rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">
          <span aria-hidden="true">🎲 </span>
          {t('app.title')}
        </h1>
        <p className="text-muted">{t('app.tagline')}</p>
      </header>

      {snapshot && (
        <ResumeCard
          snapshot={snapshot}
          onDiscard={() => {
            discardGame();
            setSnapshot(null);
          }}
        />
      )}

      {GAME_SERVER && (
        <a
          href={paths.online}
          className="flex items-center gap-4 rounded-2xl border border-accent/40 bg-accent/10 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-3 focus-visible:outline-accent"
        >
          <span className="text-4xl leading-none" aria-hidden="true">
            🌐
          </span>
          <span className="min-w-0 space-y-1">
            <span className="block font-semibold">{t('home.online')}</span>
            <span className="block text-sm text-muted">{t('home.online.text')}</span>
          </span>
        </a>
      )}

      {GAME_SERVER && openRooms.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent"></span>
              </span>
              {t('home.openGames')}
            </h2>
            <button
              type="button"
              disabled={loadingRooms}
              onClick={loadRooms}
              className="text-xs text-muted hover:text-foreground disabled:opacity-50"
              title={t('home.openGames.refresh')}
            >
              ↻ {t('home.openGames.refresh')}
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {openRooms.map((room) => (
              <OpenGameCard key={room.code} room={room} />
            ))}
          </div>
        </section>
      )}

      {/* Rubrik-Filterleiste */}
      <nav aria-label="Spielkategorien" className="flex flex-wrap gap-2">
        {FILTER_TABS.map((tab) => {
          const isSelected = activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setActiveFilter(tab.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition cursor-pointer ${
                isSelected
                  ? 'border-accent bg-accent text-white shadow-xs'
                  : 'border-line bg-surface text-ink hover:border-accent/50'
              }`}
            >
              <span aria-hidden="true">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Strukturierte Spieleliste nach Rubriken */}
      <div className="space-y-8">
        {visibleGroups.map((group) => (
          <section key={group.id} className="space-y-3">
            <div className="space-y-0.5">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <span aria-hidden="true">{group.icon}</span>
                <span>{group.title}</span>
                <span className="text-xs font-normal text-muted">({group.games.length})</span>
              </h2>
              <p className="text-xs text-muted">{group.subtitle}</p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {group.games.map((info) => (
                <GameCard key={info.id} info={info} />
              ))}
            </ul>

            {/* In der Mathe-Rubrik zusätzlich die vorgefertigten Mathe-Modi der Klassiker anzeigen */}
            {group.id === 'math' && (
              <div className="pt-3 space-y-2.5">
                <h3 className="text-sm font-semibold text-muted">
                  📐 Mathe-Modi in beliebten Klassikern (mit Voreinstellung starten):
                </h3>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {MATH_CLASSIC_PRESETS.map((preset) => (
                    <li key={preset.id}>
                      <a
                        href={paths.setup(preset.gameId, preset.params)}
                        className="flex h-full items-start gap-4 rounded-2xl border border-accent/35 bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-3 focus-visible:outline-accent"
                      >
                        <span className="text-4xl leading-none" aria-hidden="true">
                          {preset.emoji}
                        </span>
                        <span className="min-w-0 space-y-1">
                          <span className="block font-semibold">{preset.title}</span>
                          <span className="block text-sm text-muted">{preset.description}</span>
                          <span className="inline-block rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
                            {preset.badge}
                          </span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        ))}
      </div>

      <footer className="mt-auto space-y-2 text-xs text-muted">
        <p>
          {t('home.footer')}{' '}
          <a className="underline" href="https://github.com/ichthys2k/brett-und-blatt" target="_blank" rel="noreferrer">
            {t('home.source')}
          </a>
        </p>
        <nav className="flex flex-wrap gap-4" aria-label="Einstellungen und Rechtliches">
          <a className="underline" href={paths.sound}>
            {t('sound.settings')}
          </a>
          <a className="underline" href={paths.imprint}>
            {t('legal.imprint')}
          </a>
          <a className="underline" href={paths.privacy}>
            {t('legal.privacy')}
          </a>
        </nav>
      </footer>
    </div>
  );
}
