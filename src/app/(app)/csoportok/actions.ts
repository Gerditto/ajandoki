'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { fieldErrors } from '@/lib/validation/schemas';

export type GroupState = { errors?: Record<string, string>; code?: string };

const groupSchema = z.object({
  name: z.string().trim().min(1, 'Adj nevet a csoportnak').max(80),
  kind: z.enum(['permanent', 'occasional']),
});

export async function createGroup(_prev: GroupState, formData: FormData): Promise<GroupState> {
  const parsed = groupSchema.safeParse({ name: formData.get('name'), kind: formData.get('kind') ?? 'permanent' });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_group', { p_name: parsed.data.name, p_kind: parsed.data.kind });
  if (error || !data) return { errors: { _: 'Nem sikerült létrehozni a csoportot.' } };
  revalidatePath('/csoportok');
  redirect(`/csoportok/${data}`);
}

/** Új meghívókód. A kódot csak most adjuk vissza, az adatbázis csak a hash-ét tárolja. */
export async function createInvite(_prev: GroupState, formData: FormData): Promise<GroupState> {
  const groupId = String(formData.get('group_id'));
  const supabase = await createClient();
  const expires = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabase.rpc('create_invite', { p_group: groupId, p_expires_at: expires });
  if (error || !data) return { errors: { _: 'Csak a csoport adminja hívhat meg tagokat.' } };
  return { code: data as string };
}

export async function joinGroup(_prev: GroupState, formData: FormData): Promise<GroupState> {
  const code = String(formData.get('code') ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length < 6) return { errors: { code: 'Írd be a kapott meghívókódot.' } };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('join_group', { p_code: code });
  if (error || !data) return { errors: { code: 'Ez a meghívó érvénytelen vagy lejárt. Kérj újat!' } };
  revalidatePath('/csoportok');
  redirect(`/csoportok/${data}`);
}

export async function leaveGroup(formData: FormData) {
  const groupId = String(formData.get('group_id'));
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/belepes');
  await supabase.from('group_members').delete().eq('group_id', groupId).eq('profile_id', auth.user.id);
  revalidatePath('/csoportok');
  redirect('/csoportok');
}

export async function setShareWishlist(formData: FormData) {
  const groupId = String(formData.get('group_id'));
  const share = formData.get('share') === '1';
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/belepes');
  await supabase.from('group_members').update({ shares_wishlist: share })
    .eq('group_id', groupId).eq('profile_id', auth.user.id);
  revalidatePath(`/csoportok/${groupId}`);
}
