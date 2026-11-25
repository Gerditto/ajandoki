'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fieldErrors, formToObject, itemSchema } from '@/lib/validation/schemas';

export type ItemState = { ok?: boolean; errors?: Record<string, string> };

/** Saját kívánság létrehozása vagy módosítása (origin = 'owner'). */
export async function saveOwnItem(_prev: ItemState, formData: FormData): Promise<ItemState> {
  const parsed = itemSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/belepes');

  const d = parsed.data;
  const row = {
    title: d.title,
    url: d.url ?? null,
    image_url: d.image_url ?? null,
    price_min: d.price_min ?? null,
    price_max: d.price_max ?? null,
    priority: d.priority,
    category: d.category ?? null,
    size: d.size ?? null,
    color: d.color ?? null,
    occasion: d.occasion ?? null,
    substitutable: d.substitutable,
    description: d.description ?? null,
  };

  const id = formData.get('$id');
  const { error } = id
    ? await supabase.from('items').update(row).eq('id', String(id)).eq('created_by', auth.user.id)
    : await supabase.from('items').insert({ ...row, recipient_id: auth.user.id, created_by: auth.user.id, origin: 'owner' });
  if (error) return { errors: { _: 'Nem sikerült menteni. Próbáld újra.' } };

  revalidatePath('/listam');
  redirect('/listam');
}

export async function archiveOwnItem(formData: FormData) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/belepes');
  // Archiválás törlés helyett: a lefoglalt ajándékot az ajándékozó ne veszítse el nyomtalanul.
  await supabase.from('items').update({ archived_at: new Date().toISOString() })
    .eq('id', String(formData.get('id'))).eq('created_by', auth.user.id);
  revalidatePath('/listam');
}
