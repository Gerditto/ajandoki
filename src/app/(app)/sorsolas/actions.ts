'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { checkFeasibility, runDraw, type DrawProblem } from '@/lib/draw/draw';
import { fieldErrors } from '@/lib/validation/schemas';
import { notifyDrawDone } from '@/lib/email/jobs';

export type DrawFormState = { errors?: Record<string, string> };

const drawSchema = z.object({
  group_id: z.uuid(),
  name: z.string().trim().min(1, 'Adj nevet a sorsolásnak').max(120),
  event_date: z.union([z.literal(''), z.iso.date()]).optional(),
  budget: z.string().trim().optional(),
  forbid_mutual: z.boolean(),
  exclude_previous_draw: z.union([z.literal(''), z.uuid()]).optional(),
  participants: z.array(z.uuid()).min(3, 'Legalább 3 résztvevő kell'),
});

function parseBudget(raw?: string): number | null | 'invalid' {
  if (!raw) return null;
  const n = Number(raw.replace(/\s|ft|huf/gi, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 'invalid';
}

export async function createDraw(_prev: DrawFormState, formData: FormData): Promise<DrawFormState> {
  const parsed = drawSchema.safeParse({
    group_id: formData.get('group_id'),
    name: formData.get('name'),
    event_date: formData.get('event_date') ?? '',
    budget: formData.get('budget') ?? '',
    forbid_mutual: formData.get('forbid_mutual') === 'on',
    exclude_previous_draw: formData.get('exclude_previous_draw') ?? '',
    participants: formData.getAll('participants'),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const budget = parseBudget(parsed.data.budget);
  if (budget === 'invalid') return { errors: { budget: 'Számot adj meg, pl. 5000' } };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/belepes');

  const { data: draw, error } = await supabase
    .from('draws')
    .insert({
      group_id: parsed.data.group_id,
      name: parsed.data.name,
      event_date: parsed.data.event_date || null,
      budget_amount: budget,
      forbid_mutual: parsed.data.forbid_mutual,
      exclude_previous_draw: parsed.data.exclude_previous_draw || null,
      created_by: auth.user.id,
    })
    .select('id')
    .single();
  if (error || !draw) return { errors: { _: 'Nem sikerült létrehozni a sorsolást.' } };

  const { error: pErr } = await supabase
    .from('draw_participants')
    .insert(parsed.data.participants.map((profile_id) => ({ draw_id: draw.id, profile_id })));
  if (pErr) {
    await supabase.from('draws').delete().eq('id', draw.id);
    return { errors: { _: 'Csak a csoport tagjai vehetnek részt a sorsoláson.' } };
  }
  revalidatePath(`/csoportok/${parsed.data.group_id}`);
  redirect(`/sorsolas/${draw.id}`);
}

const PROBLEM_TEXT: Record<DrawProblem['kind'], string> = {
  too_few: 'Legalább 3 résztvevő kell a sorsoláshoz.',
  no_options: 'Valakinek a kizárások miatt senki nem maradt, akit húzhatna.',
  no_receiver: 'Valakit a kizárások miatt senki nem húzhatna.',
  unsatisfiable: 'Ezekkel a kizárásokkal nem lehet mindenkinek párt találni. Törölj egy kizárást.',
  mutual_unsatisfiable: 'Kölcsönös húzás tiltásával nem jön ki. Kapcsold ki ezt a szabályt, vagy törölj egy kizárást.',
};

function back(drawId: string, error?: string): never {
  redirect(`/sorsolas/${drawId}${error ? `?hiba=${encodeURIComponent(error)}` : ''}`);
}

/** A szervező által látható adatokból (résztvevők, kizárások) összeállított sorsolási feladat. */
async function loadOrganizerInput(drawId: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/belepes');
  const { data: draw } = await supabase
    .from('draws')
    .select('id, group_id, status, created_by, forbid_mutual, exclude_households, exclude_previous_draw')
    .eq('id', drawId)
    .maybeSingle();
  if (!draw || draw.created_by !== auth.user.id) back(drawId, 'Ezt csak a sorsolás szervezője teheti meg.');
  const [{ data: parts }, { data: excl }] = await Promise.all([
    supabase.from('draw_participants').select('profile_id, pool').eq('draw_id', drawId),
    supabase.from('draw_exclusions').select('giver_id, receiver_id').eq('draw_id', drawId),
  ]);
  return {
    supabase,
    draw,
    participants: (parts ?? []).map((p) => ({ id: p.profile_id, pool: p.pool })),
    exclusions: (excl ?? []).map((e) => [e.giver_id, e.receiver_id] as [string, string]),
  };
}

export async function addExclusion(formData: FormData) {
  const drawId = String(formData.get('draw_id'));
  const a = String(formData.get('a'));
  const b = String(formData.get('b'));
  const mutual = formData.get('mutual') === 'on';
  if (!a || !b || a === b) back(drawId, 'Válassz két különböző résztvevőt.');
  const { supabase, draw, participants, exclusions } = await loadOrganizerInput(drawId);
  if (draw.status !== 'draft') back(drawId, 'A sorsolás után már nem módosítható.');

  const rows = [[a, b], ...(mutual ? [[b, a]] : [])] as [string, string][];
  const problems = checkFeasibility({ participants, exclusions: [...exclusions, ...rows], forbidMutual: draw.forbid_mutual });
  if (problems.length) back(drawId, `Ezt a kizárást nem vettem fel: ${PROBLEM_TEXT[problems[0].kind]}`);

  await supabase.from('draw_exclusions').upsert(
    rows.map(([giver_id, receiver_id]) => ({ draw_id: drawId, giver_id, receiver_id })),
    { ignoreDuplicates: true },
  );
  revalidatePath(`/sorsolas/${drawId}`);
  back(drawId);
}

export async function removeExclusion(formData: FormData) {
  const drawId = String(formData.get('draw_id'));
  const giver = String(formData.get('giver'));
  const receiver = String(formData.get('receiver'));
  const supabase = await createClient();
  await supabase.from('draw_exclusions').delete().eq('draw_id', drawId).eq('giver_id', giver).eq('receiver_id', receiver);
  if (formData.get('both') === '1') {
    await supabase.from('draw_exclusions').delete().eq('draw_id', drawId).eq('giver_id', receiver).eq('receiver_id', giver);
  }
  revalidatePath(`/sorsolas/${drawId}`);
  back(drawId);
}

/**
 * A sorsolás a szerveren fut. Az eredményt a service role írja be egy tranzakcióban
 * (commit_draw), a szervezőnek pedig nem adunk vissza belőle semmit.
 */
export async function performDraw(formData: FormData) {
  const drawId = String(formData.get('draw_id'));
  const { draw, participants, exclusions } = await loadOrganizerInput(drawId);
  if (draw.status !== 'draft') back(drawId);

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    back(drawId, 'A sorsoló még nincs bekapcsolva a szerveren (hiányzik a titkos kulcs).');
  }

  const ids = participants.map((p) => p.id);
  let households: string[][] = [];
  if (draw.exclude_households) {
    const { data } = await admin
      .from('household_members')
      .select('household_id, profile_id, households!inner(group_id)')
      .eq('households.group_id', draw.group_id)
      .in('profile_id', ids);
    const byHh = new Map<string, string[]>();
    for (const r of data ?? []) byHh.set(r.household_id, [...(byHh.get(r.household_id) ?? []), r.profile_id]);
    households = [...byHh.values()];
  }
  let previousPairs: [string, string][] = [];
  if (draw.exclude_previous_draw) {
    const { data } = await admin.from('draw_assignments').select('giver_id, receiver_id').eq('draw_id', draw.exclude_previous_draw);
    previousPairs = (data ?? []).map((r) => [r.giver_id, r.receiver_id]);
  }

  const result = runDraw({ participants, exclusions, households, previousPairs, forbidMutual: draw.forbid_mutual });
  if (!result.ok) back(drawId, PROBLEM_TEXT[result.problems[0].kind]);

  const pairs = [...result.assignments].map(([giver, receiver]) => ({ giver, receiver }));
  const { error } = await admin.rpc('commit_draw', { p_draw: drawId, p_pairs: pairs });
  if (error) back(drawId, 'A sorsolás nem sikerült, próbáld újra.');
  await notifyDrawDone(drawId).catch((e) => console.error('draw_notify_failed', e));
  revalidatePath(`/sorsolas/${drawId}`);
  back(drawId);
}

export async function resetDraw(formData: FormData) {
  const drawId = String(formData.get('draw_id'));
  const supabase = await createClient();
  const { data } = await supabase.rpc('reset_draw', { p_draw: drawId });
  if (!data) back(drawId, 'Ezt csak a sorsolás szervezője teheti meg.');
  revalidatePath(`/sorsolas/${drawId}`);
  back(drawId);
}

export async function deleteDraw(formData: FormData) {
  const drawId = String(formData.get('draw_id'));
  const groupId = String(formData.get('group_id'));
  const supabase = await createClient();
  await supabase.from('draws').delete().eq('id', drawId);
  revalidatePath(`/csoportok/${groupId}`);
  redirect(`/csoportok/${groupId}`);
}
