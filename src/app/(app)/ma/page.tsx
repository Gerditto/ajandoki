import Link from 'next/link';
import { requireProfile } from '@/lib/auth';
import { Card } from '@/components/ui';
import { InstallHint } from '@/components/install-hint';
import { formatMonthDay, namesOn, nextOccurrence, todayInBudapest } from '@/lib/nameday';

export const metadata = { title: 'Ma – Ajándoki' };

type Upcoming = { id: string; name: string; kind: 'születésnap' | 'névnap'; mmdd: string; days: number; age?: number };

function when(days: number) {
  if (days === 0) return 'ma';
  if (days === 1) return 'holnap';
  return `${days} nap múlva`;
}

export default async function TodayPage() {
  const { profile, supabase, user } = await requireProfile();
  const today = todayInBudapest();
  const todayKey = today.toISOString().slice(5, 10);

  const [{ data: myDraws }, { data: people }] = await Promise.all([
    supabase.from('draw_participants').select('draws(id, name, status)').eq('profile_id', user.id),
    // RLS: csak magunkat és a közös csoportok tagjait látjuk.
    supabase.from('profiles').select('id, display_name, birthday, nameday').neq('id', user.id),
  ]);
  const draws = (myDraws ?? [])
    .map((r) => r.draws as unknown as { id: string; name: string; status: string } | null)
    .filter((d): d is { id: string; name: string; status: string } => !!d && d.status !== 'closed');

  const upcoming: Upcoming[] = [];
  for (const p of people ?? []) {
    if (p.birthday) {
      const mmdd = p.birthday.slice(5, 10);
      const next = nextOccurrence(mmdd, today);
      const age = next.date.getUTCFullYear() - Number(p.birthday.slice(0, 4));
      upcoming.push({ id: p.id, name: p.display_name, kind: 'születésnap', mmdd, days: next.days, age: age > 0 && age < 120 ? age : undefined });
    }
    if (p.nameday) {
      upcoming.push({ id: p.id, name: p.display_name, kind: 'névnap', mmdd: p.nameday, days: nextOccurrence(p.nameday, today).days });
    }
  }
  const soon = upcoming.filter((u) => u.days <= 60).sort((a, b) => a.days - b.days || a.name.localeCompare(b.name, 'hu'));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl">Szia, {profile.display_name}!</h1>
        <p className="mt-2 text-sm text-muted">
          Ma {formatMonthDay(todayKey)} van, {namesOn(todayKey).slice(0, 3).join(', ')} névnapja.
        </p>
      </div>

      {draws.map((d) => (
        <Link key={d.id} href={`/sorsolas/${d.id}`}>
          <Card className="border-gold/60 bg-secret-soft hover:border-gold">
            <p className="text-xs uppercase tracking-[0.25em] text-gold">Titkos Mikulás</p>
            <p className="mt-1 font-display text-xl">{d.name}</p>
            <p className="mt-1 text-sm text-muted">{d.status === 'drawn' ? 'Megtörtént a sorsolás. Nézd meg, kit húztál →' : 'Hamarosan sorsolás.'}</p>
          </Card>
        </Link>
      ))}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl">Közelgő alkalmak</h2>
        {soon.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {soon.map((u) => (
              <li key={`${u.id}-${u.kind}`}>
                <Link href={`/szemely/${u.id}`}>
                  <Card className={`flex items-center justify-between gap-3 hover:border-gold ${u.days === 0 ? 'border-gold bg-secret-soft' : ''}`}>
                    <div>
                      <p className="font-medium">{u.name}</p>
                      <p className="text-sm text-muted">
                        {u.kind === 'születésnap' && u.age ? `${u.age}. születésnap` : u.kind} · {formatMonthDay(u.mmdd)}
                      </p>
                    </div>
                    <span className={`shrink-0 text-sm ${u.days <= 7 ? 'font-semibold text-gold' : 'text-muted'}`}>{when(u.days)}</span>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Card>
            <p className="text-muted">A következő két hónapban nincs születés- vagy névnap a csoportjaidban. Ha a többiek megadják a profiljukban, itt látod majd.</p>
          </Card>
        )}
      </section>

      <Card>
        <p className="font-semibold">Kezdd a listáddal</p>
        <p className="mt-1 text-muted">Ha mások tudják, minek örülnél, nem kapsz duplán ugyanazt.</p>
        <Link href="/listam/uj" className="mt-3 inline-block text-primary underline">Kívánság felvétele</Link>
      </Card>

      <InstallHint />
    </div>
  );
}
