import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth';
import { Button, Card, SecretBadge } from '@/components/ui';
import { releaseReservation, reserveItem, setReservationStatus, toggleNotRelevant } from './actions';
import { SecretIdeaForm, SecretNoteForm } from './forms';

const huf = new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 });
const STATUS_LABEL: Record<string, string> = {
  reserved: 'Lefoglalva', ordered: 'Megrendelve', arrived: 'Megérkezett', wrapped: 'Becsomagolva', given: 'Átadva',
};

type Status = { item_id: string; state: 'free' | 'mine' | 'taken'; reservation_id: string | null;
  reservation_status: string | null; reserved_by: string | null; not_relevant_count: number };

export default async function PersonPage({ params }: PageProps<'/szemely/[id]'>) {
  const { id } = await params;
  const { supabase, user } = await requireProfile();
  if (id === user.id) redirect('/listam');

  const { data: person } = await supabase.from('profiles').select('id, display_name, birthday, nameday').eq('id', id).maybeSingle();
  if (!person) notFound();

  const [{ data: details }, { data: items }, { data: statuses }, { data: myMarks }, { data: notes }, { data: theirGroups }] =
    await Promise.all([
      supabase.from('profile_details').select('key, value').eq('profile_id', id),
      supabase.from('items')
        .select('id, origin, created_by, title, url, price_min, price_max, priority, size, color, substitutable, description')
        .eq('recipient_id', id).is('archived_at', null)
        .order('origin').order('priority', { ascending: false }),
      supabase.rpc('gift_status_for', { p_recipient: id }),
      supabase.from('item_marks').select('item_id').eq('giver_id', user.id),
      supabase.from('secret_notes').select('id, body, created_at, author_id, groups(name)').eq('recipient_id', id)
        .order('created_at', { ascending: false }).limit(50),
      supabase.from('group_members').select('group_id, groups(name)').eq('profile_id', id),
    ]);

  const statusBy = new Map<string, Status>(((statuses ?? []) as Status[]).map((s) => [s.item_id, s]));
  const marked = new Set((myMarks ?? []).map((m) => m.item_id));
  const shared = (theirGroups ?? []).map((g) => ({ id: g.group_id, name: (g.groups as unknown as { name: string } | null)?.name ?? '' }));

  // Nevek a foglalókhoz, ötletgazdákhoz, megjegyzésírókhoz (csak akiket az RLS amúgy is mutat)
  const ids = new Set<string>();
  statusBy.forEach((s) => s.reserved_by && ids.add(s.reserved_by));
  items?.forEach((i) => i.origin !== 'owner' && ids.add(i.created_by));
  notes?.forEach((n) => ids.add(n.author_id));
  const { data: names } = ids.size
    ? await supabase.from('profiles').select('id, display_name').in('id', [...ids])
    : { data: [] as { id: string; display_name: string }[] };
  const nameOf = (pid: string) => (pid === user.id ? 'te' : names?.find((n) => n.id === pid)?.display_name ?? 'valaki');

  const canGive = statusBy.size > 0 || (items?.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-display text-3xl">{person.display_name}</h1>
        <p className="text-sm text-muted">
          {[person.birthday && `Születésnap: ${person.birthday.slice(5).replace('-', '. ')}.`, person.nameday && `Névnap: ${person.nameday.replace('-', '. ')}.`]
            .filter(Boolean).join(' · ')}
        </p>
        {!!details?.length && (
          <p className="mt-2 text-sm">{details.map((d) => `${d.key}: ${d.value}`).join(' · ')}</p>
        )}
        <div className="mt-3"><SecretBadge>Ezt az oldalt {person.display_name} soha nem látja így</SecretBadge></div>
      </header>

      {!canGive ? (
        <Card><p className="text-muted">{person.display_name} nem osztja meg a kívánságlistáját a közös csoportotokkal.</p></Card>
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl">Kívánságok és ötletek</h2>
          {!items?.length && <Card><p className="text-muted">Még üres a lista. Adj hozzá titkos ötletet lent!</p></Card>}
          <ul className="flex flex-col gap-3">
            {items?.map((it) => {
              const st = statusBy.get(it.id);
              const notRelevant = marked.has(it.id);
              return (
                <li key={it.id}>
                  <Card className={`flex flex-col gap-2 ${it.origin !== 'owner' ? 'border-secret/40 bg-secret-soft/40' : ''} ${st?.state === 'taken' || notRelevant ? 'opacity-70' : ''}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{it.title}</p>
                        <p className="text-sm text-muted">
                          {[
                            it.price_max != null && (it.price_min != null ? `${huf.format(it.price_min)} – ${huf.format(it.price_max)}` : `max. ${huf.format(it.price_max)}`),
                            it.size && `méret: ${it.size}`, it.color && `szín: ${it.color}`, it.substitutable && 'hasonló is jó',
                          ].filter(Boolean).join(' · ')}
                        </p>
                        {it.description && <p className="mt-1 text-sm">{it.description}</p>}
                      </div>
                      {it.origin !== 'owner' && <SecretBadge>titkos ötlet · {nameOf(it.created_by)}</SecretBadge>}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {it.url && <a href={it.url} target="_blank" rel="noopener noreferrer nofollow" className="text-sm text-primary underline">Megnyitás</a>}
                      <span className="flex-1" />
                      {st?.state === 'free' && (
                        <form action={reserveItem} className="flex items-center gap-2">
                          <input type="hidden" name="item_id" value={it.id} />
                          <input type="hidden" name="recipient_id" value={id} />
                          <select name="days" aria-label="Foglalás időtartama" className="min-h-11 rounded-full border border-border bg-surface px-3 text-sm">
                            <option value="0">Lejárat nélkül</option>
                            <option value="7">1 hétig</option>
                            <option value="30">1 hónapig</option>
                          </select>
                          <Button variant="secret" type="submit">🔒 Lefoglalom</Button>
                        </form>
                      )}
                      {st?.state === 'taken' && (
                        <SecretBadge>{st.reserved_by ? `${nameOf(st.reserved_by)} lefoglalta` : 'Már nem elérhető'}</SecretBadge>
                      )}
                      {st?.state === 'mine' && st.reservation_id && (
                        <div className="flex flex-wrap items-center gap-2">
                          <form action={setReservationStatus} className="flex items-center gap-2">
                            <input type="hidden" name="reservation_id" value={st.reservation_id} />
                            <input type="hidden" name="recipient_id" value={id} />
                            <select name="status" defaultValue={st.reservation_status ?? 'reserved'} aria-label="Beszerzési állapot"
                              className="min-h-11 rounded-full border border-secret bg-surface px-3 text-sm text-secret">
                              {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                            <Button variant="ghost" type="submit">Mentés</Button>
                          </form>
                          <form action={releaseReservation}>
                            <input type="hidden" name="reservation_id" value={st.reservation_id} />
                            <input type="hidden" name="recipient_id" value={id} />
                            <button className="text-sm text-muted underline">Feloldás</button>
                          </form>
                        </div>
                      )}
                      <form action={toggleNotRelevant}>
                        <input type="hidden" name="item_id" value={it.id} />
                        <input type="hidden" name="recipient_id" value={id} />
                        <input type="hidden" name="on" value={notRelevant ? '0' : '1'} />
                        <button className="text-sm text-muted underline">
                          {notRelevant ? 'Mégis releváns' : 'Nem releváns'}
                          {!!st?.not_relevant_count && ` (${st.not_relevant_count})`}
                        </button>
                      </form>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {canGive && (
        <div className="grid gap-8 md:grid-cols-2">
          <section className="flex flex-col gap-3">
            <h2 className="font-display text-xl">Új titkos ötlet</h2>
            <SecretIdeaForm recipientId={id} />
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="font-display text-xl">Egyeztetés a többiekkel</h2>
            <SecretNoteForm recipientId={id} groups={shared} />
            <ul className="flex flex-col gap-2">
              {notes?.map((n) => (
                <li key={n.id} className="rounded-xl bg-secret-soft p-3 text-sm">
                  <p>{n.body}</p>
                  <p className="mt-1 text-xs text-muted">
                    {nameOf(n.author_id)} · {(n.groups as unknown as { name: string } | null)?.name} · {new Date(n.created_at).toLocaleDateString('hu-HU')}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
      <Link href="/csoportok" className="text-sm text-muted underline">← Vissza a csoportokhoz</Link>
    </div>
  );
}
