/**
 * Secret Santa sorsoló.
 *
 * Szabályok:
 *  - senki nem húzhatja önmagát;
 *  - egyirányú kizárások (`exclusions`), a kölcsönös kizárás két egyirányú sor;
 *  - azonos háztartás tagjai nem húzhatják egymást (`households`);
 *  - a korábbi sorsolás párjai nem ismétlődnek (`previousPairs`);
 *  - opcionálisan tilos a kölcsönös húzás (A→B és B→A);
 *  - a résztvevők sorsolókörökre (`pool`) bonthatók, pl. gyerekek és felnőttek külön.
 *
 * Működés: körönként előbb párosítási algoritmussal (Kuhn-féle javító utak) ellenőrzi,
 * hogy létezik-e megoldás, majd véletlen sorrendű visszalépéses kereséssel sorsol.
 * Minden lépés után újra ellenőrzi, hogy a maradék még teljesíthető-e, így a
 * keresés nem fut zsákutcákba. A kölcsönös tiltást a párosítás nem fedi le,
 * ezért arra lépésszám-korlát van.
 *
 * Az eredményt kizárólag a szerver kezeli: a draw_assignments táblába kerül,
 * ahol mindenki csak a saját sorát láthatja.
 */

export type Participant = { id: string; pool?: string };

export type DrawInput = {
  participants: Participant[];
  /** [ki, kit nem húzhat] párok (egyirányú). */
  exclusions?: Array<[string, string]>;
  /** Háztartások: egy tömbön belül senki nem húzhatja a másikat. */
  households?: string[][];
  /** Korábbi párosítások [húzó, húzott], ezek nem ismétlődhetnek. */
  previousPairs?: Array<[string, string]>;
  forbidMutual?: boolean;
  /** Tesztelhetőséghez cserélhető véletlenforrás (0 ≤ x < 1). */
  random?: () => number;
  /** Visszalépéses lépések felső korlátja körönként. */
  maxSteps?: number;
};

export type DrawProblem =
  | { kind: 'too_few'; pool: string; count: number }
  | { kind: 'no_options'; pool: string; participantId: string }
  | { kind: 'no_receiver'; pool: string; participantId: string }
  | { kind: 'unsatisfiable'; pool: string }
  | { kind: 'mutual_unsatisfiable'; pool: string };

export type DrawResult =
  | { ok: true; assignments: Map<string, string> }
  | { ok: false; problems: DrawProblem[] };

/** Megnézi, hogy a szabályok mellett létezik-e érvényes sorsolás, és miért nem. */
export function checkFeasibility(input: DrawInput): DrawProblem[] {
  const res = runDraw({ ...input, maxSteps: input.maxSteps ?? 20_000 });
  return res.ok ? [] : res.problems;
}

