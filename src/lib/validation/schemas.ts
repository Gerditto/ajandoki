import { z } from 'zod';

const optionalText = (max: number) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().trim().max(max).optional());

const optionalUrl = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().trim().url('Érvénytelen link').regex(/^https?:\/\//i, 'Csak http(s) link adható meg').max(2000).optional(),
);

const optionalMoney = z.preprocess(
  (v) => (v === '' || v == null ? undefined : Number(String(v).replace(/\s/g, '').replace(',', '.'))),
  z.number({ message: 'Számot adj meg' }).min(0).max(100_000_000).optional(),
);

export const emailSchema = z.object({
  email: z.string().trim().toLowerCase().email('Érvénytelen e-mail-cím'),
});

export const profileSchema = z.object({
  display_name: z.string().trim().min(1, 'Add meg a neved').max(80),
  birthday: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Érvénytelen dátum').optional(),
  ),
  nameday: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'Formátum: HH-NN, pl. 03-15').optional(),
  ),
});

export const itemSchema = z
  .object({
    title: z.string().trim().min(1, 'Adj címet a kívánságnak').max(200),
    url: optionalUrl,
    image_url: optionalUrl,
    price_min: optionalMoney,
    price_max: optionalMoney,
    priority: z.coerce.number().int().min(1).max(3).default(2),
    category: optionalText(60),
    size: optionalText(40),
    color: optionalText(40),
    occasion: optionalText(60),
    substitutable: z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean()),
    description: optionalText(2000),
  })
  .refine((d) => d.price_min == null || d.price_max == null || d.price_min <= d.price_max, {
    message: 'Az alsó ár nem lehet nagyobb a felsőnél',
    path: ['price_max'],
  });

export type ItemInput = z.infer<typeof itemSchema>;

/** FormData → sima objektum (a checkbox hiánya = false). */
export function formToObject(fd: FormData): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  fd.forEach((v, k) => {
    if (!k.startsWith('$')) o[k] = v;
  });
  return o;
}

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '_');
    out[key] ??= issue.message;
  }
  return out;
}
