import { notFound } from 'next/navigation';
import { requireProfile } from '@/lib/auth';
import { ItemForm, type ItemRow } from '../item-form';

export default async function EditItemPage({ params }: PageProps<'/listam/[id]'>) {
  const { id } = await params;
  const { supabase, user } = await requireProfile();
  const { data } = await supabase
    .from('items')
    .select('id, title, url, image_url, price_min, price_max, priority, category, size, color, occasion, substitutable, description')
    .eq('id', id).eq('created_by', user.id).eq('origin', 'owner').maybeSingle();
  if (!data) notFound();
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="font-display text-3xl">Kívánság szerkesztése</h1>
      <ItemForm item={data as ItemRow} />
    </div>
  );
}
