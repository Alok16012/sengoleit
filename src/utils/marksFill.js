// Semester marks calculator — the logic behind the Result modal's Fill button.
//
// Given every paper's maximum internal and external marks and one overall
// percentage, it produces integer obtained marks for each paper such that:
//
//   • the semester totals exactly that percentage, or the nearest total that
//     whole-number marks can reach                                  (rule 1)
//   • no component falls under 40% of its maximum or exceeds it   (rules 4-7)
//   • when the percentage asked for is 63%-70%, no paper totals more than
//     73% of its maximum — 73 for a paper out of 100               (rule 12)
//   • paper totals differ from one another wherever that is possible, and
//     each press gives a different set from the one before  (rules 2, 11, 13)
//   • an exact overall figure always wins over distinct totals      (rule 14)
//
// Pure: no React, no database — so it can be exercised on its own.

export const FILL_RULES = {
  minShare: 0.40,   // a component is never below 40% of its own maximum
  capFrom: 63,      // when the overall asked for is between these two...
  capTo: 70,
  capShare: 0.73,   // ...no paper may total more than 73% of its maximum
  spread: 6,        // how many points either side of the target a paper may start
}

const toMax = (v) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

// A paper's own limits: each component's lowest and highest mark, and the
// range its total may take once the rule-12 ceiling is applied.
function limitsOf(paper, capOn) {
  const maxI = toMax(paper.maxI), maxT = toMax(paper.maxT)
  const loI = maxI ? Math.ceil(maxI * FILL_RULES.minShare) : 0
  const loT = maxT ? Math.ceil(maxT * FILL_RULES.minShare) : 0
  const max = maxI + maxT
  const lo = loI + loT
  let hi = maxI + maxT
  // Never let the ceiling fall under the floor — a paper must still be able
  // to pass, whatever the percentage asked for.
  if (capOn) hi = Math.max(lo, Math.min(hi, Math.floor(max * FILL_RULES.capShare)))
  return { key: paper.key, maxI, maxT, loI, loT, max, lo, hi }
}

const pairsEqual = (totals) => {
  let n = 0
  for (let a = 0; a < totals.length; a++)
    for (let b = a + 1; b < totals.length; b++)
      if (totals[a] === totals[b]) n++
  return n
}

// One attempt at a full set. Always meets the target exactly (the target
// passed in is already inside what the papers can reach); distinct totals are
// best effort.
function attempt(lims, target, pct, rng) {
  const randInt = (lo, hi) => (hi <= lo ? lo : lo + Math.floor(rng() * (hi - lo + 1)))
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi)

  // 1. Each paper starts near the percentage asked for, a few points off in
  //    either direction, so no two begin in lock-step.
  const totals = lims.map(p => clamp(
    Math.round(p.max * (pct + (rng() * 2 - 1) * FILL_RULES.spread) / 100), p.lo, p.hi))

  // 2. Bring the semester onto the target a mark at a time, on a random paper
  //    that still has room — never past its own limits.
  let diff = target - totals.reduce((a, t) => a + t, 0)
  for (let guard = 0; diff !== 0 && guard < 200000; guard++) {
    const step = diff > 0 ? 1 : -1
    const room = lims.map((p, k) => k).filter(k => (step > 0 ? totals[k] < lims[k].hi : totals[k] > lims[k].lo))
    if (!room.length) break
    totals[room[Math.floor(rng() * room.length)]] += step
    diff -= step
  }

  // 3. Pull apart any two papers on the same total. A move takes marks from
  //    one paper and gives them to another, so the semester total — and with
  //    it the exact percentage — is never disturbed.
  let clashes = pairsEqual(totals)
  for (let guard = 0; clashes > 0 && guard < 6000; guard++) {
    const clashing = totals.map((_, k) => k).filter(k => totals.some((u, j) => j !== k && u === totals[k]))
    const a = clashing[Math.floor(rng() * clashing.length)]
    const b = randInt(0, totals.length - 1)
    if (a === b) continue
    const d = randInt(1, 3) * (rng() < 0.5 ? 1 : -1)
    const na = totals[a] + d, nb = totals[b] - d
    if (na < lims[a].lo || na > lims[a].hi || nb < lims[b].lo || nb > lims[b].hi) continue
    const before = totals[a], beforeB = totals[b]
    totals[a] = na; totals[b] = nb
    const after = pairsEqual(totals)
    // Keep a move that helps; keep a neutral one now and then so the search
    // can walk out of a dead end; undo anything that makes it worse.
    if (after < clashes || (after === clashes && rng() < 0.3)) clashes = after
    else { totals[a] = before; totals[b] = beforeB }
  }

  // 4. Split each total into internal and external, each within its own
  //    limits and near the paper's overall share, so a paper does not come
  //    out with a full internal beside a bare-pass external.
  return lims.map((p, k) => {
    const T = totals[k]
    const iLo = Math.max(p.loI, T - p.maxT)
    const iHi = Math.min(p.maxI, T - p.loT)
    const share = p.max ? T / p.max : 0
    const centred = Math.round(p.maxI * share + (rng() * 2 - 1) * p.maxI * 0.08)
    const i = p.maxI ? clamp(centred, iLo, iHi) : 0
    return { key: p.key, i, t: T - i, total: T, max: p.max }
  })
}

