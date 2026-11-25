import { requireProfile } from '@/lib/auth';
import { ProfileForm } from '@/components/profile-form';
import { signOut } from '@/lib/profile-actions';
import { Button } from '@/components/ui';

export const metadata = { title: 'Profil – Ajándoki' };

export default async function ProfilePage() {
  const { profile, user } = await requireProfile();
  return (
    <div className="flex max-w-xl flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl">Profilom</h1>
        <p className="mt-1 text-sm text-muted">{user.email}</p>
      </div>
      <ProfileForm initial={profile} />
      <form action={signOut}><Button variant="ghost" type="submit">Kijelentkezés</Button></form>
    </div>
  );
}
