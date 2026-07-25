# Voice: native full-duplex concierge + delegated Claude router

**Context.** The concierge must feel natural, run on-device (M4 target), and let the *model* own VAD / turn-taking / barge-in — the app must not hand-roll a turn machine. Reasoning and tool-calling are delegated to a separate model. A deep-research pass (`docs/research/2026-07-19-voice-concierge-architecture.md`) surveyed the early-2026 landscape.

**Decision.**
- **Architecture (settled, built behind an interface):** a **native full-duplex audio-to-audio model** owns conversation + turn-taking; its **aligned inner-monologue text stream is intercepted and forwarded to a cloud reasoning model (Claude Haiku/Sonnet)** for intent resolution and tool-calling. The concierge stays read-only; the Claude **router** performs all actions, running headless on the subscription (zero metered API), backend swappable (Claude/Codex).
- **Model (spike-gated):** evaluate **Moshi/MLX** (proven Apple-Silicon runtime, deployable baseline) *and* **PersonaPlex** (Moshi-derived, best measured naturalness, same hook, unproven Mac port) on the actual M4 in one spike — measure on-device latency and blind-rate naturalness — then commit. No UI leans on the concierge until the spike closes.

**Why.** The delegated split matches the locked concierge/router design and is the only way to combine a *natural* on-device voice with *reliable* cloud reasoning while keeping reasoning on the subscription. Native full-duplex is required because half-duplex omni models (Qwen2.5/3-Omni, Sesame CSM) ship without native turn-taking and would force a hand-rolled VAD — explicitly rejected. Moshi is the only ship-today native-full-duplex Mac model but is the *least* natural of the cohort, and naturalness is paramount — so PersonaPlex is evaluated head-to-head rather than assumed away.

**Consequences / risks (all spike-must-answer).**
1. The delegated split is an **engineering choice, not a benchmarked pattern** — the research frontier folds tool-calling *into* the audio backbone. Isolating voice behind an interface keeps the model swappable if that trend wins.
2. The intercept hook exposes **Moshi's own speech, not the user's** — capturing user intent for the router needs a plan (parallel STT or paraphrase-back).
3. On-device M4 latency is **unproven** (the 200 ms figure was a datacenter GPU); it directly affects the "natural feel."
4. Delegated round-trip latency and mid-stream re-injection robustness are unmeasured — must be validated before the build depends on them.

---

## Amendment — 2026-07-26: hosted audio leg for v1

**The concierge/router split above is unchanged and remains settled.** What changes is *which model owns the audio leg, and where it runs*, for the first version.

**Decision.** **v1 uses OpenAI's Realtime API (GPT Live) as the audio front end**, with Claude as the delegated router reached through a **function tool**. On-device full-duplex (Moshi/PersonaPlex) becomes the **v2 target**, not the v1 requirement. The audio leg is now explicitly **swappable behind the interface this ADR already mandates** — that isolation is what makes the reversal cheap.

**Why the reversal.** Three research passes made the original premise untenable for a first version:

- **No open-weights duplex model runs acceptably on Apple Silicon today** ([#213](https://github.com/milad-alizadeh/argo/issues/213)). PersonaPlex's MLX port is real and maintained, but its own docs put the coherent 8-bit config at **RTF ~1.4 on an M2 Max** — slower than real-time is *functional failure* for full duplex, not degraded quality — and a base M4 has ~⅓ the memory bandwidth. Moshi has the only vendor-supported Mac runtime and is **last in its cohort on naturalness**, which is this ADR's paramount requirement.
- **The pattern stopped being speculative** ([#210](https://github.com/milad-alizadeh/argo/issues/210)). GPT-Live-1 ships exactly this architecture — a full-duplex audio model delegating to a frontier text reasoner and talking while it waits — with a system card, two named developer patterns, and the same read-only containment this ADR specifies.
- **The naturalness gap runs the wrong way.** A hosted audio leg is more natural *today* than anything we can run locally, and naturalness was the constraint that justified rejecting a cascade in the first place.

**What this resolves.** Three of the four risks above are answered rather than deferred:

- **Risk #2 dissolves.** The seam is a **tool call, not a monologue tap** — the tool's arguments carry the user's intent as text. No parallel STT, no paraphrase-back, no `docs/research/2026-07-19` design gap. This was the ADR's hardest open problem and hosting removes it.
- **Risk #4 dissolves for v1.** Mid-stream re-injection is the Realtime API's own job, not ours. (It returns in v2, where [#213](https://github.com/milad-alizadeh/argo/issues/213) found the decisive unverified question: nobody has shown that forcing text into a *stock* Moshi-family checkpoint yields coherent speech — the one working precedent, MoshiRAG, needed purpose-finetuned weights.)
- **Risk #3 defers.** On-device M4 latency and the GPU-contention question ([#196](https://github.com/milad-alizadeh/argo/issues/196)) stop gating v1 and become v2 work.
- **Risk #1 was already downgraded** by [#210](https://github.com/milad-alizadeh/argo/issues/210) to "shipping pattern with a published latency reference."

**What it costs.** Four new consequences, none fatal, all worth stating plainly:

1. **The audio leg is metered.** Roughly $0.02–0.05 per active minute. **The router stays on the subscription — "zero metered API" still holds for reasoning**, which is the expensive half; only audio is billed. [#194](https://github.com/milad-alizadeh/argo/issues/194)'s latching toggle doubles as the cost control, since off means no session.
2. **Audio leaves the machine.** A real change in posture for a tool that sits over your codebase, and the one property no amount of engineering recovers. It is the strongest argument for the v2 on-device target and should be stated in the product, not buried here.
3. **Vendor dependency on a leg with no Anthropic substitute.** The Messages API has no audio modality and there is no Anthropic realtime endpoint, so the audio leg is *permanently* third-party or local — there is no all-Anthropic configuration at any price. Metered-or-local is binary.
4. **We inherit OpenAI's authoring default.** In the Chat-Supervisor pattern the *reasoner* authors the spoken line and the audio model reads it verbatim — which pre-empts [#212](https://github.com/milad-alizadeh/argo/issues/212) rather than leaving it open. If we want the concierge to reshape instead, that is now an active divergence from the reference, not a default.

**What is unaffected.** The return-path work is the differentiator and none of it is absorbed: the fidelity contract ([#192](https://github.com/milad-alizadeh/argo/issues/192)), the brevity-vs-fidelity guard ([#199](https://github.com/milad-alizadeh/argo/issues/199)), its measured dials ([#203](https://github.com/milad-alizadeh/argo/issues/203)), activation and posture C ([#194](https://github.com/milad-alizadeh/argo/issues/194)), and answer-injection ([#198](https://github.com/milad-alizadeh/argo/issues/198)) all still apply — they govern *what the spoken line says*, which is independent of who synthesizes it. What v1 does drop is the local **TTS stage**: GPT Live synthesizes internally, so the Kokoro/Chatterbox question is v2-only.

**v2 re-entry gate.** On-device returns when an open model clears **RTF < 1 at a coherent quantization on the target Mac** *and* the stock-checkpoint injection-coherence test passes. Until both hold, local full duplex is not a candidate — and the second test is cheap, needs a CUDA box rather than a Mac, and governs Moshi as much as PersonaPlex.
