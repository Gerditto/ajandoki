'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { fieldErrors, formToObject, profileSchema } from '@/lib/validation/schemas';

export type ProfileState = { ok?: boolean; errors?: Record<string, string> };

export async function saveProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const parsed = profileSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/belepes');

  const row = {
    id: auth.user.id,
    display_name: parsed.data.display_name,
    birthday: parsed.data.birthday ?? null,
    nameday: parsed.data.nameday ?? null,
  };
  const { error } = await supabase.from('profiles').upsert(row);
  if (error) return { errors: { _: 'Nem sikerült menteni. Próbáld újra.' } };

  revalidatePath('/', 'layout');
  if (formData.get('$onboarding') === '1') {
    const next = String(formData.get('$next') ?? '');
    redirect(next.startsWith('/') && !next.startsWith('//') && next !== '/ma' ? next : '/listam');
  }
  return { ok: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}

export async function setEmailReminders(formData: FormData) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/belepes');
  await supabase.from('profiles').update({ email_reminders: formData.get('on') === '1' }).eq('id', auth.user.id);
  revalidatePath('/profil');
}
