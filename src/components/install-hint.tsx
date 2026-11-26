'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Button, Card } from '@/components/ui';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const noopSubscribe = () => () => {};

function detectEnv(): 'standalone' | 'ios' | 'other' {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true) return 'standalone';
  if (/iphone|ipad|ipod/i.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)) return 'ios';
  return 'other';
}

/** „Tedd ki a kezdőképernyőre” kártya. Telepített appban nem jelenik meg. */
export function InstallHint() {
  // Szerveren "telepített"-nek vesszük, így nem villan fel feleslegesen.
  const env = useSyncExternalStore(noopSubscribe, detectEnv, () => 'standalone');
  const standalone = env === 'standalone';
  const ios = env === 'ios';
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as InstallEvent); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (standalone) return null;
  return (
    <Card className="flex flex-col gap-2 border-gold/50">
      <p className="font-semibold">Tedd ki a telefonod kezdőképernyőjére</p>
      {deferred ? (
        <>
          <p className="text-sm text-muted">Így egy érintéssel nyílik, mint egy igazi app.</p>
          <Button type="button" onClick={async () => { await deferred.prompt(); setDeferred(null); }}>Telepítés</Button>
        </>
      ) : ios ? (
        <p className="text-sm text-muted">Safariban koppints lent a <strong>Megosztás</strong> gombra (négyzet felfelé nyíllal), majd válaszd a <strong>Főképernyőhöz adás</strong> lehetőséget.</p>
      ) : (
        <p className="text-sm text-muted">Androidon Chrome-ban nyisd meg a jobb felső <strong>⋮</strong> menüt, és válaszd a <strong>Telepítés</strong> vagy <strong>Hozzáadás a kezdőképernyőhöz</strong> lehetőséget.</p>
      )}
    </Card>
  );
}
