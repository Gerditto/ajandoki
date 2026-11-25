'use client';
import { createBrowserClient } from '@supabase/ssr';
import { publicSupabaseEnv } from './env';

/** Böngészőoldali kliens: csak az anon kulccsal, minden adatot az RLS véd. */
export function createClient() {
  const { url, anonKey } = publicSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
