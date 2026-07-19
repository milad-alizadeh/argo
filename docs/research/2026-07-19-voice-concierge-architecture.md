# Voice concierge architecture — on-device audio-to-audio + delegated reasoning

**Date:** 2026-07-19
**Question:** The single most reliable architecture for a natural-feeling, on-device, audio-to-audio voice concierge on Apple Silicon (M4 target), where the *model* natively owns VAD / turn-taking / barge-in (the app must not hand-roll them) and reasoning/tool-calling is delegated to a separate cloud reasoning model (Claude Haiku/Sonnet).
**Method:** deep-research harness — 6 angles, 23 sources fetched, 104 claims extracted, 25 adversarially verified (3-vote), 24 confirmed / 1 refuted.

## Recommendation

**Architecture (commit to this, behind an interface):** a native full-duplex audio-to-audio model that owns turn-taking, with its **aligned inner-monologue text stream intercepted and forwarded to a cloud reasoning model (Claude Haiku/Sonnet)** for tool-calling. This matches Argo's locked concierge/router split.

**Model, today:** **Kyutai Moshi** via its official **MLX build** (int4/int8/bf16) on Apple Silicon. It is the *only* model that is simultaneously (a) native full-duplex with no host VAD/turn machine, (b) shipping with a documented, quantized Mac runtime, and (c) emitting an interceptable aligned text stream — the clean hook the delegated router needs.

**Model, target/upgrade:** **NVIDIA PersonaPlex** (Moshi-derived, best measured naturalness, same interception hook; early community evidence of a native-Swift/MLX Apple-Silicon port exists but is unproven). Spike whether it runs acceptably on an M4 — if it does, it closes Moshi's one real weakness while keeping the same architecture.

## The honest trade-offs

1. **Naturalness is Moshi's weakness, and naturalness is the paramount requirement.** On the one third-party full-duplex benchmark (Full-Duplex-Bench human DMOS), Moshi scored **lowest (3.11)** of the cohort — behind Freeze-Omni (3.51), Qwen-2.5-Omni (3.70), Gemini Live (3.72), PersonaPlex (3.90). Moshi is the most *deployable*, not the most *natural*. (Caveat: vendor-run benchmark, overlapping CIs.)
2. **The delegated split is an engineering choice, not a validated pattern.** No surveyed source benchmarks "audio model + separate cloud reasoner." The research *frontier* is the opposite — DuplexSLA/BayLing-Duplex fold planning + tool-calling *into* the single audio backbone. For Argo the split is still correct (you cannot fold a subscription Claude router into Moshi), but its latency/robustness is unmeasured.
3. **The intercept hook exposes Moshi's *own* speech, not the user's.** Verified: Moshi's Inner Monologue is a time-aligned transcript of *Moshi's* speech (interceptable ✓). The claim that it cleanly exposes the *user's* transcript too was **refuted (0-3)**. So the router seam needs a plan for capturing user intent (Moshi's paraphrase-back, or a parallel STT on the user stream) — this is a real design gap.
4. **On-device latency is unproven.** Moshi's famous "160ms theoretical / 200ms practical" was measured on an **L4 datacenter GPU, not Apple Silicon.** Real M4 (and lower-spec M1/M2) latency is unestablished and directly affects the "natural feel."

## Disqualified for this requirement

**Half-duplex omni models — Qwen2.5/3-Omni, Sesame CSM** — ship **without** native VAD/turn-taking and force the host to bolt one on (exactly what the brief forbids). Confirmed 3-0: Qwen-2.5-Omni "ships without a VAD"; CSM "can only model text and speech content, not the structure of the conversation"; the 4-bit MLX Qwen3-Omni build strips the audio tower entirely (text-only, audio via a "really hacky" workaround). Note: Qwen3-Omni's Thinker-Talker *does* expose a clean text hook for delegated function-calling — so if a genuine full-duplex Qwen build with native turn-taking appears, it re-enters as a candidate.

## Native-full-duplex fallbacks (research-stage, no mature Mac runtime yet)

- **PersonaPlex** (Moshi-derived, DMOS 3.90 — best naturalness; the target above).
- **SALMONN-omni** (standalone "dynamic thinking mechanism," no external VAD/interrupter).
- **BayLing-Duplex** (single AR LLM decides listen/speak/stop, no auxiliary turn module).

## Open questions the spike must answer

1. Moshi MLX int4/int8 real-time-factor + end-to-end latency **on an M4** (and lower-spec Macs) — does it stay under ~230ms on-device?
2. Delegated round-trip latency (Moshi monologue → Claude tool-call → back into Moshi's context) and whether filler acknowledgements preserve the natural feel.
3. Is re-injecting the router's tool-call results into a continuously-generating full-duplex stream mechanically robust, or does it cause artifacts/desync?
4. Capturing the **user's** intent for the router given the hook only exposes Moshi's speech (parallel STT vs Moshi paraphrase-back).
5. Does PersonaPlex actually run on an M4 (validate the community Swift/MLX port)?

## Caveats

Early-2026 snapshot of a fast-moving field (DuplexSLA is May 2026, BayLing-Duplex June 2026; the naturalness leader keeps changing — revisit within months). Most naturalness claims are author-self-reported. Full source list and per-claim votes in the workflow journal.

## Key sources

- Moshi: [paper](https://kyutai.org/Moshi.pdf) · [arXiv](https://arxiv.org/html/2410.00037v2) · [GitHub](https://github.com/kyutai-labs/moshi) · [MLX-q8 card](https://huggingface.co/kyutai/moshiko-mlx-q8)
- PersonaPlex: [preprint](https://research.nvidia.com/labs/adlr/files/personaplex/personaplex_preprint.pdf) · [Apple-Silicon Swift/MLX port (blog)](https://blog.ivan.digital/nvidia-personaplex-7b-on-apple-silicon-full-duplex-speech-to-speech-in-native-swift-with-mlx-0aa5276f2e23)
- SALMONN-omni: [arXiv](https://arxiv.org/pdf/2505.17060) · BayLing-Duplex: [arXiv](https://arxiv.org/abs/2606.14528) · DuplexSLA: [arXiv](https://arxiv.org/abs/2605.20755)
- Sesame CSM: [research post](https://www.sesame.com/research/crossing_the_uncanny_valley_of_voice) · Qwen3-Omni MLX: [HF](https://huggingface.co/pherber3/Qwen3-Omni-30B-A3B-Instruct-4bit-mlx)
- Practitioner: [macos-local-voice-agents](https://github.com/kwindla/macos-local-voice-agents) (sub-800ms voice-to-voice on M-series, Pipecat)
