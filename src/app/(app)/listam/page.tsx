import Link from 'next/link';
import { requireProfile } from '@/lib/auth';
import { Card } from '@/components/ui';
import { archiveOwnItem } from './actions';

const huf = new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 });
const PRIORITY = { 3: 'Nagyon szeretném', 2: 'Örülnék neki', 1: 'Ha belefér' } as Record<number, string>;

export const metadata = { title: 'Listám – Súgj!' };

export default async function MyListPage() {
  const { supabase, user } = await requireProfile();
  // Az RLS miatt itt eleve csak a saját (origin = 'owner') tételek jöhetnek vissza.
  const { data: items } = await supabase
    .from('items')
    .select('id, title, url, price_min, price_max, priority, size, color, substitutable')
    .eq('recipient_id', user.id)
    .is('archived_at', null)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl">Kívánságlistám</h1>
        <Link href="/listam/uj" className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 font-medium text-primary-contrast">
          + Új kívánság
        </Link>
      </header>
      {!items?.length ? (
        <Card className="text-center">
          <p className="font-display text-xl">Még üres a listád</p>
          <p className="mt-2 text-muted">Adj hozzá egy linket vagy csak egy ötletet. Senki nem fogja tudni, ki mit vett belőle.</p>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((it) => (
            <li key={it.id}>
              <Card className="flex h-full flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/listam/${it.id}`} className="font-semibold hover:underline">{it.title}</Link>
                  <span className="shrink-0 text-xs text-muted">{PRIORITY[it.priority]}</span>
                </div>
                <p className="text-sm text-muted">
                  {[
                    it.price_max != null ? (it.price_min != null ? `${huf.format(it.price_min)} – ${huf.format(it.price_max)}` : `max. ${huf.format(it.price_max)}`) : null,
                    it.size && `méret: ${it.size}`,
                    it.color && `szín: ${it.color}`,
                    it.substitutable && 'hasonló is jó',
                  ].filter(Boolean).join(' · ')}
                </p>
                <div className="mt-auto flex gap-3 pt-2 text-sm">
                  {it.url && <a href={it.url} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline">Megnyitás</a>}
                  <Link href={`/listam/${it.id}`} className="underline">Szerkesztés</Link>
                  <form action={archiveOwnItem} className="ml-auto">
                    <input type="hidden" name="id" value={it.id} />
                    <button className="text-muted underline">Levétel</button>
                  </form>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
