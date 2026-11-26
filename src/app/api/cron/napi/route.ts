import { cronKey } from '@/lib/cron/key';
import { runDailyReminders } from '@/lib/email/jobs';

/** Napi időzített futás. Csak a Cloudflare ütemező hívja (lásd custom-worker.ts). */
export async function POST(request: Request) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const given = request.headers.get('x-cron-key') ?? '';
  if (!serviceKey || given.length !== 64 || given !== (await cronKey(serviceKey))) {
    return new Response('Not found', { status: 404 });
  }
  const result = await runDailyReminders();
  console.log('daily_job', JSON.stringify(result));
  return Response.json(result);
}
