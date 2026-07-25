/**
 * Turns sweep results into the five things #203 asked for: the rate table, the cap's number,
 * lexicon pruning, earned substitution-table rows, and whether the retry pays for itself.
 *
 * Reports per-marker-instance rate, not per-line: a line carrying three markers and dropping
 * one is a partial failure, and averaging it away as "1 bad line" hides which class is weak.
 * The line-level violation rate is reported alongside, because that is what actually gates
 * speech under #199 §4.
 *
 * Usage: bun report.ts results.json
 */

import { capLabel, type Cap } from "./contract";
import { LEXICON, type MarkerClass } from "./markers";
import type { Trial } from "./sweep";

type Results = { corpus: number; trials: Trial[] };

const pct = (n: number, d: number): string => (d === 0 ? "  —  " : `${((100 * n) / d).toFixed(1)}%`);

const capKey = (c: Cap): string => capLabel(c);

function rateTable(trials: Trial[]): string {
  const models = [...new Set(trials.map((t) => t.model))];
  const caps = [...new Set(trials.map((t) => capKey(t.cap)))];
  const temps = [...new Set(trials.map((t) => t.temp))].sort();

  const rows: string[] = [];
  rows.push("| model | temp | cap | lines | violating lines | markers | dropped | drop rate |");
  rows.push("|---|---|---|---:|---:|---:|---:|---:|");
  for (const m of models) {
    for (const tp of temps) {
      for (const c of caps) {
        const cell = trials.filter(
          (t) => t.model === m && capKey(t.cap) === c && t.temp === tp && !t.error,
        );
        if (cell.length === 0) continue;
        const markers = cell.flatMap((t) => t.markers);
        const dropped = markers.filter((r) => r.verdict === "missing");
        const violating = cell.filter((t) => t.violation);
        rows.push(
          `| ${m} | ${tp} | ${c} | ${cell.length} | ${violating.length} (${pct(violating.length, cell.length)}) | ${markers.length} | ${dropped.length} | **${pct(dropped.length, markers.length)}** |`,
        );
      }
    }
  }
  return rows.join("\n");
}

function byClass(trials: Trial[]): string {
  const models = [...new Set(trials.map((t) => t.model))];
  const classes = Object.keys(LEXICON) as MarkerClass[];
  const rows: string[] = [];
  rows.push(`| class | ${models.join(" | ")} | all |`);
  rows.push(`|---|${models.map(() => "---:").join("|")}|---:|`);
  for (const cls of classes) {
    const cells = models.map((m) => {
      const ms = trials.filter((t) => t.model === m && !t.error).flatMap((t) => t.markers).filter((r) => r.cls === cls);
      return `${pct(ms.filter((r) => r.verdict === "missing").length, ms.length)} (n=${ms.length})`;
    });
    const all = trials.filter((t) => !t.error).flatMap((t) => t.markers).filter((r) => r.cls === cls);
    rows.push(
      `| ${cls} | ${cells.join(" | ")} | ${pct(all.filter((r) => r.verdict === "missing").length, all.length)} (n=${all.length}) |`,
    );
  }
  return rows.join("\n");
}

function byToken(trials: Trial[]): string {
  const tally = new Map<string, { cls: MarkerClass; n: number; dropped: number }>();
  for (const t of trials) {
    if (t.error) continue;
    for (const r of t.markers) {
      const e = tally.get(r.token) ?? { cls: r.cls, n: 0, dropped: 0 };
      e.n += 1;
      if (r.verdict === "missing") e.dropped += 1;
      tally.set(r.token, e);
    }
  }
  const rows = ["| token | class | occurrences | dropped | rate |", "|---|---|---:|---:|---:|"];
  for (const [token, e] of [...tally].sort((a, b) => b[1].dropped - a[1].dropped || b[1].n - a[1].n)) {
    rows.push(`| \`${token}\` | ${e.cls} | ${e.n} | ${e.dropped} | ${pct(e.dropped, e.n)} |`);
  }
  const unseen = (Object.entries(LEXICON) as [MarkerClass, readonly string[]][]).flatMap(
    ([cls, ws]) => ws.filter((w) => !tally.has(w)).map((w) => `\`${w}\` (${cls})`),
  );
  return `${rows.join("\n")}\n\nNever occurred in the corpus (no evidence either way): ${unseen.join(", ") || "none"}`;
}

function substitutionCandidates(trials: Trial[]): string {
  const tally = new Map<string, Map<string, number>>();
  for (const t of trials) {
    if (t.error) continue;
    for (const r of t.markers) {
      if (r.verdict !== "missing" || !r.untabledCandidate) continue;
      const inner = tally.get(r.token) ?? new Map<string, number>();
      inner.set(r.untabledCandidate, (inner.get(r.untabledCandidate) ?? 0) + 1);
      tally.set(r.token, inner);
    }
  }
  if (tally.size === 0) return "_No untabled equivalents observed — every drop was a genuine loss, not an unlisted paraphrase._";
  const rows = ["| expected | reshaper wrote instead | times | genuine equivalent? |", "|---|---|---:|---|"];
  for (const [token, inner] of tally) {
    for (const [cand, n] of [...inner].sort((a, b) => b[1] - a[1])) {
      rows.push(`| \`${token}\` | \`${cand}\` | ${n} | _judge_ |`);
    }
  }
  return `${rows.join("\n")}\n\nEach row is a candidate for #199's closed substitution table — a paraphrase that preserved meaning but failed the exact-token test. Rows judged genuine become table entries; the rest stay violations.`;
}

