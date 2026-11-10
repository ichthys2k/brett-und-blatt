import { hasMath, replaceMath } from '@brett-und-blatt/engine';

/*
 * Formeln setzen (#101, L8): KaTeX aus dem eigenen Paket, erst geladen, wenn eine Karte eine Formel enthält (Schriften und Stil kommen
 * mit). Kein Fremdhost, `trust` aus: Befehle wie \href, \url oder \includegraphics sind nicht erlaubt. Eine Formel, die KaTeX ablehnt, bleibt als Text stehen.
 */

type Katex = typeof import('katex').default;
let loading: Promise<Katex> | null = null;
const load = (): Promise<Katex> =>
  (loading ??= (async () => {
    const [{ default: katex }] = await Promise.all([import('katex'), import('katex/dist/katex.min.css')]);
    return katex;
  })().catch((error) => {
    loading = null;
    throw error;
  }));

export { hasMath };

/** Das HTML mit gesetzten Formeln; bei einem Fehler beim Laden bleibt das Original. */
export async function renderMathInHtml(html: string): Promise<string> {
  if (!hasMath(html)) return html;
  try {
    const katex = await load();
    return replaceMath(html, (tex, display) => {
      try {
        return katex.renderToString(tex, { displayMode: display, throwOnError: true, trust: false, strict: 'ignore', output: 'htmlAndMathml', maxExpand: 1000, maxSize: 20 });
      } catch {
        return null;
      }
    });
  } catch {
    return html;
  }
}
