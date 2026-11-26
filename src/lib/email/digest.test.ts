import { describe, expect, it } from 'vitest';
import { buildDigests, type Person } from './digest';

const today = new Date('2026-11-26T00:00:00Z');
const p = (id: string, extra: Partial<Person> = {}): Person => ({ id, name: id.toUpperCase(), birthday: null, nameday: null, reminders: true, ...extra });

describe('napi emlékeztető', () => {
  const memberships = [
    { group_id: 'g1', profile_id: 'anna' }, { group_id: 'g1', profile_id: 'bela' },
    { group_id: 'g2', profile_id: 'anna' }, { group_id: 'g2', profile_id: 'csilla' },
    { group_id: 'g3', profile_id: 'dani' },
  ];

  it('születésnap 7 nappal előtte a csoporttársaknak, az ünnepeltnek nem', () => {
    const d = buildDigests({ today, memberships, reservations: [], draws: [],
      people: [p('anna', { birthday: '1990-12-03' }), p('bela'), p('csilla'), p('dani')] });
    expect(d.get('bela')?.[0].title).toBe('ANNA születésnapja 7 nap múlva');
    expect(d.get('csilla')).toHaveLength(1);
    expect(d.has('anna')).toBe(false);
    expect(d.has('dani')).toBe(false);
  });

  it('névnap előtte nap; leiratkozott nem kap', () => {
    const d = buildDigests({ today, memberships, reservations: [], draws: [],
      people: [p('anna', { nameday: '11-27' }), p('bela', { reminders: false }), p('csilla'), p('dani')] });
    expect(d.has('bela')).toBe(false);
    expect(d.get('csilla')?.[0].kind).toBe('nameday');
  });

  it('lejáró foglalás csak a foglalónak', () => {
    const d = buildDigests({ today, memberships, draws: [], people: [p('anna'), p('bela'), p('csilla'), p('dani')],
      reservations: [
        { giver_id: 'bela', recipient_id: 'anna', item_title: 'Bögre', expires_at: '2026-11-27T10:00:00Z' },
        { giver_id: 'csilla', recipient_id: 'anna', item_title: 'Könyv', expires_at: '2026-12-20T10:00:00Z' },
      ] });
    expect(d.get('bela')?.[0].kind).toBe('expiring');
    expect(d.has('anna')).toBe(false);
    expect(d.has('csilla')).toBe(false);
  });

  it('sorsolás ajándékozási napja előtt egy héttel, csak az idei', () => {
    const people = [p('anna'), p('bela'), p('csilla'), p('dani')];
    const d = buildDigests({ today, memberships, reservations: [], people,
      draws: [{ id: 'd1', name: 'Karácsony', event_date: '2026-12-03', budget: 5000, participants: ['anna', 'bela'] },
              { id: 'd2', name: 'Régi', event_date: '2025-12-03', budget: null, participants: ['csilla'] }] });
    expect(d.get('anna')?.[0].detail).toContain('5');
    expect(d.has('csilla')).toBe(false);
  });
});
