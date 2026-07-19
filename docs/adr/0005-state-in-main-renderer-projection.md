# State lives in main; the renderer is a projection

**Context.** With the backend in Electron's main process (ADR-0004), the authoritative roster/actor-tree state lives in main. The renderer needs to reflect it and stay in sync. We had to choose a store topology and how much state-machine machinery to adopt.

**Decision.**
- **Main** holds the single source of truth as a **plain observable TypeScript store** (the hub). The hub holds only live, reconstructable state; the durable subset is persisted to **plain files, not a database** — see ADR-0008 (`better-sqlite3` is withdrawn).
- **Renderer** is a **projection**: main pushes deltas over IPC into a **Zustand** store that React subscribes to. No business logic in the renderer.
- **XState is used sparingly** — not as the general state model. Reserved at most for the operator gate (commit → push → merge/land), which has genuinely discrete states. Notably, the concierge's native turn-taking (the audio model owns VAD/barge-in) is expected to remove the need for v2's XState turn/barge-in machine entirely.

**Why.** The main-process-backend decision already makes main the owner; a plain observable store keeps that hub framework-free and testable, and durability lives in plain files off the hot path (ADR-0008), not a database. Zustand is the lightest way to fan main's state into a shadcn/React UI without Redux ceremony. Reserving XState prevents modelling everything as a machine when most of the app is a projection of an event stream.

**Consequences.** Zustand/observable-store are individually easy to swap; the load-bearing, harder-to-reverse commitment is the *shape* — authoritative state in main, renderer as a pure projection over IPC. Business logic must not migrate into the renderer.