const sameAs = (set, previous) => set.every(r => {
  const prev = previous?.[r.key]
  return prev != null && String(prev.i) === String(r.i) && String(prev.t) === String(r.t)
})

/**
 * @param papers   [{ key, maxI, maxT }] — maximum internal / external marks
 * @param pct      the overall percentage asked for
 * @param options  { previous: { [key]: { i, t } }, rng }
 * @returns {
 *   ok, reason,
 *   marks:  { [key]: { i, t } },
 *   rows:   [{ key, i, t, total, max }],
 *   target, achieved, total, achievedPct, exact, unique, repeatedPrevious
 * }
 */
export function generateSemesterMarks(papers, pct, { previous = null, rng = Math.random } = {}) {
  const p = Number(pct)
  if (!Number.isFinite(p) || p <= 0 || p > 100) {
    return { ok: false, reason: 'Enter a percentage between 0 and 100.' }
  }

  const capOn = p >= FILL_RULES.capFrom && p <= FILL_RULES.capTo
  const lims = (papers || []).map(x => limitsOf(x, capOn)).filter(x => x.max > 0)
  if (!lims.length) {
    return { ok: false, reason: 'No paper in this semester has maximum marks set in the Scheme.' }
  }

  const total = lims.reduce((a, x) => a + x.max, 0)
  const floorSum = lims.reduce((a, x) => a + x.lo, 0)
  const ceilSum = lims.reduce((a, x) => a + x.hi, 0)
  const wanted = Math.round((total * p) / 100)
  // The nearest total the limits allow — the exact one whenever it is legal.
  const target = Math.min(Math.max(wanted, floorSum), ceilSum)

  // Keep drawing until the set differs from the last one pressed; keep the
  // best (fewest clashing totals) seen along the way.
  let best = null
  for (let tries = 0; tries < 40; tries++) {
    const rows = attempt(lims, target, p, rng)
    const clashes = pairsEqual(rows.map(r => r.total))
    const repeated = previous ? sameAs(rows, previous) : false
    const score = (repeated ? 1000 : 0) + clashes
    if (!best || score < best.score) best = { rows, clashes, repeated, score }
    if (score === 0) break
  }

  const achieved = best.rows.reduce((a, r) => a + r.total, 0)
  return {
    ok: true,
    marks: Object.fromEntries(best.rows.map(r => [r.key, { i: r.i, t: r.t }])),
    rows: best.rows,
    target,
    achieved,
    total,
    achievedPct: (achieved / total) * 100,
    exact: achieved === wanted,
    unique: best.clashes === 0,
    repeatedPrevious: best.repeated,
  }
}
