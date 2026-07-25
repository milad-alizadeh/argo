/**
 * Re-score stored lines under a PROPOSED substitution table, without spending model time.
 *
 * #203 asks which awkward carries genuinely need an in-table equivalent, "found empirically
 * rather than imagined". That question is answered by taking the drops the sweep already
 * recorded, proposing table rows, and seeing how much of the rate they explain. Because the
 * spoken lines are stored verbatim, this is pure re-analysis — no second run, and no
 * temptation to quietly widen the table mid-sweep and report the flattered number.
 *
 * Prints the rate BEFORE and AFTER, so the cost of each proposed row is visible.
 *
 * Usage: bun rescore.ts results-*.json
 */

import { checkLine, extractExpected, isViolation, SUBSTITUTIONS } from "./markers";
import { CORPUS } from "./corpus";
import type { Trial } from "./sweep";

/**
 * Candidate rows, drawn from what the reshapers actually wrote. Each is a judgement call and
 * is listed with the reason it is defensible — a row that merely *often* appears is not
 * thereby a meaning-preserving equivalent, which is the whole point of the table being closed.
 */
const PROPOSED: Record<string, readonly string[]> = {
  // "no caller exists" / "there is no X" -> "none". Same quantifier, no polarity change.
  none: ["no", "nothing", "zero"],
  // Scope restrictor written as its lexical twin. "solely"/"alone" restrict identically.
  only: ["solely", "alone"],
  // "except" and "other than" are the same exclusion.
  except: ["other than", "apart from"],
  // Conditionality: "when" is NOT proposed — "when it finishes" asserts it will, "if it
  // finishes" does not. Only the genuinely conditional synonyms are here.
  if: ["provided", "assuming", "in case"],
  unless: ["except if", "except when"],
  // Hedges within the same strength band. "appears"/"seems" are interchangeable; "likely"
  // and "probably" are interchangeable. "could"/"might" are NOT merged with "may" beyond
  // what the seed table already allows, because modal strength differs by register.
  seems: ["appears", "looks"],
  appears: ["seems", "looks"],
  likely: ["probably"],
  probably: ["likely"],
};

const files = Bun.argv.slice(2);
if (files.length === 0) throw new Error("usage: bun rescore.ts results-*.json");

const coreById = new Map(CORPUS.map((c) => [c.id, c.faithfulCore]));

/**
 * Snapshot the seed table BEFORE anything mutates the live one. `scoreWith` swaps the module's
 * table in place, so passing `SUBSTITUTIONS` itself as the baseline aliased the object it was
 * about to clear — the "before" row scored against an empty table and overstated the seed's
 * drop count. Deep-copy first.
 */
const SEED: Record<string, readonly string[]> = Object.fromEntries(
  Object.entries(SUBSTITUTIONS).map(([k, v]) => [k, [...v]]),
);

const merged: Record<string, string[]> = {};
for (const [k, v] of Object.entries(SEED)) merged[k] = [...v];
for (const [k, v] of Object.entries(PROPOSED)) merged[k] = [...(merged[k] ?? []), ...v];

/** Re-run the check with the merged table by temporarily swapping the module's table in. */
function scoreWith(table: Record<string, readonly string[]>, trials: Trial[]) {
  const orig = { ...SUBSTITUTIONS } as Record<string, readonly string[]>;
  for (const k of Object.keys(SUBSTITUTIONS)) delete (SUBSTITUTIONS as Record<string, unknown>)[k];
  Object.assign(SUBSTITUTIONS, table);

  let markers = 0;
  let dropped = 0;
  let violatingLines = 0;
  const stillDropped = new Map<string, number>();
  for (const t of trials) {
    if (t.error || !t.line) continue;
    const core = coreById.get(t.chunk);
    if (!core) continue;
    const res = checkLine(extractExpected(core), t.line);
    markers += res.length;
    const miss = res.filter((r) => r.verdict === "missing");
    dropped += miss.length;
    if (isViolation(res)) violatingLines += 1;
    for (const m of miss) stillDropped.set(m.token, (stillDropped.get(m.token) ?? 0) + 1);
  }

  for (const k of Object.keys(SUBSTITUTIONS)) delete (SUBSTITUTIONS as Record<string, unknown>)[k];
  Object.assign(SUBSTITUTIONS, orig);
  return { markers, dropped, violatingLines, stillDropped };
}

for (const file of files) {
  const { trials } = (await Bun.file(file).json()) as { trials: Trial[] };
  const usable = trials.filter((t) => !t.error && t.line);
  const before = scoreWith(SEED, trials);
  const after = scoreWith(merged, trials);

  const pct = (n: number, d: number) => (d === 0 ? "—" : `${((100 * n) / d).toFixed(1)}%`);
  console.log(`\n## ${file} (${usable.length} usable lines)\n`);
  console.log("| table | markers | dropped | drop rate | violating lines |");
  console.log("|---|---:|---:|---:|---:|");
  console.log(
    `| seed (contractions only) | ${before.markers} | ${before.dropped} | **${pct(before.dropped, before.markers)}** | ${before.violatingLines} (${pct(before.violatingLines, usable.length)}) |`,
  );
  console.log(
    `| + proposed rows | ${after.markers} | ${after.dropped} | **${pct(after.dropped, after.markers)}** | ${after.violatingLines} (${pct(after.violatingLines, usable.length)}) |`,
  );
  const explained = before.dropped - after.dropped;
  console.log(
    `\nProposed rows explain ${explained} of ${before.dropped} drops (${pct(explained, before.dropped)}). The remainder are genuine losses no closed table can forgive.\n`,
  );
  const rows = [...after.stillDropped].sort((a, b) => b[1] - a[1]).slice(0, 12);
  console.log("Still dropped after the proposed table:");
  for (const [tok, n] of rows) console.log(`  \`${tok}\` × ${n}`);
}
