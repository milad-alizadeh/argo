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

42 chunks × 4 caps × {Haiku temp 0; Qwen3.5-4B temp 0 and 0.7}. 504 trials, 0 errors,
1068 marker instances checked.

### Marker-drop rate × cap × model

| cap | Haiku 4.5 (temp 0) | Qwen3.5-4B (temp 0) | Qwen3.5-4B (temp 0.7) |
|---|---:|---:|---:|
| uncapped | 21.3% | **15.7%** | 21.3% |
| 40 words | 22.5% | **16.9%** | 29.2% |
| 25 words | 30.3% | 30.3% | 37.1% |
| 15 words | 30.3% | 43.8% | 40.4% |

Line-level violation rate (what actually gates speech) runs 31–43% for Haiku and 24–57% for
Qwen. Median spoken words, uncapped → 15w: Haiku 30 / 32 / 25 / 21; Qwen 36 / 33 / 24 / 18.

### Drop rate by marker class

| class | Haiku | Qwen3.5-4B |
|---|---:|---:|
| negation | 19.3% (n=176) | 26.7% (n=352) |
| restrictor | 26.2% (n=84) | **39.9%** (n=168) |
| conditionality | **41.7%** (n=60) | 17.5% (n=120) |
| hedging | 33.3% (n=36) | 37.5% (n=72) |

### Substitution table — proposed rows against the data

| corpus | seed table (contractions) | + proposed rows | drops explained |
|---|---:|---:|---:|
| Haiku | 26.1% | 26.1% | **0 of 93** |
| Qwen3.5-4B | 29.4% | 29.2% | **1 of 209** |

### Retry

| model | violations | rescued by one named retry | fell back to extractive | median retry cost |
|---|---:|---:|---:|---:|
| Haiku | 61 | 41 (67.2%) | 20 | 11.1s (CLI loop tax) |
| Qwen3.5-4B | 138 | 85 (61.6%) | 53 | **5.5s** |

## Findings

**1. The guard is not a cheap seatbelt — it is load-bearing.** #203's read said `<2%` → ship the
check and keep the cap. The floor is **15.7%**, ten times that, and it is 21.3% on the cloud model.
#199's retry-then-extractive path was reasoned about as a rare backstop whose clunkiness was
acceptable; at these rates the model-free extractive fallback speaks roughly one line in eight.
That is not an exception path, it is a significant fraction of the product's voice.

**2. The cap is a real dial, and 25 words is a cliff.** Both models sit at 15–22% above 40 words
and jump at 25. #193's ~20-word prototype value roughly doubles Qwen's rate (16.9% → 43.8%).
Caveat that makes the recommendation blunter than the table looks: **"40 words" is barely a
constraint** — both models write ~32 words when told 40, so what the data supports is *do not cap
below ~30*, not a precise number.

**3. But the cap is not the main cause.** ~16–21% of markers are lost with **no length pressure at
all**. #203's third read — "high rate even uncapped → capacity, not brevity" — is the one that
fired. Raising the cap is worth doing and cannot get near a seatbelt rate.

**4. The generator constraint did not take.** #199's central bet was converting "preserve meaning"
(a judgement that failed) into "these exact words must appear" (a constraint a small model can
satisfy). Both models had that instruction verbatim in the system prompt and dropped markers on a
third of lines. The bet is not obviously wrong — it may need few-shot examples or a fine-tune
rather than a prompt clause — but as specified it does not hold.

**5. The substitution table is a dead end — a useful negative.** Proposed rows explain 0 of 93 and
1 of 209 drops. Beyond contractions (which are the same word, not a paraphrase), drops are genuine
losses. #199 anticipated needing entries like `non-idempotent → not idempotent`; the data says keep
the table minimal and spend the effort elsewhere. One row is worth adding for judgement, not rate:
`probably ↔ likely`.

**6. The two models have opposite weak classes, which breaks the pruning question as posed.**
`if` is Haiku's worst token (50%) and one of Qwen's best (12.5%); `all` is 66.7% on Qwen and 25% on
Haiku. #193 named conditionality as the residual weakness — true for Haiku, false for Qwen.
#199 scoped the guard as one model-independent contract clause and expected #203 to prune the
lexicon on rate. If the weak class depends on the reshaper, the lexicon cannot be pruned
model-agnostically: either it becomes per-model config, or it stays wide at all four classes.
The honest answer to "which classes get dropped" is **all of them, differently**.

**7. Temp 0 holds — now measured rather than inherited.** #193 mandated it after a 3B fabricated at
0.3. Qwen3.5-4B at its card-recommended 0.7 is worse at every cap (21.3% vs 15.7% uncapped,
29.2% vs 16.9% at 40 words). The dial is settled: temperature 0.

**8. The retry earns its place.** 61–67% of violations rescued for 5.5s on-device. Keep it.

**9. Ranking flips with the cap.** Qwen3.5-4B is *more* faithful than Haiku above 40 words
(15.7% vs 21.3%) and much worse below 25 (43.8% vs 30.3%). It partly keeps markers by refusing to
condense — 36 median words uncapped against Haiku's 30 — so squeezing removes what it relied on.
This is worth stating plainly: **a line that keeps every protected marker by not condensing passes
#199's check and still fails the #192 contract.** The guard catches over-condensation only. Qwen's
uncapped lines also repeatedly listed all options' content, a straight rule-3 violation the marker
check is blind to.

**10. Gemma 4 E4B is disqualified as a router, on latency, before fidelity is considered.**
37–48s per line, thinking unstoppable (see method). For a channel whose target is ~1s to first
token, that is not a close call.

**11. LM Studio silently drops `chat_template_kwargs`.** `chat_template_kwargs`, `template_kwargs`,
bare `enable_thinking` and `extra_body` all produce byte-identical reasoning-token counts. Qwen3.5's
template does support the flag, so the workaround is to write its empty-`<think>` prefill by hand as
a trailing assistant turn (1499 reasoning tokens → 0). Anyone benchmarking hybrid-thinking models
through LM Studio and trusting that flag is measuring the thinking model and will not be told.

## Verdict

**The dials, answered:** cap ≥ 30–40 words (never ~20); temperature 0; keep the retry; keep the
substitution table minimal; **do not prune the lexicon** — the class-level rates that were supposed
to justify pruning turn out to be model-dependent.

**The thing that outgrew the ticket:** #199 locked its shape on the premise that a deterministic
check is a cheap seatbelt over a rare failure. The failure is not rare — 16% at best, on a corpus
built to carry markers — and the generator constraint meant to prevent it does not hold under a
prompt clause. Every amendment #199 made still stands (the ranking never depended on a rate, and
severity is asymmetric), but "cheap and rare" was load-bearing in how the enforcement path was
designed, and it is false. That belongs back in front of #199, not silently absorbed here.

**For #193's on-device verdict:** it survives, and improves. Qwen3.5-4B is the better reshaper of
the two above 40 words, at ~1.5s per line, free and private, in ~3GB — well inside the 16GB
both-local budget #193 ruled out on a 7B. The caveat is that its advantage is contingent on not
compressing hard, which is exactly what a voice channel wants to do.

