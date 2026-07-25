# Marker-drop rate: setting the brevity-vs-fidelity guard's dials

**Date:** 2026-07-25 · **For:** wayfinder [#203](https://github.com/milad-alizadeh/argo/issues/203), setting the dials [#199](https://github.com/milad-alizadeh/argo/issues/199) locked the *shape* of on `n=1` · **Status:** throwaway prototype, measured numbers

## The question

[#199](https://github.com/milad-alizadeh/argo/issues/199) locked the guard's shape from a single
observation: [#193](https://github.com/milad-alizadeh/argo/issues/193)'s walking skeleton dropped a
`did NOT touch STT` negation under a terse cap, silently inverting meaning. The *ranking* needed no
rate — "a dropped negation is a contradiction, not a condensation" follows from
[#192](https://github.com/milad-alizadeh/argo/issues/192) alone. Every **dial** does:

1. **The cap's number.** #192 has no length cap; #193's ~20 words was a prototype artifact.
2. **Lexicon membership.** #199 took four classes (negation, restrictors, conditionality, hedging)
   deliberately wide so pruning would have data to prune on.
3. **The closed substitution table.** Which awkward verbatim carries genuinely need an entry.
4. **Retry value.** #199 specified one named retry before the extractive fallback. Does it work?

And the read that decides *which thing is broken*: low rate → the guard is a cheap seatbelt; high
rate → the cap is mis-set; **high rate even uncapped → capacity, not brevity**, which would hit
#193's on-device verdict.

## Method

### The instrument is the guard

You cannot count marker-drops without the extractor #199 mandates, so the rig *is* the guard:
`markers.ts` holds the lexicon, the closed substitution table, the exact-token check, the named
retry and the extractive fallback. Building it was not a bet placed ahead of the data.

`verify-instrument.ts` runs first and must pass before any model time is spent — 11 cases including
#193's actual failure, the `STT untouched` paraphrase trap, tabled substitutions that must *not*
fire, and marker-count cases. A false positive matters more than a miss here: #199's argument for a
dumb checker is that a noisy gate gets switched off.

### Corpus

42 chunks (95 marker instances per pass) across #192's three **voiced** types — Status is usually
not voiced and Raw artifact never is, so neither has a faithful core for the guard to bind to.
Each chunk is hand-annotated with its always-faithful core, the span #192's type table declares
non-droppable; the extractor derives expected markers from that span, never from the whole chunk
(#199 §3 — running it over the full chunk would drag every `if` out of pullable reasoning into the
lead, which #199 explicitly rejects).

#193's three samples could not measure a rate: one *happened* to carry a negation, which is how the
failure surfaced at all. These are built to carry markers so a drop is detectable rather than lucky.

### Axes

- **Cap** (independent variable — #193 named the mechanism outright: "the brevity cap makes the
  model choose what to keep"): uncapped, 40, 25, 15 words. The uncapped arm is what separates "the
  cap is mis-set" from "this is a capacity floor".
- **Model:** Haiku 4.5 (subscription CLI, #193's reshaper) + current-generation local candidates.
- **Temperature:** 0 and the model card's recommendation. #193 mandated temp 0 after a 3B
  *contradicted its source* at 0.3 — but that was one model, and current small models are tuned
  around temp ≈ 1 (Gemma 4's card recommends 1.0). Treated as a dial, not an inheritance.
  **Haiku has one arm only**: the `claude` CLI exposes no temperature flag.

### Model selection — why not #193's Qwen2.5-7B

#193 benched Qwen2.5-7B because that is what was to hand in July 2025. Two generations have
shipped since, both explicitly aimed at on-device:

| Model | Params | Released | IFEval | Thinking |
|---|---|---|---|---|
| Qwen3.5-9B | 9B | 2026-03-02 | 91.5% | hybrid — must disable |
| Qwen3.5-4B | 4B | 2026-03-02 | 89.8% | hybrid — must disable |
| Gemma 4 E4B | 4.5B effective (8B w/ embeddings, PLE) | 2026-04-02 | — | configurable — must disable |
| Gemma 3 4B | 4B | 2025 | 90.2% | none |

Measuring a model we would not ship would set the dials against the wrong reshaper — and likely
pessimistically. Two further reasons the 4B class is the right primary target:

- **It is the RAM question.** #193 deferred the router-transport decision partly on memory: a 7B is
  ~5GB alone and ~24GB alongside the audio model, so "16GB can't". A 4B moves that materially, which
  makes this measurement an input to that parked decision.
- **4B vs 9B is the capacity axis** #203 wants, so it replaces any need for a weaker-cloud-tier proxy.

**IFEval is the wrong predictor** and is not used to choose: everything sub-10B sits at ~90%, and
[IFBench exists because that is overfitting](https://arxiv.org/html/2507.02833v1) to 25 known
constraint templates — models above 80% on IFEval fall below 50% on novel constraints. #199's
constraint ("carry `not`/`only`/`unless` through as those words") is not an IFEval template. The
leaderboards only narrow the field; this sweep is the measurement.

### Thinking mode is off — a fidelity choice, not just a latency one

#193 ruled reasoning models out of the router slot on TTFT (GPT-OSS-20B at 3.2s). Independently,
[constraint-level error-shift work](https://arxiv.org/pdf/2606.09662) finds built-in thinking
*degrades* required-keyword, negation/exclusion and conditional constraints — verbose intermediate
steps make terminal constraints harder to apply. Those are precisely the classes #199 protects, so
non-thinking is the **faithful** setting as well as the fast one. The harness forces it off on both
local models and the report flags any trial where thinking leaked, since such rows measure a
different model than intended.

## Results

_Pending — sweep in progress._

## Findings

_Pending._

## Verdict

_Pending._
