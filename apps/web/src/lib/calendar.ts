/**
 * Kalenderdatei (.ics) für Turniere (#243): reine Logik ohne Browser, damit sie sich testen lässt.
 * Zeiten stehen in UTC (`…Z`), so braucht die Datei keine Zeitzonen-Definition und jede Kalender-App rechnet selbst um.
 * Die Datei ist ein Schnappschuss beim Klick; verschobene Partien brauchen einen neuen Download.
 */

export interface CalendarEvent {
  /** Stabil je Partie: ein erneuter Download ersetzt die Einträge, statt sie zu verdoppeln. */
  uid: string;
  start: number;
  end: number;
  summary: string;
  description?: string;
  location?: string;
  url?: string;
}

/** Die Teile einer Turnieransicht, die die Rechnung braucht (damit Tests keine ganze Sicht bauen müssen). */
export interface CalendarSource {
  code: string;
  settings: { name: string };
  /** Eigene Kennung des Geräts im Turnier; `null` als Zuschauer. */
  you: string | null;
  schedule: { matchMinutes: number } | null;
  stages: { deadline: number }[];
  matches: {
    id: string;
    stage: number;
    status: string;
    slots: [{ player: string | null }, { player: string | null }];
    plannedAt?: number;
    field?: number;
  }[];
}

export interface CalendarLabels {
  /** Name eines Teilnehmers (ohne Bild, Kalender zeigen Emoji unterschiedlich). */
  player: (id: string | null) => string;
  /** Beschriftung der Phase, z. B. „Gruppe A“ oder „Halbfinale“. */
  title: (matchId: string) => string;
  field: (field: number) => string;
  /** „Frist“ für Partien ohne feste Uhrzeit. */
  deadline: string;
}

const DEADLINE_MINUTES = 30;
const DEFAULT_MINUTES = 30;

/** Partien mit Uhrzeit: laut Zeitplan, sonst die Frist der Phase (online). Beendete Partien fallen weg. */
export function calendarEvents(view: CalendarSource, labels: CalendarLabels, opts: { mine: boolean; url?: string }): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const m of view.matches) {
    if (m.status === 'done') continue;
    if (opts.mine && (!view.you || !m.slots.some((s) => s.player === view.you))) continue;
    const planned = m.plannedAt;
    const deadline = view.stages[m.stage]?.deadline;
    const start = planned ?? (deadline && deadline > 0 ? deadline : undefined);
    if (start === undefined) continue;
    const minutes = planned !== undefined ? (view.schedule?.matchMinutes ?? DEFAULT_MINUTES) : DEADLINE_MINUTES;
    const [a, b] = m.slots.map((s) => labels.player(s.player)) as [string, string];
    const lines = [labels.title(m.id)];
    if (m.field !== undefined) lines.push(labels.field(m.field));
    if (opts.url) lines.push(opts.url);
    events.push({
      uid: `${view.code}-${m.id}@spiele.lipponer.de`,
      start,
      end: start + minutes * 60_000,
      summary: `${view.settings.name}: ${a} – ${b}${planned === undefined ? ` (${labels.deadline})` : ''}`,
      description: lines.join('\n'),
      ...(m.field !== undefined ? { location: labels.field(m.field) } : {}),
      ...(opts.url ? { url: opts.url } : {}),
    });
  }
  return events.sort((x, y) => x.start - y.start || x.uid.localeCompare(y.uid));
}

/** `20261110T143000Z` */
export function icsTime(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/** Text nach RFC 5545: Backslash, Semikolon, Komma und Zeilenumbrüche maskieren. */
export function icsEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Zeilen länger als 75 Oktette werden gefaltet (Fortsetzung beginnt mit einem Leerzeichen); Mehrbyte-Zeichen bleiben ganz. */
export function icsFold(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let size = 0;
  let limit = 75;
  for (const ch of line) {
    const bytes = encoder.encode(ch).length;
    if (size + bytes > limit) {
      parts.push(current);
      current = '';
      size = 0;
      limit = 74; // das führende Leerzeichen zählt mit
    }
    current += ch;
    size += bytes;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

export function buildIcs(events: readonly CalendarEvent[], opts: { name: string; now: number }): string {
  const stamp = icsTime(opts.now);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Brett & Blatt//Turnier//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${icsEscape(opts.name)}`];
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${stamp}`, `DTSTART:${icsTime(e.start)}`, `DTEND:${icsTime(e.end)}`, `SUMMARY:${icsEscape(e.summary)}`);
    if (e.description) lines.push(`DESCRIPTION:${icsEscape(e.description)}`);
    if (e.location) lines.push(`LOCATION:${icsEscape(e.location)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(icsFold).join('\r\n') + '\r\n';
}
