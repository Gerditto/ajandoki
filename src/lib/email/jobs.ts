import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { todayInBudapest } from '@/lib/nameday';
import { buildDigests, type DigestEntry } from './digest';
import { appUrl, emailConfigured, sendEmail } from './send';
import { layout, plainText, type Line } from './templates';

type Admin = ReturnType<typeof createServiceClient>;

const FOOTER = 'Ezt a levelet a Súgj! app küldte. Az emlékeztetőket a Profil oldalon kapcsolhatod ki.';

async function emailsById(admin: Admin): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) break;
    for (const u of data.users) if (u.email) map.set(u.id, u.email);
    if (data.users.length < 1000) break;
  }
  return map;
}

/** Egyszeri küldés: csak akkor küld, ha ezzel a kulccsal még nem ment ki levél. */
async function claim(admin: Admin, key: string, profileId: string, kind: string): Promise<boolean> {
  const { data, error } = await admin
    .from('email_log')
    .upsert({ key, profile_id: profileId, kind }, { onConflict: 'key', ignoreDuplicates: true })
    .select('key');
  return !error && (data?.length ?? 0) > 0;
}

function entryLine(e: DigestEntry): Line {
  const base = appUrl();
  const href = e.drawId ? `${base}/sorsolas/${e.drawId}` : e.personId ? `${base}/szemely/${e.personId}` : `${base}/ma`;
  return { title: e.title, detail: e.detail, href };
}

/** Napi futás: lejáratja a régi foglalásokat, majd kiküldi az összesítő leveleket. */
export async function runDailyReminders(now = new Date()) {
  const admin = createServiceClient();
  const { data: expired } = await admin.rpc('expire_reservations');
  if (!emailConfigured()) return { expired, sent: 0, skipped: 'email_not_configured' };

  const today = todayInBudapest(now);
  const dateKey = today.toISOString().slice(0, 10);
  const [people, members, reservations, draws, parts] = await Promise.all([
    admin.from('profiles').select('id, display_name, birthday, nameday, email_reminders'),
    admin.from('group_members').select('group_id, profile_id'),
    admin.from('reservations').select('giver_id, recipient_id, expires_at, items(title)').eq('status', 'reserved').not('expires_at', 'is', null),
    admin.from('draws').select('id, name, event_date, budget_amount').eq('status', 'drawn').not('event_date', 'is', null),
    admin.from('draw_participants').select('draw_id, profile_id'),
  ]);

  const digests = buildDigests({
    today,
    people: (people.data ?? []).map((p) => ({ id: p.id, name: p.display_name, birthday: p.birthday, nameday: p.nameday, reminders: p.email_reminders })),
    memberships: members.data ?? [],
    reservations: (reservations.data ?? []).map((r) => ({
      giver_id: r.giver_id, recipient_id: r.recipient_id, expires_at: r.expires_at,
      item_title: (r.items as unknown as { title: string } | null)?.title ?? 'ajándék',
    })),
    draws: (draws.data ?? []).map((d) => ({
      id: d.id, name: d.name, event_date: d.event_date!, budget: d.budget_amount == null ? null : Number(d.budget_amount),
      participants: (parts.data ?? []).filter((x) => x.draw_id === d.id).map((x) => x.profile_id),
    })),
  });
  if (digests.size === 0) return { expired, sent: 0 };

  const emails = await emailsById(admin);
  let sent = 0;
  for (const [pid, entries] of digests) {
    const to = emails.get(pid);
    if (!to || !(await claim(admin, `digest:${pid}:${dateKey}`, pid, 'digest'))) continue;
    const content = {
      heading: entries.length === 1 ? entries[0].title : 'Közelgő alkalmak',
      intro: 'Egy kis emlékeztető, hogy semmi ne csússzon el:',
      lines: entries.map(entryLine),
      cta: { label: 'Megnyitom a Súgj! appot', href: `${appUrl()}/ma` },
      footer: FOOTER,
    };
    if (await sendEmail({ to, subject: content.heading, html: layout({ ...content, logoUrl: `${appUrl()}/brand/logo-email.png` }), text: plainText(content) })) sent++;
  }
  return { expired, sent };
}

/** A sorsolás után minden résztvevő kap egy értesítést. A levélben NEM szerepel, kit húzott. */
export async function notifyDrawDone(drawId: string) {
  if (!emailConfigured()) return;
  const admin = createServiceClient();
  const [{ data: draw }, { data: parts }] = await Promise.all([
    admin.from('draws').select('id, name, drawn_at, budget_amount, event_date').eq('id', drawId).maybeSingle(),
    admin.from('draw_participants').select('profile_id, profiles(email_reminders)').eq('draw_id', drawId),
  ]);
  if (!draw) return;
  const emails = await emailsById(admin);
  const href = `${appUrl()}/sorsolas/${draw.id}`;
  const details: string[] = [];
  if (draw.event_date) details.push(`Ajándékozás: ${new Intl.DateTimeFormat('hu-HU', { month: 'long', day: 'numeric' }).format(new Date(draw.event_date))}`);
  if (draw.budget_amount != null) details.push(`Értékhatár: ${new Intl.NumberFormat('hu-HU').format(Number(draw.budget_amount))} Ft`);
  await Promise.allSettled((parts ?? []).map(async (p) => {
    const wants = (p.profiles as unknown as { email_reminders: boolean } | null)?.email_reminders ?? true;
    const to = emails.get(p.profile_id);
    if (!wants || !to) return;
    if (!(await claim(admin, `draw:${draw.id}:${p.profile_id}:${draw.drawn_at}`, p.profile_id, 'draw'))) return;
    const content = {
      heading: `Megtörtént a sorsolás: ${draw.name}`,
      intro: 'Kihúztad, kinek készülsz ajándékkal. Nézd meg egyedül, hogy titok maradjon!',
      lines: details.map((d) => ({ title: d })),
      cta: { label: 'Megnézem, kit húztam', href },
      footer: FOOTER,
    };
    await sendEmail({ to, subject: content.heading, html: layout({ ...content, logoUrl: `${appUrl()}/brand/logo-email.png` }), text: plainText(content) });
  }));
}
