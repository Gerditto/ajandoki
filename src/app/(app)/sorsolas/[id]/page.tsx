import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireProfile } from '@/lib/auth';
import { Button, Card, SecretBadge } from '@/components/ui';
import { addExclusion, deleteDraw, performDraw, removeExclusion, resetDraw } from '../actions';

export const metadata = { title: 'Titkos Mikulás – Súgj!' };

const huf = new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 });
const dateFmt = new Intl.DateTimeFormat('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' });

export default async function DrawPage({ params, searchParams }: PageProps<'/sorsolas/[id]'>) {
  const { id } = await params;
  const sp = await searchParams;
  const error = typeof sp.hiba === 'string' ? sp.hiba : undefined;
  const reveal = sp.mutasd === '1';
  const { supabase, user } = await requireProfile();

  const { data: draw } = await supabase
    .from('draws')
    .select('id, name, group_id, event_date, budget_amount, forbid_mutual, status, created_by, groups(name)')
    .eq('id', id)
    .maybeSingle();
  if (!draw) notFound();
  const isOrganizer = draw.created_by === user.id;
  const groupName = (draw.groups as unknown as { name: string } | null)?.name ?? 'Csoport';

  const [{ data: parts }, { data: excl }, { data: mine }] = await Promise.all([
    supabase.from('draw_participants').select('profile_id, profiles(display_name)').eq('draw_id', id),
    isOrganizer
      ? supabase.from('draw_exclusions').select('giver_id, receiver_id').eq('draw_id', id)
      : Promise.resolve({ data: [] as { giver_id: string; receiver_id: string }[] }),
    // Saját sor (RLS: csak ezt látjuk). A sima lekérdezés nem jelöli "megnézettnek".
    supabase.from('draw_assignments').select('receiver_id, seen_at').eq('draw_id', id).maybeSingle(),
  ]);
  const names = new Map((parts ?? []).map((p) => [p.profile_id, (p.profiles as unknown as { display_name: string } | null)?.display_name ?? '—']));
  const amParticipant = names.has(user.id);

  let receiverId = mine?.seen_at ? mine.receiver_id : null;
  if (reveal && draw.status === 'drawn' && amParticipant) {
    const { data } = await supabase.rpc('my_draw_assignment', { p_draw: id });
    receiverId = (data as string | null) ?? null;
  }
  let receiverName: string | null = null;
  if (receiverId) {
    receiverName = names.get(receiverId) ?? null;
    if (!receiverName) {
      const { data: p } = await supabase.from('profiles').select('display_name').eq('id', receiverId).maybeSingle();
      receiverName = p?.display_name ?? 'valaki';
    }
  }

  const progress = draw.status === 'drawn'
    ? ((await supabase.rpc('draw_progress', { p_draw: id })).data as { profile_id: string; has_seen: boolean }[] | null) ?? []
    : [];
  const seenCount = progress.filter((p) => p.has_seen).length;

  // Kölcsönös kizárásokat egy sorban mutatjuk.
  const pairs: { a: string; b: string; mutual: boolean }[] = [];
  const set = new Set((excl ?? []).map((e) => `${e.giver_id}|${e.receiver_id}`));
  for (const e of excl ?? []) {
    const mutual = set.has(`${e.receiver_id}|${e.giver_id}`);
    if (mutual && e.giver_id > e.receiver_id) continue;
    pairs.push({ a: e.giver_id, b: e.receiver_id, mutual });
  }
  const sortedNames = [...names].sort((x, y) => x[1].localeCompare(y[1], 'hu'));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href={`/csoportok/${draw.group_id}`} className="text-sm text-muted underline">← {groupName}</Link>
        <p className="mt-3 text-xs uppercase tracking-[0.25em] text-gold">Titkos Mikulás</p>
        <h1 className="mt-1 text-3xl">{draw.name}</h1>
        <span className="ornament mt-3" aria-hidden />
        <p className="mt-3 text-muted">
          {draw.event_date && <>Ajándékozás: {dateFmt.format(new Date(draw.event_date))}</>}
          {draw.event_date && draw.budget_amount != null && ' · '}
          {draw.budget_amount != null && <>Értékhatár: {huf.format(Number(draw.budget_amount))}</>}
        </p>
      </div>

      {error && <p role="alert" className="rounded-card border border-red-300 bg-red-50 p-4 text-red-800 dark:bg-transparent dark:text-red-300">{error}</p>}

      {draw.status === 'drawn' && amParticipant && (
        <section>
          {receiverName ? (
            <Card className="flex flex-col items-center gap-3 border-gold/60 bg-secret-soft py-8 text-center">
              <SecretBadge>Csak te látod</SecretBadge>
              <p className="text-muted">Te húztad:</p>
              <p className="font-display text-4xl text-primary">{receiverName}</p>
              {receiverId && <Link href={`/szemely/${receiverId}`} className="text-primary underline">Kívánságlistája és ötletek →</Link>}
            </Card>
          ) : (
            <Card className="flex flex-col items-center gap-4 py-8 text-center">
              <p className="font-display text-2xl">Megtörtént a sorsolás!</p>
              <p className="text-muted">Nézd meg egyedül, hogy maradjon titok.</p>
              <form>
                <input type="hidden" name="mutasd" value="1" />
                <Button variant="secret" type="submit">🔒 Megnézem, kit húztam</Button>
              </form>
            </Card>
          )}
        </section>
      )}

      {draw.status === 'draft' && !isOrganizer && (
        <Card><p>A szervező még nem indította el a sorsolást. Ha kész, itt látod majd, kit húztál.</p></Card>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl">Résztvevők ({names.size})</h2>
        {draw.status === 'drawn' && (
          <p className="text-sm text-muted">{seenCount} / {names.size} már megnézte, kit húzott.</p>
        )}
        <ul className="flex flex-wrap gap-2">
          {sortedNames.map(([pid, n]) => {
            const seen = progress.find((p) => p.profile_id === pid)?.has_seen;
            return (
              <li key={pid} className="rounded-full border border-border bg-surface px-3 py-1 text-sm">
                {n}{draw.status === 'drawn' && <span className={seen ? 'text-success' : 'text-muted'}> {seen ? '✓' : '·'}</span>}
              </li>
            );
          })}
        </ul>
      </section>

      {isOrganizer && draw.status === 'draft' && (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-xl">Kizárások</h2>
            <p className="text-sm text-muted">Pl. párok vagy egy háztartásban élők ne húzzák egymást.</p>
            {pairs.length > 0 && (
              <ul className="flex flex-col gap-2">
                {pairs.map((p) => (
                  <li key={`${p.a}-${p.b}`}>
                    <Card className="flex items-center justify-between gap-3 py-2">
                      <span className="text-sm">{names.get(p.a)} {p.mutual ? '⇄' : '→'} {names.get(p.b)}</span>
                      <form action={removeExclusion}>
                        <input type="hidden" name="draw_id" value={id} />
                        <input type="hidden" name="giver" value={p.a} />
                        <input type="hidden" name="receiver" value={p.b} />
                        {p.mutual && <input type="hidden" name="both" value="1" />}
                        <button className="min-h-11 px-2 text-sm text-muted underline">Törlés</button>
                      </form>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
            <form action={addExclusion} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
              <input type="hidden" name="draw_id" value={id} />
              <div className="grid gap-3 sm:grid-cols-2">
                {(['a', 'b'] as const).map((k, i) => (
                  <label key={k} className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">{i === 0 ? 'Ő' : 'ne húzza őt'}</span>
                    <select name={k} required defaultValue="" className="min-h-11 rounded-xl border border-border bg-bg px-3">
                      <option value="" disabled>Válassz…</option>
                      {sortedNames.map(([pid, n]) => <option key={pid} value={pid}>{n}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" name="mutual" defaultChecked className="size-4 accent-[var(--primary)]" />
                Kölcsönösen (egymást se húzhatják)
              </label>
              <Button variant="ghost" type="submit">Kizárás hozzáadása</Button>
            </form>
          </section>

          <section className="flex flex-col gap-3">
            <form action={performDraw}>
              <input type="hidden" name="draw_id" value={id} />
              <Button type="submit" className="w-full">Sorsolás indítása</Button>
            </form>
            <p className="text-center text-sm text-muted">Az eredményt te sem látod, csak a saját húzásodat.</p>
          </section>
        </>
      )}

      {isOrganizer && (
        <section className="flex flex-col gap-3 border-t border-border pt-6">
          <h2 className="text-xl">Szervezői beállítások</h2>
          {draw.status === 'drawn' && (
            <form action={resetDraw} className="flex flex-col gap-2">
              <input type="hidden" name="draw_id" value={id} />
              <p className="text-sm text-muted">Ha változott a résztvevők köre, újrasorsolhatsz. Ilyenkor mindenki új párt kap.</p>
              <Button variant="ghost" type="submit">Visszaállítás és újrasorsolás</Button>
            </form>
          )}
          <form action={deleteDraw}>
            <input type="hidden" name="draw_id" value={id} />
            <input type="hidden" name="group_id" value={draw.group_id} />
            <Button variant="danger" type="submit">Sorsolás törlése</Button>
          </form>
        </section>
      )}
    </div>
  );
}
