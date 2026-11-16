import { setPairImageResolver } from '../../../../packages/games/pairs/src/ui/imageResolver';
import { avatarUrl } from './avatarArt';

function indexByBasename(glob: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, url] of Object.entries(glob)) {
    const file = path.split('/').pop() ?? '';
    const base = file.replace(/\.[^.]+$/, '');
    out[base] = url;
  }
  return out;
}

const DRACHENSPIEL_KARTEN = indexByBasename(
  import.meta.glob<string>('../../../../packages/games/drachenspiel/src/ui/karten/bub-ds-*.webp', { eager: true, query: '?url', import: 'default' }),
);
const DRACHENSPIEL_CHAMPIONS = indexByBasename(
  import.meta.glob<string>('../../../../packages/games/drachenspiel/src/ui/champions/*.webp', { eager: true, query: '?url', import: 'default' }),
);
const BOTS = indexByBasename(
  import.meta.glob<string>('../../../../packages/ui/src/bots/portraits/bot-*.webp', { eager: true, query: '?url', import: 'default' }),
);
const JAHRMARKT = indexByBasename(
  import.meta.glob<string>('../../../../packages/games/color-sorter/src/ui/items/*.webp', { eager: true, query: '?url', import: 'default' }),
);
const NARRENHOF = indexByBasename(
  import.meta.glob<string>('../../../../packages/games/color-sorter/src/ui/portraits/*-1.webp', { eager: true, query: '?url', import: 'default' }),
);
const WAPPEN = indexByBasename(
  import.meta.glob<string>('../wappen/*.webp', { eager: true, query: '?url', import: 'default' }),
);
const HOFKARTEN = indexByBasename(
  import.meta.glob<string>('../../../../packages/ui/src/cards/portraits/*.webp', { eager: true, query: '?url', import: 'default' }),
);
const GRAFSCHAFT_Q = indexByBasename(
  import.meta.glob<string>('../../../../packages/games/grafschaft/src/ui/auftraege/*.webp', { eager: true, query: '?url', import: 'default' }),
);
const GRAFSCHAFT_L = indexByBasename(
  import.meta.glob<string>('../../../../packages/games/grafschaft/src/ui/land/*.webp', { eager: true, query: '?url', import: 'default' }),
);
const MARKTPLATZ_FIG = indexByBasename(
  import.meta.glob<string>('../../../../packages/games/marketplace/src/ui/figures/*.webp', { eager: true, query: '?url', import: 'default' }),
);
const MARKTPLATZ_FLD = indexByBasename(
  import.meta.glob<string>('../../../../packages/games/marketplace/src/ui/fields/*.webp', { eager: true, query: '?url', import: 'default' }),
);

export function pairImageUrl(key: string): string | undefined {
  const colon = key.indexOf(':');
  if (colon < 0) return undefined;
  const kind = key.slice(0, colon);
  const id = key.slice(colon + 1);
  switch (kind) {
    case 'avatar':
      return avatarUrl(id);
    case 'quartett':
      return `${import.meta.env.BASE_URL}quartett/bilder/${id}`;
    case 'drachenspiel':
      return DRACHENSPIEL_KARTEN[`bub-ds-${id}`];
    case 'drachenspiel-champ':
      return DRACHENSPIEL_CHAMPIONS[id];
    case 'bot':
      return BOTS[`bot-${id}`];
    case 'jahrmarkt':
      return JAHRMARKT[id];
    case 'narrenhof':
      return NARRENHOF[id];
    case 'wappen':
      return WAPPEN[id];
    case 'hofkarte':
      return HOFKARTEN[id];
    case 'grafschaft-q':
      return GRAFSCHAFT_Q[id];
    case 'grafschaft-l':
      return GRAFSCHAFT_L[id];
    case 'marktplatz-fig':
      return MARKTPLATZ_FIG[id];
    case 'marktplatz-fld':
      return MARKTPLATZ_FLD[id];
    default:
      return undefined;
  }
}

setPairImageResolver(pairImageUrl);
