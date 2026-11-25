'use server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { emailSchema, fieldErrors } from '@/lib/validation/schemas';

export type LoginState = { sent?: boolean; email?: string; errors?: Record<string, string> };

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = emailSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const next = String(formData.get('tovabb') ?? '/ma');
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/ma';
  const h = await headers();
  const origin = h.get('origin') ?? `https://${h.get('host')}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${origin}/auth/confirm?tovabb=${encodeURIComponent(safeNext)}` },
  });
  if (error) {
    // Ne áruljuk el, létezik-e a fiók; csak az általános hibát mutatjuk.
    return { errors: { email: 'Most nem sikerült elküldeni a linket. Próbáld újra pár perc múlva.' } };
  }
  return { sent: true, email: parsed.data.email };
}
