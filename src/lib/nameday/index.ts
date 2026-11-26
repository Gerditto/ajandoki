/**
 * Magyar névnapnaptár és dátumsegédek.
 * Adatforrás: a „nevnap” npm-csomag (MIT licenc, © David Uri), javítva
 * (május 8–31. eltolódás, július 26.).
 */
import data from './hu.json';

const NAMEDAYS = data as Record<string, string[]>;

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

/** Egy adott nap (HH-NN) névnapjai. */
export function namesOn(mmdd: string): string[] {
  return NAMEDAYS[mmdd] ?? [];
}

/** Egy név névnapjai (HH-NN), ékezet- és kisbetű-függetlenül. A teljes névből az első szót nézi. */
export function namedaysOf(name: string): string[] {
  const first = fold(name.split(/\s+/)[0] ?? '');
  if (!first) return [];
  return Object.keys(NAMEDAYS).filter((k) => NAMEDAYS[k].some((n) => fold(n) === first));
}

/** Névkereső: azok a nevek, amelyek a megadott szöveggel kezdődnek, a napjaikkal. */
export function searchNames(prefix: string, limit = 8): { name: string; days: string[] }[] {
  const p = fold(prefix);
  if (p.length < 2) return [];
  const map = new Map<string, string[]>();
  for (const [day, names] of Object.entries(NAMEDAYS)) {
    for (const n of names) if (fold(n).startsWith(p)) map.set(n, [...(map.get(n) ?? []), day]);
  }
  return [...map].sort((a, b) => a[0].localeCompare(b[0], 'hu')).slice(0, limit).map(([name, days]) => ({ name, days }));
}

const MONTHS = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];

/** „07-26” → „július 26.” */
export function formatMonthDay(mmdd: string): string {
  const [m, d] = mmdd.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}.`;
}

/** Egy évenként ismétlődő nap (HH-NN) következő előfordulása `today`-től (aznap is számít). */
export function nextOccurrence(mmdd: string, today: Date): { date: Date; days: number } {
  const [m, d] = mmdd.split('-').map(Number);
  const base = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const make = (y: number) => {
    // Február 29. nem szökőévben: február 28.
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    return Date.UTC(y, m - 1, m === 2 && d === 29 && !leap ? 28 : d);
  };
  let t = make(today.getUTCFullYear());
  if (t < base) t = make(today.getUTCFullYear() + 1);
  return { date: new Date(t), days: Math.round((t - base) / 86_400_000) };
}

/** Budapesti „ma” éjfélkor, UTC dátumként (a szerver UTC-ben fut). */
export function todayInBudapest(now = new Date()): Date {
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return new Date(`${s}T00:00:00Z`);
}
