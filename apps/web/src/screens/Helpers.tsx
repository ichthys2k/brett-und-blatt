import { TavernPage } from '../components/TavernPage';
import { DiceHelper } from '../components/helpers/DiceHelper';
import { RandomHelper } from '../components/helpers/RandomHelper';
import { ScorepadHelper } from '../components/helpers/ScorepadHelper';
import { StarterHelper } from '../components/helpers/StarterHelper';
import { TimerHelper } from '../components/helpers/TimerHelper';
import type { HelperTool } from '../lib/helpers';
import { navigate, paths } from '../lib/router';

interface ToolSpec {
  id: HelperTool;
  emoji: string;
  title: string;
  description: string;
  badge: string;
}

const TOOLS: readonly ToolSpec[] = [
  {
    id: 'wuerfel',
    emoji: '🎲',
    title: 'Würfel',
    description: '1 bis 10 Würfel (W4, W6, W8, W10, W12, W20 und eigene Seiten), Würfel halten, Summe und Verlauf.',
    badge: 'W4–W20 · Eigene Seiten',
  },
  {
    id: 'zufall',
    emoji: '🪙',
    title: 'Münze & Zufall',
    description: 'Münze werfen, Zufallszahl von–bis ziehen und aus einer eigenen Liste mit oder ohne Zurücklegen losen.',
    badge: 'Münze · Zahl · Liste',
  },
  {
    id: 'startspieler',
    emoji: '👆',
    title: 'Startspieler & Teams',
    description: 'Namen eingeben oder gemeinsam Finger auf den Bildschirm legen – lost Startspieler und Teams aus.',
    badge: 'Namen · Finger · Teams',
  },
  {
    id: 'uhren',
    emoji: '⏳',
    title: 'Sanduhr & Zugzeit',
    description: 'Sanduhr mit Signalton am Ende sowie Schachuhr für 2 bis 6 Spieler mit optionalem Zeitbonus.',
    badge: 'Sanduhr · Schachuhr',
  },
  {
    id: 'punkte',
    emoji: '📝',
    title: 'Punktezettel',
    description: 'Beliebige Spieler und Runden erfassen, Summen automatisch rechnen und die Rangliste anzeigen.',
    badge: 'Runden · Summen · Rangliste',
  },
];

export function HelpersScreen({ tool }: { tool?: HelperTool }) {
  const active = tool ? TOOLS.find((t) => t.id === tool) : undefined;

  return (
    <TavernPage
      title={active ? `${active.emoji} ${active.title}` : '🎲 Spielhelfer'}
      subtitle={active ? active.description : 'Einfache Tischwerkzeuge für echte Brettspiele und den Unterricht – offline nutzbar.'}
      back={active ? paths.helpers : paths.home}
    >
      {active ? (
        <div className="space-y-5">
          <nav aria-label="Werkzeuge" className="flex flex-wrap gap-1.5">
            {TOOLS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-current={item.id === active.id ? 'page' : undefined}
                onClick={() => navigate(paths.helper(item.id))}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-semibold transition ${
                  item.id === active.id
                    ? 'border-accent bg-accent text-accent-ink shadow-sm'
                    : 'border-line bg-surface-2 text-ink hover:bg-surface'
                }`}
              >
                <span aria-hidden="true">{item.emoji}</span>
                <span>{item.title}</span>
              </button>
            ))}
          </nav>

          {active.id === 'wuerfel' && <DiceHelper />}
          {active.id === 'zufall' && <RandomHelper />}
          {active.id === 'startspieler' && <StarterHelper />}
          {active.id === 'uhren' && <TimerHelper />}
          {active.id === 'punkte' && <ScorepadHelper />}
        </div>
      ) : (
        <div className="space-y-4">
          <ul className="grid gap-3 sm:grid-cols-2">
            {TOOLS.map((item) => (
              <li key={item.id}>
                <a
                  href={paths.helper(item.id)}
                  className="bub-tile flex h-full items-start gap-4 rounded-2xl border border-line bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-3 focus-visible:outline-accent"
                >
                  <span className="bub-tile-crest text-4xl leading-none" aria-hidden="true">
                    {item.emoji}
                  </span>
                  <span className="min-w-0 space-y-1">
                    <span className="block font-semibold">{item.title}</span>
                    <span className="block text-sm text-muted">{item.description}</span>
                    <span className="inline-block rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted">
                      {item.badge}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </TavernPage>
  );
}