export function runDraw(input: DrawInput): DrawResult {
  const random = input.random ?? cryptoRandom;
  const maxSteps = input.maxSteps ?? 200_000;
  const forbidMutual = input.forbidMutual ?? false;

  const ids = input.participants.map((p) => p.id);
  if (new Set(ids).size !== ids.length) throw new Error('duplicate_participant');

  const blocked = new Set<string>();
  const key = (a: string, b: string) => `${a}\u0000${b}`;
  for (const [a, b] of input.exclusions ?? []) blocked.add(key(a, b));
  for (const [a, b] of input.previousPairs ?? []) blocked.add(key(a, b));
  for (const hh of input.households ?? []) {
    for (const a of hh) for (const b of hh) if (a !== b) blocked.add(key(a, b));
  }

  const pools = new Map<string, string[]>();
  for (const p of input.participants) {
    const pool = p.pool ?? 'main';
    if (!pools.has(pool)) pools.set(pool, []);
    pools.get(pool)!.push(p.id);
  }

  const assignments = new Map<string, string>();
  const problems: DrawProblem[] = [];

  for (const [pool, members] of pools) {
    const n = members.length;
    if (n < 2) {
      problems.push({ kind: 'too_few', pool, count: n });
      continue;
    }
    // allowed[i] = j indexek, akiket i húzhat
    const allowed: number[][] = members.map((a, i) =>
      members.flatMap((b, j) => (i !== j && !blocked.has(key(a, b)) ? [j] : [])),
    );

    const localProblems: DrawProblem[] = [];
    allowed.forEach((opts, i) => {
      if (opts.length === 0) localProblems.push({ kind: 'no_options', pool, participantId: members[i] });
    });
    const canBeDrawn = new Array(n).fill(false);
    allowed.forEach((opts) => opts.forEach((j) => (canBeDrawn[j] = true)));
    canBeDrawn.forEach((ok, j) => {
      if (!ok) localProblems.push({ kind: 'no_receiver', pool, participantId: members[j] });
    });
    if (localProblems.length) {
      problems.push(...localProblems);
      continue;
    }
    if (!hasPerfectMatching(allowed, n, new Array(n).fill(-1), new Array(n).fill(false))) {
      problems.push({ kind: 'unsatisfiable', pool });
      continue;
    }

    const result = search(allowed, n, forbidMutual, random, maxSteps);
    if (!result) {
      problems.push({ kind: forbidMutual ? 'mutual_unsatisfiable' : 'unsatisfiable', pool });
      continue;
    }
    result.forEach((j, i) => assignments.set(members[i], members[j]));
  }

  return problems.length ? { ok: false, problems } : { ok: true, assignments };
}

/** Véletlen sorrendű visszalépéses keresés, párosítás-alapú metszéssel. */
function search(
  allowed: number[][],
  n: number,
  forbidMutual: boolean,
  random: () => number,
  maxSteps: number,
): number[] | null {
  const giverOf = new Array<number>(n).fill(-1); // húzott → húzó
  const receiverOf = new Array<number>(n).fill(-1); // húzó → húzott
  const done = new Array<boolean>(n).fill(false);
  // Véletlen sorrend; döntetlennél a kevesebb opciójú húzó előbb.
  const order = shuffle([...Array(n).keys()], random).sort((a, b) => allowed[a].length - allowed[b].length);
  let steps = 0;

  const rec = (k: number): boolean => {
    if (k === n) return true;
    if (++steps > maxSteps) return false;
    const i = order[k];
    for (const j of shuffle([...allowed[i]], random)) {
      if (giverOf[j] !== -1) continue;
      if (forbidMutual && receiverOf[j] === i) continue;
      receiverOf[i] = j;
      giverOf[j] = i;
      done[i] = true;
      if (hasPerfectMatching(allowed, n, giverOf, done) && rec(k + 1)) return true;
      receiverOf[i] = -1;
      giverOf[j] = -1;
      done[i] = false;
      if (steps > maxSteps) return false;
    }
    return false;
  };

  return rec(0) ? receiverOf : null;
}

/**
 * Van-e teljes párosítás a még be nem osztott húzók és a még szabad húzottak között?
 * (Kuhn-algoritmus; a résztvevőszám kicsi, néhány száz főig gyors.)
 */
function hasPerfectMatching(
  allowed: number[][],
  n: number,
  fixedGiverOf: number[],
  fixedDone: boolean[],
): boolean {
  const match = [...fixedGiverOf];
  for (let i = 0; i < n; i++) {
    if (fixedDone[i]) continue;
    const seen = new Array<boolean>(n).fill(false);
    if (!augment(i, allowed, match, seen, fixedGiverOf)) return false;
  }
  return true;
}

function augment(i: number, allowed: number[][], match: number[], seen: boolean[], fixed: number[]): boolean {
  for (const j of allowed[i]) {
    if (seen[j] || fixed[j] !== -1) continue;
    seen[j] = true;
    if (match[j] === -1 || augment(match[j], allowed, match, seen, fixed)) {
      match[j] = i;
      return true;
    }
  }
  return false;
}

function shuffle<T>(arr: T[], random: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function cryptoRandom(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
}
