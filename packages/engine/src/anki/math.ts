/*
 * Formeln in Anki-Karten (#101, L8): `\(…\)` (im Text) und `\[…\]` (abgesetzt) stehen im Feld als Text. Hier wird nur gefunden und ersetzt;
 * gesetzt wird in der Web-App mit KaTeX aus dem eigenen Paket (kein Fremdhost). `[latex]…[/latex]`, `[$]…[/$]` und `[$$]…[/$$]` bleiben unverändert stehen
 * und gehen unverändert zurück nach Anki.
 */

const ENTITIES: Record<string, string> = { '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
const decode = (text: string): string => text.replace(/&(?:lt|gt|amp|quot|#39|nbsp);/g, (e) => ENTITIES[e] ?? e);

export const hasMath = (html: string): boolean => /\\\(|\\\[/.test(html);

/**
 * Ersetzt jede Formel im HTML durch das Ergebnis von `render(tex, abgesetzt)`. Nur Text zwischen Tags wird durchsucht (Formeln in Attributen
 * bleiben, wie sie sind); eine Formel, die über ein Tag hinausreicht, wird nicht erkannt. Liefert `render` `null`, bleibt die Formel als Text.
 */
export function replaceMath(html: string, render: (tex: string, display: boolean) => string | null): string {
  if (!hasMath(html)) return html;
  return html
    .split(/(<[^>]*>)/)
    .map((part) =>
      part.startsWith('<')
        ? part
        : part.replace(/\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g, (whole, inline: string | undefined, display: string | undefined) => {
            const tex = decode(inline ?? display ?? '').trim();
            if (!tex) return whole;
            return render(tex, display !== undefined) ?? whole;
          }),
    )
    .join('');
}
