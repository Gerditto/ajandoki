'use client';
import { useMemo, useState } from 'react';
import { formatMonthDay, namedaysOf, namesOn, searchNames } from '@/lib/nameday';

/** Névnap választó: névre keres a magyar névnaptárban, a mentett érték „HH-NN”. */
export function NamedayPicker({ defaultValue, nameHint, error }: { defaultValue?: string | null; nameHint?: string | null; error?: string }) {
  const [value, setValue] = useState(defaultValue ?? '');
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchNames(query), [query]);
  const suggested = useMemo(() => {
    const first = nameHint?.split(/\s+/)[0] ?? '';
    return first ? namedaysOf(first).map((d) => ({ name: first, day: d })) : [];
  }, [nameHint]);

  const options = query
    ? results.flatMap((r) => r.days.map((day) => ({ name: r.name, day })))
    : suggested;

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name="nameday" value={value} />
      <label htmlFor="nameday-search" className="text-sm font-medium">Névnap (nem kötelező)</label>
      {value && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-gold/60 bg-secret-soft px-3 py-2">
          <span><span className="font-medium">{formatMonthDay(value)}</span> <span className="text-sm text-muted">({namesOn(value).slice(0, 3).join(', ')})</span></span>
          <button type="button" onClick={() => setValue('')} className="min-h-11 px-2 text-sm text-muted underline">Törlés</button>
        </div>
      )}
      <input id="nameday-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)}
        placeholder={value ? 'Másik név keresése…' : 'Írd be a neved, pl. Nimród'} autoComplete="off"
        className="min-h-11 rounded-xl border border-border bg-surface px-3 outline-none focus:border-gold focus:ring-2 focus:ring-gold/30" />
      {options.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Névnap javaslatok">
          {options.slice(0, 12).map((o) => (
            <li key={`${o.name}-${o.day}`}>
              <button type="button" onClick={() => { setValue(o.day); setQuery(''); }}
                aria-pressed={value === o.day}
                className={`min-h-11 rounded-full border px-3 text-sm transition ${value === o.day ? 'border-primary bg-primary text-primary-contrast' : 'border-border bg-surface hover:border-gold'}`}>
                {o.name} · {formatMonthDay(o.day)}
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.length >= 2 && options.length === 0 && (
        <p className="text-sm text-muted">Nincs ilyen név a naptárban.</p>
      )}
      {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    </div>
  );
}
