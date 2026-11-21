import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useInputContext, useInputSource } from './InputContext';
import { pushPrompt, removePrompt, topPrompt, type PromptEntry, type PromptItem } from './promptStack';

export type { PromptItem } from './promptStack';

export const DEFAULT_PROMPTS: readonly PromptItem[] = [
  { key: 'A', label: 'Auswählen' },
  { key: 'B', label: 'Zurück' },
  { key: 'X', label: 'Großansicht' },
  { key: 'LB/RB', label: 'Bereich' },
  { key: '☰', label: 'Menü' },
];

export interface ButtonPromptProps {
  items?: readonly PromptItem[];
  className?: string;
  onDismiss?: () => void;
}

/**
 * Zeigt kompakte Controller-Tastenhinweise, sobald zuletzt ein Gamepad genutzt wurde.
 * Bei Maus- oder Touch-Bedienung bleibt die Leiste unsichtbar.
 * Über onDismiss oder ctx.settings.prompts === false dauerhaft ausblendbar.
 */
interface PromptContextValue {
  items: readonly PromptItem[] | null;
  push: (entry: PromptEntry) => void;
  remove: (id: number) => void;
}

const PromptContext = createContext<PromptContextValue | null>(null);
let promptIdCounter = 0;

/** Hält die angemeldeten Tastenhinweise der sichtbaren Bildschirme (oberster gilt, #607 K3a). */
export function PromptProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<PromptEntry[]>([]);
  const push = useCallback((entry: PromptEntry) => setStack((s) => pushPrompt(s, entry)), []);
  const remove = useCallback((id: number) => setStack((s) => removePrompt(s, id)), []);
  const value = useMemo(() => ({ items: topPrompt(stack), push, remove }), [stack, push, remove]);
  return <PromptContext.Provider value={value}>{children}</PromptContext.Provider>;
}

/** Meldet die Tastenhinweise dieses Bildschirms an, solange die Komponente eingehängt ist; `null` meldet nichts an. */
export function usePromptItems(items: readonly PromptItem[] | null): void {
  const ctx = useContext(PromptContext);
  const idRef = useRef<number>(0);
  if (idRef.current === 0) idRef.current = ++promptIdCounter;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  // Abhängigkeit ist der Text, nicht das Array: ein bei jedem Rendern neu gebautes Array löst sonst eine Schleife aus.
  const signature = items ? items.map((i) => `${i.key}|${i.label}`).join('\n') : null;
  const push = ctx?.push;
  const remove = ctx?.remove;
  useEffect(() => {
    if (!push || !remove || signature === null || !itemsRef.current) return undefined;
    const id = idRef.current;
    push({ id, items: itemsRef.current });
    return () => remove(id);
  }, [push, remove, signature]);
}

export function ButtonPrompt({ items: itemsProp, className = '', onDismiss }: ButtonPromptProps) {
  const ctx = useInputContext();
  const promptCtx = useContext(PromptContext);
  const items = itemsProp ?? promptCtx?.items ?? DEFAULT_PROMPTS;
  const { inputSource, connectedGamepads } = useInputSource();
  if (ctx?.settings.prompts === false) return null;
  if (inputSource !== 'gamepad' && connectedGamepads === 0) return null;
  if (inputSource !== 'gamepad') return null;

  return (
    <div className={`bub-prompt-bar ${className}`} role="region" aria-label="Controller-Tastenhinweise">
      {items.map((item) => (
        <span key={`${item.key}-${item.label}`} className="bub-prompt-item">
          <kbd className="bub-prompt-key">{item.key}</kbd>
          <span className="bub-prompt-label">{item.label}</span>
        </span>
      ))}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="bub-prompt-close"
          aria-label="Tastenhinweise dauerhaft ausblenden"
          title="Tastenhinweise dauerhaft ausblenden"
        >
          ✕
        </button>
      )}
    </div>
  );
}

