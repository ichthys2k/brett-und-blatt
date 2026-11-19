import { useInputContext, useInputSource } from './InputContext';

export interface PromptItem {
  key: string;
  label: string;
}

const DEFAULT_PROMPTS: readonly PromptItem[] = [
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
export function ButtonPrompt({ items = DEFAULT_PROMPTS, className = '', onDismiss }: ButtonPromptProps) {
  const ctx = useInputContext();
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

