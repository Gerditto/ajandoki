import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { ProfileForm } from '@/components/profile-form';

export const metadata = { title: 'Üdv az Ajándokiban!' };

export default async function OnboardingPage() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
  if (data) redirect('/ma');
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div>
        <h1 className="font-display text-3xl">Üdv!</h1>
        <p className="mt-2 text-muted">
          Pár adat, hogy a családod és a barátaid tudják, kinek szánják az ajándékot. Minden más később is ráér.
        </p>
      </div>
      <ProfileForm onboarding />
    </main>
  );
}

// Bejelentkezéshez kötött oldal: a szerveren várja meg a munkamenetet.
export const instant = false;
