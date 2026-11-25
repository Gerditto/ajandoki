'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/ma', label: 'Ma', icon: '☀️' },
  { href: '/listam', label: 'Listám', icon: '🎁' },
  { href: '/csoportok', label: 'Csoportok', icon: '👪' },
  { href: '/profil', label: 'Profil', icon: '🙂' },
];

export function NavLinks({ orientation }: { orientation: 'horizontal' | 'vertical' }) {
  const path = usePathname();
  const horizontal = orientation === 'horizontal';
  return (
    <ul className={horizontal ? 'grid grid-cols-4' : 'flex flex-col gap-1'}>
      {LINKS.map((l) => {
        const active = path === l.href || path.startsWith(`${l.href}/`);
        return (
          <li key={l.href}>
            <Link href={l.href} aria-current={active ? 'page' : undefined}
              className={horizontal
                ? `flex min-h-14 flex-col items-center justify-center text-xs ${active ? 'text-primary font-semibold' : 'text-muted'}`
                : `flex items-center gap-3 rounded-xl px-3 py-2 ${active ? 'bg-bg font-semibold text-primary' : 'text-text hover:bg-bg'}`}>
              <span aria-hidden className={horizontal ? 'text-lg' : ''}>{l.icon}</span>
              {l.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
