import Link from 'next/link';
import { requireProfile } from '@/lib/auth';
import { NavLinks } from './nav-links';

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const { profile } = await requireProfile();
  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <aside className="hidden w-60 shrink-0 flex-col gap-6 border-r border-border p-6 md:flex">
        <Link href="/ma" className="font-display text-2xl">Ajándoki</Link>
        <NavLinks orientation="vertical" />
        <p className="mt-auto text-sm text-muted">Szia, {profile.display_name}!</p>
      </aside>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-10">{children}</main>
      <nav aria-label="Fő navigáció"
        className="fixed inset-x-0 bottom-0 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <NavLinks orientation="horizontal" />
      </nav>
    </div>
  );
}

// Bejelentkezéshez kötött oldal: a szerveren várja meg a munkamenetet.
export const instant = false;
