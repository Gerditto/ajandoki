import { requireProfile } from '@/lib/auth';
import { ProfileForm } from '@/components/profile-form';
import { setEmailReminders, signOut } from '@/lib/profile-actions';
import { Button, Card } from '@/components/ui';
import { PasswordForm } from '@/components/password-form';

export const metadata = { title: 'Profil – Ajándoki' };

export default async function ProfilePage({ searchParams }: PageProps<'/profil'>) {
  const sp = await searchParams;
  const { profile, user, supabase } = await requireProfile();
  const { data: prefs } = await supabase.from('profiles').select('email_reminders').eq('id', user.id).maybeSingle();
  const reminders = prefs?.email_reminders ?? true;
  return (
    <div className="flex max-w-xl flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl">Profilom</h1>
        <p className="mt-1 text-sm text-muted">{user.email}</p>
      </div>
      {sp['uj-jelszo'] === '1' && <PasswordForm highlight />}
      <ProfileForm initial={profile} />
      <Card className="flex flex-col gap-3">
        <p className="font-semibold">Email-emlékeztetők</p>
        <p className="text-sm text-muted">
          {reminders
            ? 'Szólunk születés- és névnapok előtt, ha lejár egy foglalásod, és ha megtörtént egy sorsolás.'
            : 'Nem küldünk emlékeztetőt emailben.'}
        </p>
        <form action={setEmailReminders}>
          <input type="hidden" name="on" value={reminders ? '0' : '1'} />
          <Button variant="ghost" type="submit">{reminders ? 'Kikapcsolom' : 'Bekapcsolom'}</Button>
        </form>
      </Card>
      {sp['uj-jelszo'] !== '1' && <PasswordForm />}
      <form action={signOut}><Button variant="ghost" type="submit">Kijelentkezés</Button></form>
    </div>
  );
}
