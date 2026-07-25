/**
 * The instrument must catch #193's actual failure and must not fire on innocent lines.
 * A noisy gate gets switched off (#199 §2), so a false-positive here is worse than a miss.
 * Run this before trusting any sweep number.
 */

import { CORPUS } from "./corpus";
import { checkLine, extractExpected, isViolation } from "./markers";

type Case = { name: string; core: string; line: string; expectViolation: boolean };

const CASES: Case[] = [
  // The #193 failure, verbatim in shape: the clause was CUT, not paraphrased.
  {
    name: "#193 regression — dropped 'did NOT touch STT'",
    core: "412 tests pass, 3 fail. I did not touch the STT adapter, so those failures predate this change.",
    line: "412 pass, 3 fail in uploadData — those failures predate your change.",
    expectViolation: true,
  },
  {
    name: "#193 same chunk, marker carried",
    core: "412 tests pass, 3 fail. I did not touch the STT adapter, so those failures predate this change.",
    line: "412 pass, 3 fail — I did not touch the STT adapter, so they predate your change.",
    expectViolation: false,
  },
  // #199 §2's named paraphrase trap: meaning survives, exact token does not.
  {
    name: "paraphrase that deletes the token ('STT untouched')",
    core: "I did not touch the STT adapter.",
    line: "STT adapter untouched.",
    expectViolation: true,
  },
  // Tabled substitutions must NOT fire.
  {
    name: "tabled substitution — didn't for not",
    core: "I did not touch the STT adapter.",
    line: "I didn't touch the STT adapter.",
    expectViolation: false,
  },
  {
    name: "tabled substitution — may for might",
    core: "This might work under load.",
    line: "This may work under load.",
    expectViolation: false,
  },
  // Hedge flattening — #192 rule 4 calls this a contradiction.
  {
    name: "flattened hedge ('might work' -> 'works')",
    core: "The lint gate is green but that might be misleading.",
    line: "The lint gate is green but it is misleading.",
    expectViolation: true,
  },
  // Restrictor loss changes scope.
  {
    name: "dropped restrictor 'only'",
    core: "Q4_K_M is the only one that fits the 8GB budget.",
    line: "Q4_K_M fits the 8GB budget.",
    expectViolation: true,
  },
  // Conditionality loss — #193's named residual weakness.
  {
    name: "dropped conditionality 'unless'",
    core: "Safe to change the signature, unless something reaches it dynamically.",
    line: "Safe to change the signature.",
    expectViolation: true,
  },
  // Must not fire on legitimate reordering / heavy paraphrase that keeps markers.
  {
    name: "heavy paraphrase, all markers kept",
    core: "There is no caller outside the dev menu. Safe unless something reaches it dynamically.",
    line: "No caller outside the dev menu, so it's safe unless something reaches it dynamically.",
    expectViolation: false,
  },
  {
    name: "marker count respected — two 'not's needed, two given",
    core: "The bug is not a missing rule and it is not the sync config.",
    line: "The bug is not a missing rule and not the sync config.",
    expectViolation: false,
  },
  {
    name: "marker count violated — two 'not's needed, one given",
    core: "The bug is not a missing rule and it is not the sync config.",
    line: "The bug is not a missing rule; the sync config is fine.",
    expectViolation: true,
  },
];

let failures = 0;
for (const c of CASES) {
  const expected = extractExpected(c.core);
  const results = checkLine(expected, c.line);
  const got = isViolation(results);
  const ok = got === c.expectViolation;
  if (!ok) failures += 1;
  const dropped = results.filter((r) => r.verdict === "missing").map((r) => r.token);
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${c.name}\n      expected violation=${c.expectViolation} got=${got}` +
      `  markers=[${expected.map((e) => `${e.token}×${e.count}`).join(", ")}]` +
      `${dropped.length ? ` dropped=[${dropped.join(", ")}]` : ""}`,
  );
}

// Corpus sanity: every chunk must actually carry markers, or it contributes nothing.
console.log("\n--- corpus marker coverage ---");
const empty: string[] = [];
let total = 0;
for (const chunk of CORPUS) {
  const m = extractExpected(chunk.faithfulCore);
  total += m.reduce((n, x) => n + x.count, 0);
  if (m.length === 0) empty.push(chunk.id);
  else console.log(`${chunk.id} (${chunk.type}): ${m.map((x) => `${x.token}${x.count > 1 ? `×${x.count}` : ""}`).join(", ")}`);
}
console.log(`\n${CORPUS.length} chunks, ${total} marker instances per pass`);
if (empty.length) {
  console.log(`⚠️  chunks with NO protected marker in the faithful core (dead weight): ${empty.join(", ")}`);
  failures += 1;
}

console.log(failures === 0 ? "\n✅ instrument verified" : `\n❌ ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
