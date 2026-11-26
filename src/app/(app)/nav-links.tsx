'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

// Vékony vonalas ikonok (stroke = currentColor), emoji helyett az elegánsabb megjelenésért.
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
      strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
  );
}

const LINKS = [
  { href: '/ma', label: 'Ma', icon: <Icon><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Icon> },
  { href: '/listam', label: 'Listám', icon: <Icon><rect x="3.5" y="9" width="17" height="11.5" rx="1" /><path d="M2.5 9h19M12 9v11.5M12 9c-1.5-3-5-4-5.5-2S9 9 12 9zm0 0c1.5-3 5-4 5.5-2S15 9 12 9z" /></Icon> },
  { href: '/csoportok', label: 'Csoportok', icon: <Icon><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9.5" r="2.3" /><path d="M3 19.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M15.5 14.2c3 .1 5.5 1.9 5.5 5.3" /></Icon> },
  { href: '/profil', label: 'Profil', icon: <Icon><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5" /></Icon> },
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
                ? `flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] tracking-wide ${active ? 'text-primary font-semibold' : 'text-muted'}`
                : `flex items-center gap-3 rounded-lg border-l-2 px-3 py-2 transition ${active ? 'border-gold bg-surface font-semibold text-primary' : 'border-transparent text-text hover:bg-surface'}`}>
              {l.icon}
              {l.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
