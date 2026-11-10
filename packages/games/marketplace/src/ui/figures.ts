/**
 * Nebenfiguren für das Handelsspiel Marktplatz (#73, docs/spiele/marktplatz.md).
 * KI-erzeugte Porträts im Narrenhof-Ölstil (THIRD_PARTY.md, scripts/grafik/manifeste/marktplatz-figuren.json).
 */

const files = import.meta.glob<string>('./figures/*.webp', { eager: true, query: '?url', import: 'default' });

export type FigureId = 'herald' | 'innkeeper' | 'abbot' | 'king' | 'jester';

export interface FigureInfo {
  id: FigureId;
  name: string;
  title: string;
  image: string;
  quote: string;
}

export const JESTER_JOKES: readonly string[] = [
  'Warum hat der Müller Mehl im Bart? Weil die Mühle schneller mahlt als er staunen kann!',
  'Was ist der Unterschied zwischen einem Karren und einer Gans? Die Gans schnattert auch ohne Räder!',
  'Der König fragt: „Warum lachst du?“ – Der Narr: „Weil Lachen zollfrei ist, Eure Majestät!“',
  'Warum trägt der Biber eine Kelle als Schwanz? Weil er beim Mörteln keinen Löffel findet!',
  'Sitzen zwei Eulen im Turm. Sagt die eine: „Uhu!“ Sagt die andere: „Ganz meiner Meinung.“',
  'Lieber eine Brezel in der Hand als eine Krone, die drückt!',
];

export const FIGURES: Record<FigureId, FigureInfo> = {
  herald: {
    id: 'herald',
    name: 'Der Ausrufer',
    title: 'Hofherold von Brezelbach',
    image: files['./figures/herald.webp'] ?? '',
    quote: 'Hört, Ihr Leut’, und lasst Euch sagen!',
  },
  innkeeper: {
    id: 'innkeeper',
    name: 'Die Tavernenwirtin',
    title: 'Wirtin von „Zum Brett & Blatt“',
    image: files['./figures/innkeeper.webp'] ?? '',
    quote: 'Ein Becher warmer Apfelpunsch wärmt Herz und Gemüt!',
  },
  abbot: {
    id: 'abbot',
    name: 'Abt Esel',
    title: 'Vorsteher des Klosters Brezelbach',
    image: files['./figures/abbot.webp'] ?? '',
    quote: 'Geduld und frische Kräuter heilen manchen Kummer.',
  },
  king: {
    id: 'king',
    name: 'König Löwe',
    title: 'Herrscher der Fabeltiere',
    image: files['./figures/king.webp'] ?? '',
    quote: 'Ein gerechter Handel gereicht der ganzen Stadt zur Ehre.',
  },
  jester: {
    id: 'jester',
    name: 'Der Hofnarr',
    title: 'Schelm vom Narrenhof',
    image: files['./figures/jester.webp'] ?? '',
    quote: JESTER_JOKES[0]!,
  },
};

/** Liefert die Figur zu einem Spielfeld oder null, wenn es kein Personenfeld ist. */
export function figureForField(field: number): FigureInfo | null {
  switch (field) {
    case 2:
    case 16:
    case 24:
    case 32:
      return FIGURES.herald;
    case 4: // Zehnt
    case 11: // Kloster / Kräutergarten
      return FIGURES.abbot;
    case 9: // Kerker
      return FIGURES.jester;
    case 20: // Thronsaal / Audienz
    case 33: // Königszoll
      return FIGURES.king;
    case 31: // Taverne „Zum Brett & Blatt“
      return FIGURES.innkeeper;
    default:
      return null;
  }
}

/** Ein zufälliger Witz des Hofnarrs im Kerker. */
export function jesterJoke(seed?: number): string {
  if (typeof seed === 'number') {
    const idx = Math.abs(seed) % JESTER_JOKES.length;
    return JESTER_JOKES[idx]!;
  }
  const idx = Math.floor(Math.random() * JESTER_JOKES.length);
  return JESTER_JOKES[idx]!;
}
