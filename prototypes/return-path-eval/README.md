# #224 — return-path eval: council judges over the spoken line

Throwaway measurement rig for [#224](https://github.com/milad-alizadeh/argo/issues/224), which
evaluates the design [#222](https://github.com/milad-alizadeh/argo/issues/222) landed: the
router hands the audio model **verbatim spans**, and the audio model does the only phrasing
anyone hears.

```bash
bun verify.ts                             # ALWAYS FIRST — the instrument self-test
bun mine-transcripts.ts --redact          # build corpus arm B (local, gitignored)
bun sweep.ts --arms B --limit 6           # pilot
bun sweep.ts --arms AB --limit 14         # a real run
bun report.ts results.jsonl
```

`.env` holds `OPENAI_API_KEY` and is gitignored. Without it, stage 3 is **skipped** — never
faked. `--no-speak` skips it deliberately and still measures quotation fidelity.

## What was unknown, and where each number comes from

| #224's unknown | measured by | report section |
|---|---|---|
| 1. How often does the router silently paraphrase when told to quote? | `containment.ts` over every emitted span | §1 |
| 2. Does a pre-reduced core + "do not compress" land better? | the `spans` vs `spans+clause1` A/B | §3, §4 |
| 3. Does it sound good? | the council's `under-condensed` axis — **and your own ears; see the caveat below** | §4 |

## The contract this encodes

#222 §2 said the router emits "verbatim spans, selected but never rewritten" and nobody had
written that prompt. Grilling it against a worked example produced the finding that shaped
everything: **zero of the 42 hand-authored `faithfulCore`s in `../marker-drop-rate/corpus.ts`
are a literal substring of their source.** Human ground truth for "what must survive" is never
pure quotation. Three forces break it, and each one is answered:

| force | example | answer |
|---|---|---|
| **deixis** | `so those failures predate it` — antecedent outside the span | a span is **whole sentences**, so the antecedent rides along |
| **derived facts** | `Three ways to fix this` → "three options existed" appears nowhere | a **typed scaffold** (`type`, `optionCount`, `destructive`) carries what cannot be quoted |
| **stitching** | discontiguous fragments joined naively are ungrammatical | spans are an ordered list; joining is the audio model's job, which is its job anyway |

The router's budget is **relevance, never length** — #192 rule 2's type table, no word cap
(#203 measured the cap as the direct cause of marker loss). Router reduces by relevance; the
audio model compresses not at all.

## Files

| file | what it is |
|---|---|
| `containment.ts` | the check, and the closed meaning-neutral normaliser it needs |
| `spans.ts` | **the contract** — router prompt, payload type, wire rendering |
| `arms.ts` | the three arms, incl. the pre-#222 reshaper as control |
| `speaker.ts` | stage 3 behind an interface; `session.instructions` incl. #222 §3's clause |
| `judges.ts` | the five axes as violation questions, binary + evidence |
| `council.ts` | fan-out, mixed-vendor panel, majority on the hard invariant |
| `corpus.ts` / `mine-transcripts.ts` | arm A (42 synthetic) + arm B (42 real, median 335w) |
| `verify.ts` | **run first.** 17 containment cases, 10 of which must be REJECTED |
| `sweep.ts` / `report.ts` | the run (incremental, resumable) and the aggregation |

## Notes that change how you read the output

- **Normalisation is mandatory and it is a liability.** 100% of real long assistant turns
  contain markdown, so a strict `includes` fails the moment the router strips an asterisk it
  cannot speak. The normaliser is a closed list of formatting-only transforms and `verify.ts`
  holds ten cases it **must reject** — dropped negation, flattened hedge, changed number,
  expanded contraction. The report always prints the strict rate alongside the normalised one,
  so the leniency's cost is visible rather than assumed.
- **Arm A is not a test of reduction.** Its chunks are median 41 words and the whole-sentence
  hull of their `faithfulCore` is a median 85% of the source. It is kept only because #203's
  15.7–21.3% is the sole baseline this design can be compared against. Read arm B for the job
  the router actually has.
- **The panel must be mixed-vendor.** Two judges from one vendor are one lens: shared training
  data, shared blind spots. The report prints the vendors and warns when only one voted.
- **A transcript is not audio.** The council scores
  `response.output_audio_transcript.done` — the model's own record of what it said. On the very
  first trial that transcript contained the literal backticks from the source, and nothing in
  it tells you whether the speaker *said* "backtick". Stage-3 fidelity is measurable this way;
  **whether it sounds good is not**, and #224's third unknown still needs someone to listen.
- **Nothing is ever fabricated.** A failed router call, unreachable speaker or dead judge
  yields a trial tagged with its error and no scores. Unparsable judge votes fall to "no
  violation" and are counted separately, so a reported rate is always a **floor**.
