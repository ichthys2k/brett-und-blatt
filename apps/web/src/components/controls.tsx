import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:brightness-110 shadow-sm',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface-2',
  ghost: 'text-ink hover:bg-surface-2',
};

export function Button({ variant = 'secondary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

export interface Choice<T extends string> {
  value: T;
  label: ReactNode;
  hint?: string;
}

/** Auswahl aus wenigen Möglichkeiten als Knopfleiste. */
export function Segmented<T extends string>({ value, choices, onChange, label }: { value: T; choices: Choice<T>[]; onChange: (value: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1 rounded-xl bg-surface-2 p-1">
      {choices.map((choice) => (
        <button
          key={choice.value}
          type="button"
          role="radio"
          aria-checked={choice.value === value}
          onClick={() => onChange(choice.value)}
          className={`flex min-h-10 flex-1 flex-col items-center justify-center rounded-lg px-3 py-1 text-sm transition ${
            choice.value === value ? 'bg-surface font-semibold text-ink shadow-sm' : 'text-muted hover:text-ink'
          }`}
        >
          <span>{choice.label}</span>
          {choice.hint && <span className="text-xs font-normal text-muted">{choice.hint}</span>}
        </button>
      ))}
    </div>
  );
}

/** Spielerzahl: wenige Möglichkeiten als Knopfleiste, viele (Bingo bis 30) mit − und +. */
export function PlayerCount({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (value: number) => void; label: string }) {
  if (max - min < 10) {
    return (
      <Segmented
        label={label}
        value={String(value)}
        choices={Array.from({ length: max - min + 1 }, (_, i) => ({ value: String(min + i), label: String(min + i) }))}
        onChange={(next) => onChange(Number(next))}
      />
    );
  }
  return (
    <div role="group" aria-label={label} className="flex items-center gap-2 rounded-xl bg-surface-2 p-1">
      <Button variant="ghost" className="px-4 text-xl" aria-label="weniger" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        −
      </Button>
      <output className="flex-1 text-center text-lg font-semibold tabular-nums" aria-live="polite">
        {value}
      </output>
      <Button variant="ghost" className="px-4 text-xl" aria-label="mehr" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
        +
      </Button>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">{title}</h2>
      {children}
    </section>
  );
}
