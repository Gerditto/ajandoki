import Link from 'next/link';
import { requireProfile } from '@/lib/auth';
import { Card } from '@/components/ui';

export const metadata = { title: 'Ma – Ajándoki' };

export default async function TodayPage() {
  const { profile } = await requireProfile();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl">Szia, {profile.display_name}!</h1>
      <Card>
        <p className="font-semibold">Kezdd a listáddal</p>
        <p className="mt-1 text-muted">Ha mások tudják, minek örülnél, nem kapsz duplán ugyanazt.</p>
        <Link href="/listam/uj" className="mt-3 inline-block text-primary underline">Első kívánság felvétele</Link>
      </Card>
      <Card>
        <p className="font-semibold">Hamarosan</p>
        <p className="mt-1 text-muted">Itt látod majd a közelgő születésnapokat, névnapokat, a sorsolásaidat és a foglalásaidat.</p>
      </Card>
    </div>
  );
}
