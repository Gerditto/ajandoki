import Image from 'next/image';
import Link from 'next/link';
import { LoginForm } from './login-form';

export const metadata = { title: 'Belépés – Súgj!' };

export default async function LoginPage({ searchParams }: PageProps<'/belepes'>) {
  const sp = await searchParams;
  const next = typeof sp.tovabb === 'string' ? sp.tovabb : '/ma';
  const failed = sp.hiba === '1';
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
      <Link href="/" className="w-fit rounded-card bg-[#132f23] p-4">
        <Image src="/brand/logo.png" alt="Súgj!" width={640} height={629} unoptimized className="h-auto w-24" />
      </Link>
      <h1 className="font-display text-3xl">Belépés vagy regisztráció</h1>
      {failed && (
        <p role="alert" className="text-red-700 dark:text-red-300">
          A link lejárt vagy már felhasználták. Kérj újat!
        </p>
      )}
      <LoginForm next={next} />
    </main>
  );
}
