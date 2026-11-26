import Link from 'next/link';
import { requireProfile } from '@/lib/auth';
import { Card } from '@/components/ui';

export const metadata = { title: 'Ma – Ajándoki' };

export default async function TodayPage() {
  const { profile, supabase, user } = await requireProfile();
  const { data: myDraws } = await supabase
    .from('draw_participants')
    .select('draws(id, name, status)')
    .eq('profile_id', user.id);
  const draws = (myDraws ?? [])
    .map((r) => r.draws as unknown as { id: string; name: string; status: string } | null)
    .filter((d): d is { id: string; name: string; status: string } => !!d && d.status !== 'closed');
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl">Szia, {profile.display_name}!</h1>
      {draws.map((d) => (
        <Link key={d.id} href={`/sorsolas/${d.id}`}>
          <Card className="border-gold/60 bg-secret-soft hover:border-gold">
            <p className="text-xs uppercase tracking-[0.25em] text-gold">Titkos Mikulás</p>
            <p className="mt-1 font-display text-xl">{d.name}</p>
            <p className="mt-1 text-sm text-muted">{d.status === 'drawn' ? 'Megtörtént a sorsolás. Nézd meg, kit húztál →' : 'Hamarosan sorsolás.'}</p>
          </Card>
        </Link>
      ))}
      <Card>
        <p className="font-semibold">Kezdd a listáddal</p>
        <p className="mt-1 text-muted">Ha mások tudják, minek örülnél, nem kapsz duplán ugyanazt.</p>
        <Link href="/listam/uj" className="mt-3 inline-block text-primary underline">Első kívánság felvétele</Link>
      </Card>
      <Card>
        <p className="font-semibold">Hamarosan</p>
        <p className="mt-1 text-muted">Itt látod majd a közelgő születésnapokat, névnapokat, és a foglalásaidat.</p>
      </Card>
    </div>
  );
}
