## Experience

- **Concierge** — the voice interface + its router/brain (ADR-0007, spike-gated, **unbuilt**;
  only the orb *visual* exists). Deferred for v1.
- **Companion plugin** — the bundled plugin that makes a Session `managed` and emits the
  **CONVENTION** tier (ADR-0016). Note: subagent `label`/`group` are **not exclusively
  CONVENTION** — their tier follows their source (CONVENTION when the plugin reports them;
  DERIVED when the CLI's own transcript carries them).
- **Preview** — a **cockpit-level singleton** (at most one across the whole cockpit; starting
  one stops the running one — ADR-0011) that *points at* an Agent. The edge is per-Agent `0..1`
  *attachment*; the running instance is global-single.
