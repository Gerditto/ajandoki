import Link from 'next/link';
import { requireProfile } from '@/lib/auth';
import { Card } from '@/components/ui';
import { CreateGroupForm, JoinGroupForm } from './forms';

export const metadata = { title: 'Csoportok – Ajándoki' };

export default async function GroupsPage() {
  const { supabase, user } = await requireProfile();
  const { data: memberships } = await supabase
    .from('group_members')
    .select('role, groups(id, name, kind)')
    .eq('profile_id', user.id)
    .order('joined_at', { ascending: true });

  const groups = (memberships ?? [])
    .map((m) => ({ role: m.role as string, ...(m.groups as unknown as { id: string; name: string; kind: string }) }))
    .filter((g) => g.id);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-3xl">Csoportok</h1>
      {groups.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {groups.map((g) => (
            <li key={g.id}>
              <Link href={`/csoportok/${g.id}`}>
                <Card className="hover:border-primary">
                  <p className="font-semibold">{g.name}</p>
                  <p className="text-sm text-muted">{g.kind === 'occasional' ? 'Alkalmi' : 'Állandó'} · {g.role === 'owner' ? 'te hoztad létre' : g.role === 'admin' ? 'admin' : 'tag'}</p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Card><p className="text-muted">Még nem vagy csoportban. Hozz létre egyet a családnak, vagy csatlakozz egy kapott kóddal.</p></Card>
      )}
      <div className="grid gap-8 md:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl">Új csoport</h2>
          <CreateGroupForm />
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl">Csatlakozás kóddal</h2>
          <JoinGroupForm />
        </section>
      </div>
    </div>
  );
}
