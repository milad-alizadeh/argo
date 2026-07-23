# Voice-router latency: warm CLI agents vs bare API (measured)

**Date:** 2026-07-23 · **For:** wayfinder [#193 Grill-by-voice walking skeleton](https://github.com/milad-alizadeh/argo/issues/193), de-risking the ADR-0007 "cloud Claude router" leg · **Status:** throwaway prototype, measured numbers

## The question

In the ADR-0007 split, a fast on-device audio model owns presence/turn-taking and floor-holds ("let me look…") while a slower **router** does the reasoning and reshapes dense agent output into one spoken sentence (the [#192 fidelity contract](https://github.com/milad-alizadeh/argo/issues/192)). Two numbers decide whether that router leg is viable:

- **first-token (TTFT)** — the dead air the front model must cover with filler. The "no big silence" goal lives here.
- **full-turn** — when the complete spoken sentence is ready.

Constraint from the cost/privacy critique: the router should run on the **flat subscription**, not the metered API — metered token spend outside the subscription is real money and breaks the private/on-device vision. So the real question isn't "what's fastest" but **"how fast can a subscription-authed CLI agent get if we boot it once and strip everything off it?"**

## Method

- **Warm, not cold.** Boot ONE process, reuse it. `claude` via `--input-format stream-json` stdin; `codex` via `codex mcp-server` (stdio MCP), calling its `codex` tool per turn. Turn 0 is a warm-up (pays boot, discarded); turns 1+ are warm.
- **True TTFT.** `claude` needs `--include-partial-messages` or the `assistant` event only fires at completion (this bit the first run — TTFT read as full-turn). Codex TTFT = first `agent_message_delta` (spoken text starts; reasoning deltas ignored).
- **Stripped.** Router model = Haiku (claude) / Luna·Terra (codex). Contract injected as a tiny system prompt (`--append-system-prompt` / `base-instructions`), no tools needed.
- **n:** claude 6 warm turns/config, codex 4. Single machine, home network, one sitting — treat ±300ms as noise.

## Results

| Path | Auth | Warm TTFT | Warm full-turn |
|---|---|---:|---:|
| **Bare Anthropic SDK** `messages.stream()` Haiku (no agent loop) | API key (metered) | **~0.9s** | ~1–2s |
| `claude --bare` warm, all stripped, Haiku | API key (metered) | **0.7s** | 4.0s |
| `claude` warm, stripped, Haiku | **subscription** | **1.0s** | 5.1s |
| `claude` warm, default/bloated, Haiku | subscription | 1.5s | 6.4s |
| `codex mcp-server` warm, stripped, Luna/none | subscription | 2.9s | 3.3s |
| `codex mcp-server` warm, stripped, Terra/low | subscription | 2.9s | 3.3s |
| `codex` warm, Luna/low · Terra/none | subscription | 3.2s / 3.3s | 3.6s / 3.7s |

## Findings

1. **Warming is the big win — mandatory.** Boot costs 1.5–2.5s that a persistent process pays exactly once. Plain `claude -p` per turn / `codex exec` per turn re-pays it every turn; never do that. This is where my earlier "warm ≈ cold ~2.8s" was wrong: that run kept the process warm but still loaded MCP, hooks, skills, CLAUDE.md — and mismeasured TTFT as full-turn.

2. **Stripping bloat is real but modest.** On claude subscription, stripping MCP (17 servers configured on this machine!), hooks, skills, CLAUDE.md and dynamic prompt sections: TTFT 1.5s → 1.0s (~33%), full-turn 6.4s → 5.1s (~21%). Worth doing, not a silver bullet.

3. **Model tier and effort are NOISE at the CLI-agent layer.** This settles the Terra-vs-Luna puzzle: warm, stripped, tiny prompt, and Luna/none (2.9s) ≈ Terra/low (2.9s) ≈ Luna/low (3.2s) ≈ Terra/none (3.3s) — all inside the noise band. The "fast tier" (Luna) does **not** beat the balanced tier (Terra) on single-request first-token, because first-token is governed by routing/scheduling + agent-loop overhead, not the tokens/sec that "fast/cheap" tiers optimize. The only place model choice showed a clean signal was the **bare SDK** (Haiku 0.9s vs Opus ~1.9s) — a real 2× that survived because there was no agent loop burying it.

4. **The agent-loop floor is the wall.** Even `claude --bare` warm on an API key — everything stripped, no boot — is 0.7s TTFT / **4.0s full-turn**, vs the bare SDK's ~0.9s / ~1–2s for the same work. The extra ~2s of full-turn is the agent loop itself (context assembly, tool-scaffolding, result finalization), and no flag removes it. Codex sits at a ~3s floor for the same reason; stripping its instructions didn't push below it.

5. **Subscription vs API-key: a real but small priority gap.** API-key traffic is ~20–30% faster to first token and to completion than subscription/OAuth on the same stripped config (0.7s vs 1.0s TTFT; 4.0s vs 5.1s full) — consistent with priority-tier shaping, not bloat. The n=3 pilot made this look like 2–3×; n=6 shrank it. Not worth paying metered rates for.

6. **claude streams, codex doesn't (for short output).** claude: low TTFT (~1s), then tokens stream in, full sentence by ~5s. codex: ~3s of silence, then the whole sentence lands almost at once (TTFT≈full, ~3.3s). For the "no big silence" goal, **TTFT is what matters** — the front model covers a 1s gap far more naturally than a 3s one — so claude's profile fits the voice router better despite its slower full-turn.

## The trilemma, now fully measured

| | speed (TTFT) | cost | private |
|---|---|---|---|
| Bare Messages API (Haiku) | ~0.9s ✅ | metered 💸 | no ❌ |
| Subscription CLI agent (warm+stripped claude) | ~1.0s ✅ | flat/free ✅ | no ❌ |
| Codex CLI agent (warm+stripped) | ~3s ⚠️ | flat/free ✅ | no ❌ |
| On-device small model | **unmeasured** | free ✅ | yes ✅ |

The surprise: a **warm, stripped subscription `claude` reaches ~1s TTFT — matching the bare API's first-token** and losing only on full-turn. The subscription penalty is almost entirely boot (fixed, amortized) plus a modest priority gap, not something that makes it unusable.

## Suggestions going forward

1. **For a cloud router, the recipe is fixed:** warm persistent process + strip everything + Haiku + don't fuss over effort/tier. Concretely for `claude` on the subscription:
   ```
   claude -p --input-format stream-json --output-format stream-json \
     --include-partial-messages --model claude-haiku-4-5 \
     --strict-mcp-config --disable-slash-commands --setting-sources project \
     --exclude-dynamic-system-prompt-sections \
     --append-system-prompt "<fidelity contract>"
   ```
   run from a directory with no CLAUDE.md. `--bare` is even leaner but forces `ANTHROPIC_API_KEY` (metered) — it never reads OAuth, so it's off the table for a subscription router.

2. **But don't build the cloud router yet — measure on-device first.** Every cloud path is a compromise on privacy and (for the fast one) cost. The only corner that is free **and** private **and** possibly fast is a local quantized 3–8B model (Ollama / LM Studio) — and it has no agent-loop tax and no network leg, so its TTFT could undercut everything here. It's the one number that actually decides the architecture, and it's the one we haven't taken. **Recommended next experiment:** same contract, same samples, measure TTFT + full-turn + fidelity-contract faithfulness on a local model. `codex --oss --local-provider ollama|lmstudio` gives a ready harness, or hit the model's own server directly (no agent loop).

3. **Whatever wins, TTFT is the spec, not full-turn.** The architecture only needs the router fast enough that the front model's floor-hold feels natural, then it streams. Target: TTFT under ~1s. Both bare-API and warm-stripped-subscription-claude already clear it; codex (~3s) does not, and would need the front model to cover an awkward silence.

4. **Resolve #193** with this verdict: the cloud router leg is *viable* (warm+stripped subscription claude, ~1s TTFT) but is a privacy/cost compromise; gate the final choice on the on-device measurement before committing ADR-0007's router to the cloud.

---

### ⚠️ Security note

The Anthropic API key pasted into this session to run the bare-API and `--bare` measurements is now exposed in the chat transcript. **Rotate it.** It was never written to any file — passed inline as an env var for single runs only; these scripts read it from `ANTHROPIC_API_KEY` and never store it.
