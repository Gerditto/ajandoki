import { describe, expect, it } from 'vitest';
import { itemSchema, profileSchema } from './schemas';

describe('itemSchema', () => {
  it('üres opcionális mezőket elhagy, magyar számformátumot elfogad', () => {
    const r = itemSchema.parse({ title: ' Bögre ', url: '', price_max: '12 990', substitutable: 'on' });
    expect(r).toMatchObject({ title: 'Bögre', price_max: 12990, substitutable: true, priority: 2 });
    expect(r.url).toBeUndefined();
  });
  it('javascript: linket elutasít', () => {
    expect(itemSchema.safeParse({ title: 'x', url: 'javascript:alert(1)' }).success).toBe(false);
  });
  it('fordított ársávot elutasít', () => {
    const r = itemSchema.safeParse({ title: 'x', price_min: '5000', price_max: '1000' });
    expect(r.success).toBe(false);
  });
});

describe('profileSchema', () => {
  it('névnapot HH-NN formában vár', () => {
    expect(profileSchema.safeParse({ display_name: 'Anna', nameday: '07-26' }).success).toBe(true);
    expect(profileSchema.safeParse({ display_name: 'Anna', nameday: '26-07' }).success).toBe(false);
  });
});
