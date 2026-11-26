import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

/**
 * Belépő link beváltása.
 * - token_hash (ajánlott): bármelyik böngészőben működik, akkor is, ha a
 *   levelezőapp a saját beépített böngészőjében nyitja meg a linket.
 * - code (PKCE): csak ugyanabban a böngészőben működik, ahol a linket kérték.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get('token_hash');
  const type = (url.searchParams.get('type') ?? 'email') as EmailOtpType;
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('tovabb') ?? '/ma';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/ma';

  const supabase = await createClient();
  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin));
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin));
  }
  return NextResponse.redirect(new URL('/belepes?hiba=1', url.origin));
}
