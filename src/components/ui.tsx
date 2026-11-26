import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'secret' | 'danger' }) {
  const styles = {
    primary: 'bg-primary text-primary-contrast shadow-sm hover:opacity-90',
    ghost: 'border border-border bg-surface hover:border-gold',
    secret: 'bg-secret text-secret-contrast shadow-sm hover:opacity-90',
    danger: 'border border-red-300 text-red-700 hover:bg-red-50 dark:text-red-300',
  }[variant];
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 font-medium tracking-wide transition disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  );
}

export function Field({
  label,
  error,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }) {
  const id = props.id ?? props.name;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        className="min-h-11 rounded-xl border border-border bg-surface px-3 outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
        {...props}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-card border border-border bg-surface p-4 shadow-[0_1px_2px_rgba(22,36,29,0.04)] ${className}`}>{children}</div>;
}

export function SecretBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-secret-soft px-2.5 py-0.5 text-xs font-medium text-secret">
      <span aria-hidden>🔒</span>
      {children}
    </span>
  );
}
