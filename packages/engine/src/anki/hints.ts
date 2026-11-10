/*
 * Was an einer Karte (noch) nicht unterstützt wird (#101, L8): kurze Hinweise für die Oberfläche. Die Teile bleiben im Paket erhalten und gehen unverändert
 * zurück nach Anki; sie werden nur nicht ausgeführt oder gesetzt.
 */

/** Hinweise zu einer gezeichneten Karte (Vorlagen und Felder). */
export function unsupportedHints(sources: readonly string[]): string[] {
  const text = sources.join('\n');
  const out: string[] = [];
  if (/\[latex\]|\[\$\$?\]/i.test(text)) out.push('Formeln in [latex]- oder [$]-Klammern werden als Text gezeigt. Mit \\( … \\) und \\[ … \\] werden sie gesetzt.');
  if (/<script\b/i.test(text)) out.push('Skripte in der Vorlage werden nicht ausgeführt.');
  if (/\{\{[^{}]*\bvoices=|\bspeed=/.test(text)) out.push('Stimme und Tempo der Sprachausgabe aus der Vorlage werden nicht ausgewertet; es spricht die Stimme deines Browsers.');
  if (/image-occlusion:text/.test(text)) out.push('Textmasken beim Bilder verdecken werden nicht gezeichnet.');
  if (/\bangle=/.test(text) && /image-occlusion:/.test(text)) out.push('Gedrehte Masken beim Bilder verdecken werden ohne Drehung gezeichnet.');
  return out;
}
