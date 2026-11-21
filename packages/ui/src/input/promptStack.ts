/*
 * Stapel der angemeldeten Tastenhinweise (#607, K3a): Jeder sichtbare Bildschirm legt seine Hinweise
 * oben auf; es gelten die des obersten. Rein, ohne React, damit ohne DOM testbar.
 */

export interface PromptItem {
  key: string;
  label: string;
}

export interface PromptEntry {
  id: number;
  items: readonly PromptItem[];
}

/** Legt einen Eintrag oben auf den Stapel (ersetzt einen vorhandenen mit derselben id an seiner Stelle). */
export function pushPrompt(stack: readonly PromptEntry[], entry: PromptEntry): PromptEntry[] {
  const index = stack.findIndex((e) => e.id === entry.id);
  if (index === -1) return [...stack, entry];
  const next = [...stack];
  next[index] = entry;
  return next;
}

/** Entfernt den Eintrag mit dieser id. */
export function removePrompt(stack: readonly PromptEntry[], id: number): PromptEntry[] {
  return stack.filter((e) => e.id !== id);
}

/** Die geltenden Hinweise: die des obersten Eintrags oder `null` bei leerem Stapel. */
export function topPrompt(stack: readonly PromptEntry[]): readonly PromptItem[] | null {
  return stack.length > 0 ? stack[stack.length - 1]!.items : null;
}
