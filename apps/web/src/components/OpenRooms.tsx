import { useEffect, useState } from 'react';
import { t } from '../i18n';
import type { OpenRoomListing } from '../lib/online';
import { navigate, paths } from '../lib/router';
import { Button } from './controls';

function formatTimeAgo(timeMs: number, now: number): string {
  const diffSec = Math.max(0, Math.floor((now - timeMs) / 1000));
  if (diffSec < 60) return t('home.openGames.justNow');
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return t('home.openGames.minAgo', { n: diffMin });
  return t('home.openGames.hoursAgo', { n: Math.floor(diffMin / 60) });
}

function OpenGameCard({ room, now }: { room: OpenRoomListing; now: number }) {
  const freeSeats = room.totalSeats - room.filledSeats;
  const seatsText =
    freeSeats === 1
      ? t('home.openGames.oneSeat', { total: room.totalSeats })
      : t('home.openGames.seats', { free: freeSeats, total: room.totalSeats });

  return (
    <li className="bub-plop flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm transition hover:shadow-md">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="text-3xl" aria-hidden="true">
          {room.gameEmoji}
        </span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="truncate font-semibold">{room.gameName}</p>
          <p className="truncate text-xs text-muted">
            <span aria-hidden="true">{room.hostAvatar} </span>
            {room.hostName}
          </p>
          <p className="text-[11px] text-muted">
            {seatsText} · <span className="whitespace-nowrap">{formatTimeAgo(room.updatedAt, now)}</span>
          </p>
        </div>
      </div>
      <Button variant="primary" onClick={() => navigate(paths.room(room.code))}>
        {t('home.openGames.join')}
      </Button>
    </li>
  );
}

/**
 * Offene Runden zum Mitspielen, live vom Spieleserver (`useOpenRooms`).
 * `rooms === null`: Die Liste ist noch unterwegs. `showEmpty` zeigt bei leerer
 * Liste einen Hinweis, sonst verschwindet der Abschnitt ganz.
 */
export function OpenRooms({ rooms, showEmpty = false }: { rooms: OpenRoomListing[] | null; showEmpty?: boolean }) {
  // „vor 3 Min.“ soll mitlaufen, auch wenn keine neue Liste kommt.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const empty = !rooms || rooms.length === 0;
  if (empty && !showEmpty) return null;

  return (
    <section className="space-y-3" aria-live="polite">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75"></span>
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent"></span>
        </span>
        {t('home.openGames')}
      </h2>
      {empty ? (
        <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">
          {rooms === null ? t('online.connecting') : t('home.openGames.none')}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rooms.map((room) => (
            <OpenGameCard key={room.code} room={room} now={now} />
          ))}
        </ul>
      )}
    </section>
  );
}
