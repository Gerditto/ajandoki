import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireProfile } from '@/lib/auth';
import { NewDrawForm } from '../forms';

export const metadata = { title: 'Új sorsolás – Súgj!' };

export default async function NewDrawPage({ searchParams }: PageProps<'/sorsolas/uj'>) {
  const { csoport } = await searchParams;
  if (typeof csoport !== 'string') notFound();
  const { supabase } = await requireProfile();
  const { data: group } = await supabase.from('groups').select('id, name').eq('id', csoport).maybeSingle();
  if (!group) notFound();
  const [{ data: members }, { data: previous }] = await Promise.all([
    supabase.from('group_members').select('profile_id, profiles(display_name)').eq('group_id', group.id).order('joined_at'),
    supabase.from('draws').select('id, name').eq('group_id', group.id).neq('status', 'draft').order('created_at', { ascending: false }),
  ]);
  const list = (members ?? []).map((m) => ({
    id: m.profile_id,
    name: (m.profiles as unknown as { display_name: string } | null)?.display_name ?? '—',
  }));
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/csoportok/${group.id}`} className="text-sm text-muted underline">← {group.name}</Link>
        <h1 className="mt-2 text-3xl">Új Titkos Mikulás</h1>
        <p className="mt-2 text-muted">Mindenki csak azt látja, kit húzott. A szervező sem tudja meg a párokat.</p>
      </div>
      {list.length < 3 ? (
        <p className="rounded-card border border-border bg-surface p-4">Legalább 3 csoporttag kell a sorsoláshoz. Hívj meg még tagokat!</p>
      ) : (
        <NewDrawForm groupId={group.id} members={list} previousDraws={previous ?? []} />
      )}
    </div>
  );
}
