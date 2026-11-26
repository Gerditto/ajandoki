/**
 * Napi emlékeztető összeállítása (tiszta függvény, a szerver adja az adatokat).
 * Titkossági szabály: egy ember soha nem kap emailt a saját ajándékairól vagy
 * a róla szóló foglalásokról; foglalásról csak a foglaló kap emlékeztetőt.
 */
import { formatMonthDay, nextOccurrence } from '../nameday';

export type Person = { id: string; name: string; birthday: string | null; nameday: string | null; reminders: boolean };
export type Membership = { group_id: string; profile_id: string };
export type ActiveReservation = { giver_id: string; recipient_id: string; item_title: string; expires_at: string | null };
export type UpcomingDraw = { id: string; name: string; event_date: string; budget: number | null; participants: string[] };

export type DigestEntry = { kind: 'birthday' | 'nameday' | 'expiring' | 'draw'; title: string; detail: string; personId?: string; drawId?: string };

const BIRTHDAY_DAYS = new Set([7, 1]);
const NAMEDAY_DAYS = new Set([1]);
const DRAW_DAYS = new Set([7, 1]);

const whenText = (d: number) => (d === 0 ? 'ma' : d === 1 ? 'holnap' : `${d} nap múlva`);

export function buildDigests(input: {
  today: Date;
  people: Person[];
  memberships: Membership[];
  reservations: ActiveReservation[];
  draws: UpcomingDraw[];
}): Map<string, DigestEntry[]> {
  const { today } = input;
  const byId = new Map(input.people.map((p) => [p.id, p]));
  const groupsOf = new Map<string, Set<string>>();
  for (const m of input.memberships) {
    if (!groupsOf.has(m.profile_id)) groupsOf.set(m.profile_id, new Set());
    groupsOf.get(m.profile_id)!.add(m.group_id);
  }
  const membersOf = new Map<string, string[]>();
  for (const m of input.memberships) membersOf.set(m.group_id, [...(membersOf.get(m.group_id) ?? []), m.profile_id]);

  const out = new Map<string, DigestEntry[]>();
  const push = (pid: string, e: DigestEntry) => {
    if (!byId.get(pid)?.reminders) return;
    out.set(pid, [...(out.get(pid) ?? []), e]);
  };

  // Alkalmak: akinek közelgő születés- vagy névnapja van, azt a csoporttársai kapják meg.
  for (const p of input.people) {
    const events: DigestEntry[] = [];
    if (p.birthday) {
      const mmdd = p.birthday.slice(5, 10);
      const { days } = nextOccurrence(mmdd, today);
      if (BIRTHDAY_DAYS.has(days)) {
        events.push({ kind: 'birthday', personId: p.id, title: `${p.name} születésnapja ${whenText(days)}`, detail: formatMonthDay(mmdd) });
      }
    }
    if (p.nameday) {
      const { days } = nextOccurrence(p.nameday, today);
      if (NAMEDAY_DAYS.has(days)) {
        events.push({ kind: 'nameday', personId: p.id, title: `${p.name} névnapja ${whenText(days)}`, detail: formatMonthDay(p.nameday) });
      }
    }
    if (!events.length) continue;
    const mates = new Set<string>();
    for (const g of groupsOf.get(p.id) ?? []) for (const other of membersOf.get(g) ?? []) if (other !== p.id) mates.add(other);
    for (const mate of mates) for (const e of events) push(mate, e);
  }

  // Lejáró foglalások: csak a foglaló kapja.
  const now = today.getTime();
  for (const r of input.reservations) {
    if (!r.expires_at) continue;
    const left = new Date(r.expires_at).getTime() - now;
    if (left > 0 && left <= 2 * 86_400_000) {
      const name = byId.get(r.recipient_id)?.name ?? 'valaki';
      push(r.giver_id, { kind: 'expiring', personId: r.recipient_id, title: `Hamarosan lejár a foglalásod: ${r.item_title}`, detail: `${name} részére. Ha megvetted, jelöld meg, különben felszabadul.` });
    }
  }

  // Titkos Mikulás: közeleg az ajándékozás napja.
  for (const d of input.draws) {
    const { days } = nextOccurrence(d.event_date.slice(5, 10), today);
    const sameYear = d.event_date.slice(0, 4) === new Date(today.getTime() + days * 86_400_000).toISOString().slice(0, 4);
    if (!DRAW_DAYS.has(days) || !sameYear) continue;
    const budget = d.budget != null ? ` · értékhatár ${new Intl.NumberFormat('hu-HU').format(d.budget)} Ft` : '';
    for (const pid of d.participants) {
      push(pid, { kind: 'draw', drawId: d.id, title: `${d.name}: ${whenText(days)} az ajándékozás`, detail: `Titkos Mikulás${budget}` });
    }
  }
  return out;
}
