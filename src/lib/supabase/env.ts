/** Nyilvános (kliensen is elérhető) Supabase-beállítások. A service role kulcs SOHA nem kerül ide. */
export function publicSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Hiányzik a NEXT_PUBLIC_SUPABASE_URL vagy a NEXT_PUBLIC_SUPABASE_ANON_KEY (lásd .env.example)');
  }
  return { url, anonKey };
}
