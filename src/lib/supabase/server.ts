import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { publicSupabaseEnv } from './env';

/** Szerveroldali kliens a bejelentkezett felhasználó nevében (RLS érvényes). */
export async function createClient() {
  const { url, anonKey } = publicSupabaseEnv();
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Componentből nem írható süti; a munkamenetet a proxy frissíti.
        }
      },
    },
  });
}

/**
 * Service role kliens – megkerüli az RLS-t. KIZÁRÓLAG szűk, auditált
 * szerverműveletekhez (pl. sorsolás eredményének beírása), soha nem adjuk ki
 * a kliensnek, és a válaszában nem adunk vissza titkos adatot.
 */
export function createServiceClient() {
  const { url } = publicSupabaseEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('Hiányzik a SUPABASE_SERVICE_ROLE_KEY');
  return createAdminClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