function retryValue(trials: Trial[]): string {
  const models = [...new Set(trials.map((t) => t.model))];
  const rows = ["| model | violations | retry rescued | fell back to extractive | retry cost (median) |", "|---|---:|---:|---:|---:|"];
  for (const m of models) {
    const v = trials.filter((t) => t.model === m && t.violation && t.retry);
    if (v.length === 0) {
      rows.push(`| ${m} | 0 | — | — | — |`);
      continue;
    }
    const rescued = v.filter((t) => t.retry!.rescued);
    const times = v.map((t) => t.retry!.ms).sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)] ?? 0;
    rows.push(
      `| ${m} | ${v.length} | ${rescued.length} (${pct(rescued.length, v.length)}) | ${v.length - rescued.length} | ${(median / 1000).toFixed(2)}s |`,
    );
  }
  return rows.join("\n");
}

function lengthTable(trials: Trial[]): string {
  const models = [...new Set(trials.map((t) => t.model))];
  const caps = [...new Set(trials.map((t) => capKey(t.cap)))];
  const rows = [`| model | ${caps.join(" | ")} |`, `|---|${caps.map(() => "---:").join("|")}|`];
  for (const m of models) {
    const cells = caps.map((c) => {
      const ws = trials.filter((t) => t.model === m && capKey(t.cap) === c && !t.error).map((t) => t.words).sort((a, b) => a - b);
      if (ws.length === 0) return "—";
      return `${ws[Math.floor(ws.length / 2)]} (${ws[0]}–${ws[ws.length - 1]})`;
    });
    rows.push(`| ${m} | ${cells.join(" | ")} |`);
  }
  return `${rows.join("\n")}\n\nMedian spoken words (min–max). Shows whether the cap is actually obeyed — a model that ignores it makes its rate column uninformative about brevity.`;
}

function worstLines(trials: Trial[], n = 12): string {
  const bad = trials
    .filter((t) => t.violation && !t.error)
    .sort((a, b) => b.markers.filter((r) => r.verdict === "missing").length - a.markers.filter((r) => r.verdict === "missing").length)
    .slice(0, n);
  if (bad.length === 0) return "_No violations to inspect._";
  return bad
    .map((t) => {
      const dropped = t.markers.filter((r) => r.verdict === "missing").map((r) => `\`${r.token}\``).join(", ");
      return `**${t.chunk}** · ${t.model} · ${capKey(t.cap)} · temp ${t.temp} — dropped ${dropped}\n  > ${t.line}${t.retry ? `\n  retry (${t.retry.rescued ? "rescued" : "still failed"}): ${t.retry.line}` : ""}`;
    })
    .join("\n\n");
}

function thinkingLeaks(trials: Trial[]): string {
  const leaked = trials.filter((t) => t.thoughtLeaked);
  if (leaked.length === 0) return "_No thinking output leaked — non-thinking mode held on every trial._";
  const byModel = [...new Set(leaked.map((t) => t.model))]
    .map((m) => `${m}: ${leaked.filter((t) => t.model === m).length}`)
    .join(", ");
  return `⚠️ Thinking output appeared on ${leaked.length} trials (${byModel}). Non-thinking mode did not fully hold, so those rows measure a thinking model — treat them as suspect given arXiv 2606.09662's finding that thinking degrades exactly these constraint classes.`;
}

const path = Bun.argv[2] ?? "results.json";
const { corpus, trials } = (await Bun.file(path).json()) as Results;
const ok = trials.filter((t) => !t.error);
const errs = trials.filter((t) => t.error);

console.log(`# #203 marker-drop measurement

Corpus: ${corpus} marker-bearing chunks · ${trials.length} trials (${errs.length} errored) · ${ok.flatMap((t) => t.markers).length} marker instances checked

## Marker-drop rate × cap × model

${rateTable(trials)}

## Drop rate by marker class — the pruning data

${byClass(trials)}

## Drop rate by token

${byToken(trials)}

## Earned substitution-table rows

${substitutionCandidates(trials)}

## Does the named retry pay for itself?

${retryValue(trials)}

## Was the cap obeyed?

${lengthTable(trials)}

## Thinking-mode check

${thinkingLeaks(trials)}

## Worst violations (for eyeballing what the dumb check catches and misses)

${worstLines(trials)}
${errs.length ? `\n## Errors\n\n${errs.slice(0, 5).map((e) => `- ${e.model} ${capKey(e.cap)} ${e.chunk}: ${e.error}`).join("\n")}` : ""}`);
