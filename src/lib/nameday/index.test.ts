import { describe, expect, it } from 'vitest';
import { formatMonthDay, namedaysOf, namesOn, nextOccurrence, searchNames, todayInBudapest } from './index';

describe('névnapok', () => {
  it('ismert napok', () => {
    expect(namesOn('12-24')).toContain('Ádám');
    expect(namesOn('05-08')).toContain('Mihály');
    expect(namesOn('05-31')).toContain('Angéla');
    expect(namesOn('07-26')).toContain('Anna');
  });
  it('név alapján, ékezet nélkül is', () => {
    expect(namedaysOf('Nimród')).toContain('08-01');
    expect(namedaysOf('nimrod kovacs')).toContain('08-01');
    expect(namedaysOf('Xyzw')).toEqual([]);
  });
  it('kereső', () => {
    const r = searchNames('Erzs');
    expect(r[0].name).toBe('Erzsébet');
    expect(r[0].days).toContain('11-19');
    expect(searchNames('E')).toEqual([]);
  });
  it('minden nap megvan', () => {
    let n = 0;
    for (let m = 1; m <= 12; m++) for (let d = 1; d <= new Date(Date.UTC(2025, m, 0)).getUTCDate(); d++) {
      expect(namesOn(`${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`).length).toBeGreaterThan(0);
      n++;
    }
    expect(n).toBe(365);
  });
  it('formázás és következő alkalom', () => {
    expect(formatMonthDay('07-26')).toBe('július 26.');
    const t = new Date('2026-11-26T00:00:00Z');
    expect(nextOccurrence('11-26', t).days).toBe(0);
    expect(nextOccurrence('12-24', t).days).toBe(28);
    expect(nextOccurrence('01-01', t).date.toISOString().slice(0, 10)).toBe('2027-01-01');
    expect(nextOccurrence('02-29', new Date('2027-02-01T00:00:00Z')).date.toISOString().slice(0, 10)).toBe('2027-02-28');
  });
  it('budapesti dátum', () => {
    expect(todayInBudapest(new Date('2026-11-26T23:30:00Z')).toISOString().slice(0, 10)).toBe('2026-11-27');
  });
});
