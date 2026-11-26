/**
 * Cloudflare Worker belépési pont: a Next.js app (OpenNext) + napi időzített futás.
 * Az ütemezett esemény a saját /api/cron/napi végpontot hívja meg belsőleg.
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – a fájl buildeléskor jön létre
import { default as handler } from './.open-next/worker.js';
import { cronKey } from './src/lib/cron/key';

type Env = { SUPABASE_SERVICE_ROLE_KEY?: string; APP_URL?: string };
type Ctx = { waitUntil(p: Promise<unknown>): void };

const worker = {
  fetch: handler.fetch,
  async scheduled(_event: unknown, env: Env, ctx: Ctx) {
    if (!env.SUPABASE_SERVICE_ROLE_KEY) return;
    const url = `${env.APP_URL ?? 'https://ajandoki.prekopagerda-0.workers.dev'}/api/cron/napi`;
    const req = new Request(url, { method: 'POST', headers: { 'x-cron-key': await cronKey(env.SUPABASE_SERVICE_ROLE_KEY) } });
    ctx.waitUntil(handler.fetch(req, env, ctx));
  },
};

export default worker;
