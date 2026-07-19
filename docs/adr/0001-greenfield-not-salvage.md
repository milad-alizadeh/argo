# Build greenfield, do not salvage code from argo-v2

**Context.** A prior build, `~/Developer/argo-v2` (~264 TS files, Electron + bun + turbo), already implements a voice cockpit over Claude Code and even ships a reuse manifest naming parts safe to lift (voice sidecar, orb, binResolve, MCP channel). The new cockpit's *design* was deliberately produced fresh — two stateless grills that were told not to read v2 — and independently converged on the same architecture.

**Decision.** Build the app pure greenfield. `argo-v2` is **read-only reference only**; no code is copied, not even the parts its own manifest marks "COPY VERBATIM". Every module is re-authored against the new taxonomy and honesty model.

**Why.** The new design is a clean sheet on purpose, and the single most load-bearing subsystem is fundamentally different: the concierge is now a **local on-device audio-to-audio model**, not v2's STT→text→TTS pipeline (Silero VAD + Parakeet + Kokoro + a text router). Lifting v2's voice sidecar would drag the superseded architecture in. The owner's ruling: done properly, from scratch — the model and the voice are different this time.

**Consequences.** Slower to first-running than a fork; we re-derive solved problems (PTY hosting, binary resolution). Accepted, because the alternative imports v2's Claude-only framing and wiring — the exact bias the fresh design escaped. v2 remains a *reference* to read for patterns, never an import.
