import { describe, expect, it } from 'vitest';
import { runDraw, checkFeasibility, type DrawInput } from './draw';

function seeded(seed: number) {
  // mulberry32 – determinisztikus véletlen a reprodukálható tesztekhez
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function assertValid(input: DrawInput, assignments: Map<string, string>) {
  const pools = new Map(input.participants.map((p) => [p.id, p.pool ?? 'main']));
  const blocked = new Set<string>();
  for (const [a, b] of input.exclusions ?? []) blocked.add(`${a}>${b}`);
  for (const [a, b] of input.previousPairs ?? []) blocked.add(`${a}>${b}`);
  for (const hh of input.households ?? []) for (const a of hh) for (const b of hh) if (a !== b) blocked.add(`${a}>${b}`);

  expect(assignments.size).toBe(input.participants.length);
  const received = new Set<string>();
  for (const [giver, receiver] of assignments) {
    expect(giver).not.toBe(receiver);
    expect(pools.get(giver)).toBe(pools.get(receiver));
    expect(blocked.has(`${giver}>${receiver}`)).toBe(false);
    if (input.forbidMutual) expect(assignments.get(receiver)).not.toBe(giver);
    expect(received.has(receiver)).toBe(false);
    received.add(receiver);
  }
}

const people = (n: number, pool?: string) =>
  Array.from({ length: n }, (_, i) => ({ id: `${pool ?? 'p'}${i}`, pool }));

describe('runDraw', () => {
  it('egyszerű csoport: mindenki pontosan egyszer ad és kap', () => {
    const input = { participants: people(6), random: seeded(1) };
    const r = runDraw(input);
    expect(r.ok).toBe(true);
    if (r.ok) assertValid(input, r.assignments);
  });

  it('háztartások és kölcsönös tiltás betartva', () => {
    const input: DrawInput = {
      participants: people(6),
      households: [['p0', 'p1'], ['p2', 'p3']],
      forbidMutual: true,
      random: seeded(2),
    };
    const r = runDraw(input);
    expect(r.ok).toBe(true);
    if (r.ok) assertValid(input, r.assignments);
  });

  it('gyerekek és felnőttek külön körben sorsolnak', () => {
    const input = { participants: [...people(4, 'kids'), ...people(5, 'adults')], random: seeded(3) };
    const r = runDraw(input);
    expect(r.ok).toBe(true);
    if (r.ok) assertValid(input, r.assignments);
  });

  it('2 fő kölcsönös tiltással nem sorsolható, érthető hibával', () => {
    const r = runDraw({ participants: people(2), forbidMutual: true });
    expect(r).toEqual({ ok: false, problems: [{ kind: 'mutual_unsatisfiable', pool: 'main' }] });
  });

  it('egyfős kör hibát ad', () => {
    const r = runDraw({ participants: [...people(3), { id: 'x', pool: 'kids' }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems).toContainEqual({ kind: 'too_few', pool: 'kids', count: 1 });
  });

  it('megnevezi, kinek nincs kit húznia', () => {
    const problems = checkFeasibility({
      participants: people(3),
      exclusions: [['p0', 'p1'], ['p0', 'p2']],
    });
    expect(problems).toContainEqual({ kind: 'no_options', pool: 'main', participantId: 'p0' });
  });

  it('felismeri a rejtett teljesíthetetlenséget (Hall-feltétel)', () => {
    // p0 és p1 csak p2-t húzhatja → nincs megoldás, bár mindenkinek van opciója
    const problems = checkFeasibility({
      participants: people(4),
      exclusions: [['p0', 'p1'], ['p0', 'p3'], ['p1', 'p0'], ['p1', 'p3']],
    });
    expect(problems).toEqual([{ kind: 'unsatisfiable', pool: 'main' }]);
  });

  it('10 000 véletlen konfiguráció: egy érvényes eredmény sem sérti a szabályokat', () => {
    const rnd = seeded(42);
    let solved = 0;
    for (let t = 0; t < 10_000; t++) {
      const n = 2 + Math.floor(rnd() * 12);
      const participants = people(n);
      const exclusions: Array<[string, string]> = [];
      const previousPairs: Array<[string, string]> = [];
      for (let k = 0; k < Math.floor(rnd() * n * 2); k++) {
        const a = `p${Math.floor(rnd() * n)}`;
        const b = `p${Math.floor(rnd() * n)}`;
        if (a !== b) (rnd() < 0.5 ? exclusions : previousPairs).push([a, b]);
      }
      const households = rnd() < 0.5 && n >= 4 ? [['p0', 'p1'], ['p2', 'p3']] : [];
      const input: DrawInput = {
        participants, exclusions, previousPairs, households,
        forbidMutual: rnd() < 0.5, random: seeded(t), maxSteps: 50_000,
      };
      const r = runDraw(input);
      if (r.ok) {
        assertValid(input, r.assignments);
        solved++;
      }
    }
    expect(solved).toBeGreaterThan(5000);
  });

  it('kis csoportoknál nem mond hamisan "nincs megoldás" (teljes kereséssel ellenőrizve)', () => {
    const rnd = seeded(7);
    for (let t = 0; t < 3000; t++) {
      const n = 2 + Math.floor(rnd() * 6);
      const exclusions: Array<[string, string]> = [];
      for (let k = 0; k < Math.floor(rnd() * n * 2); k++) {
        const a = `p${Math.floor(rnd() * n)}`;
        const b = `p${Math.floor(rnd() * n)}`;
        if (a !== b) exclusions.push([a, b]);
      }
      const forbidMutual = rnd() < 0.5;
      const r = runDraw({ participants: people(n), exclusions, forbidMutual, random: seeded(t) });
      expect(r.ok).toBe(bruteForceSolvable(n, exclusions, forbidMutual));
    }
  });

  it('nagy csoport (200 fő) gyorsan sorsolható', () => {
    const t0 = performance.now();
    const input = { participants: people(200), forbidMutual: true };
    const r = runDraw(input);
    expect(r.ok).toBe(true);
    if (r.ok) assertValid(input, r.assignments);
    expect(performance.now() - t0).toBeLessThan(5000);
  });
});

function bruteForceSolvable(n: number, exclusions: Array<[string, string]>, forbidMutual: boolean): boolean {
  const blocked = new Set(exclusions.map(([a, b]) => `${a}>${b}`));
  const perm: number[] = [];
  const used = new Array(n).fill(false);
  const rec = (i: number): boolean => {
    if (i === n) return true;
    for (let j = 0; j < n; j++) {
      if (used[j] || j === i || blocked.has(`p${i}>p${j}`)) continue;
      if (forbidMutual && j < i && perm[j] === i) continue;
      used[j] = true; perm[i] = j;
      if (rec(i + 1)) return true;
      used[j] = false;
    }
    return false;
  };
  return rec(0);
}
