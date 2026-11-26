'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { fieldErrors, formToObject, itemSchema } from '@/lib/validation/schemas';

export type ActionState = { ok?: boolean; message?: string; errors?: Record<string, string> };

const STATUSES = ['reserved', 'ordered', 'arrived', 'wrapped', 'given'] as const;

async function authed() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/belepes');
  return { supabase, userId: data.user.id };
}

export async function reserveItem(formData: FormData) {
  const { supabase } = await authed();
  const recipient = String(formData.get('recipient_id'));
  const days = Number(formData.get('days') ?? 0);
  const expires = days > 0 ? new Date(Date.now() + days * 24 * 3600 * 1000).toISOString() : null;
  await supabase.rpc('reserve_item', { p_item: String(formData.get('item_id')), p_expires_at: expires });
  // 'unavailable' esetén az oldal újratöltve már "foglalt"-ként mutatja – ez a helyes, szándékosan semmitmondó visszajelzés.
  revalidatePath(`/szemely/${recipient}`);
}

export async function releaseReservation(formData: FormData) {
  const { supabase } = await authed();
  await supabase.rpc('release_reservation', { p_reservation: String(formData.get('reservation_id')) });
  revalidatePath(`/szemely/${formData.get('recipient_id')}`);
  revalidatePath('/ma');
}

export async function setReservationStatus(formData: FormData) {
  const status = z.enum(STATUSES).safeParse(formData.get('status'));
  if (!status.success) return;
  const { supabase } = await authed();
  await supabase.rpc('set_reservation_status', {
    p_reservation: String(formData.get('reservation_id')), p_status: status.data,
  });
  revalidatePath(`/szemely/${formData.get('recipient_id')}`);
  revalidatePath('/ma');
}

export async function toggleNotRelevant(formData: FormData) {
  const { supabase, userId } = await authed();
  const itemId = String(formData.get('item_id'));
  if (formData.get('on') === '1') {
    await supabase.from('item_marks').upsert({ item_id: itemId, giver_id: userId, kind: 'not_relevant' });
  } else {
    await supabase.from('item_marks').delete().eq('item_id', itemId).eq('giver_id', userId);
  }
  revalidatePath(`/szemely/${formData.get('recipient_id')}`);
}

/** Titkos ötlet hozzáadása valaki más profiljához (a címzett soha nem látja). */
export async function addSecretIdea(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = itemSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const { supabase, userId } = await authed();
  const recipient = String(formData.get('$recipient'));
  const d = parsed.data;
  const { error } = await supabase.from('items').insert({
    recipient_id: recipient, created_by: userId, origin: 'giver',
    title: d.title, url: d.url ?? null, price_max: d.price_max ?? null, description: d.description ?? null,
  });
  if (error) return { errors: { _: 'Nem sikerült menteni.' } };
  revalidatePath(`/szemely/${recipient}`);
  return { ok: true, message: 'Titkos ötlet elmentve.' };
}

const noteSchema = z.object({
  body: z.string().trim().min(1, 'Írj valamit').max(2000),
  group_id: z.string().uuid('Válassz csoportot'),
});

export async function addSecretNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = noteSchema.safeParse({ body: formData.get('body'), group_id: formData.get('group_id') });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const { supabase, userId } = await authed();
  const recipient = String(formData.get('$recipient'));
  const { error } = await supabase.from('secret_notes').insert({
    recipient_id: recipient, group_id: parsed.data.group_id, author_id: userId, body: parsed.data.body,
  });
  if (error) return { errors: { _: 'Nem sikerült menteni.' } };
  revalidatePath(`/szemely/${recipient}`);
  return { ok: true };
}
