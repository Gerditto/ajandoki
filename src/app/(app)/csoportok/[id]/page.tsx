import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireProfile } from '@/lib/auth';
import { Button, Card } from '@/components/ui';
import { InvitePanel } from '../forms';
import { leaveGroup, setShareWishlist } from '../actions';

export default async function GroupPage({ params }: PageProps<'/csoportok/[id]'>) {
  const { id } = await params;
  const { supabase, user } = await requireProfile();
  const { data: group } = await supabase.from('groups').select('id, name, kind').eq('id', id).maybeSingle();
  if (!group) notFound();

  const { data: members } = await supabase
    .from('group_members')
    .select('profile_id, role, shares_wishlist, profiles(display_name)')
    .eq('group_id', id)
    .order('joined_at');

  const { data: draws } = await supabase
    .from('draws')
    .select('id, name, status, event_date')
    .eq('group_id', id)
    .order('created_at', { ascending: false });

  const me = members?.find((m) => m.profile_id === user.id);
  const isAdmin = me?.role === 'owner' || me?.role === 'admin';

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/csoportok" className="text-sm text-muted underline">← Csoportok</Link>
        <h1 className="mt-2 font-display text-3xl">{group.name}</h1>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl">Tagok ({members?.length ?? 0})</h2>
        <ul className="flex flex-col gap-2">
          {members?.map((m) => {
            const name = (m.profiles as unknown as { display_name: string } | null)?.display_name ?? '—';
            const self = m.profile_id === user.id;
            return (
              <li key={m.profile_id}>
                {self ? (
                  <Card className="flex items-center justify-between"><span>{name} (te)</span></Card>
                ) : (
                  <Link href={`/szemely/${m.profile_id}`}>
                    <Card className="flex items-center justify-between hover:border-primary">
                      <span className="font-medium">{name}</span>
                      <span className="text-sm text-primary">{m.shares_wishlist ? 'Kívánságlista →' : 'Profil →'}</span>
                    </Card>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-xl">Titkos Mikulás</h2>
          <Link href={`/sorsolas/uj?csoport=${group.id}`} className="text-sm text-primary underline">+ Új sorsolás</Link>
        </div>
        {draws && draws.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {draws.map((d) => (
              <li key={d.id}>
                <Link href={`/sorsolas/${d.id}`}>
                  <Card className="flex items-center justify-between hover:border-gold">
                    <span className="font-medium">{d.name}</span>
                    <span className={`text-sm ${d.status === 'draft' ? 'text-muted' : 'text-gold'}`}>
                      {d.status === 'draft' ? 'Előkészítés alatt' : 'Kisorsolva →'}
                    </span>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Még nincs sorsolás. Indíts egyet a karácsonyi ajándékozáshoz!</p>
        )}
      </section>

      {isAdmin && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl">Meghívás</h2>
          <InvitePanel groupId={group.id} groupName={group.name} />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl">Beállításaim ebben a csoportban</h2>
        <form action={setShareWishlist} className="flex items-center justify-between gap-4">
          <input type="hidden" name="group_id" value={group.id} />
          <input type="hidden" name="share" value={me?.shares_wishlist ? '0' : '1'} />
          <p className="text-sm">{me?.shares_wishlist ? 'A csoport látja a kívánságlistámat.' : 'A csoport nem látja a kívánságlistámat.'}</p>
          <Button variant="ghost" type="submit">{me?.shares_wishlist ? 'Elrejtem' : 'Megmutatom'}</Button>
        </form>
        <form action={leaveGroup}>
          <input type="hidden" name="group_id" value={group.id} />
          <Button variant="danger" type="submit">Kilépés a csoportból</Button>
        </form>
      </section>
    </div>
  );
}
