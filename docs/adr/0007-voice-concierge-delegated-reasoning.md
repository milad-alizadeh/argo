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
