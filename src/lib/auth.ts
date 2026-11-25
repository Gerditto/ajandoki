import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/** A bejelentkezett felhasználó és a profilja; ha nincs belépve, a belépésre irányít. */
export async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/belepes');
  return { supabase, user: data.user };
}

/** Mint a requireUser, de profil nélkül a bemutatkozó lépésre irányít. */
export async function requireProfile() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_path, birthday, nameday, locale')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile) redirect('/bemutatkozas');
  return { supabase, user, profile };
}
