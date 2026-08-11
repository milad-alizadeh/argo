## Honesty tier (cross-cutting)

A property **of each rendered fact**, not a session-wide mode — one Session mixes tiers.

- **DIRECT** — Argo owns the fact (managed pid, a mode Argo set).
- **DERIVED** — observed from outside Argo, whether **inferred** from a signal (external
  liveness via process-match + mtime; the `~n%` context estimate) **or read verbatim** from an
  external authority (a code-host Review or Check; a Work Item's Answer prose). Verbatim reads
  are **never reworded or summarized**.
- **CONVENTION** — arrived over the companion-plugin/MCP channel (managed-only, e.g.
  `report_status`); never existed in a transcript.

**Orthogonal to quality/Score** — tier is provenance confidence (*how we know*), never output
quality (*was it good*); the Score/eval slot stays empty for v1.

**Degrade-down rule:** ambiguity always resolves toward the lower tier / quieter state — **Argo
never renders a false DIRECT** (ADR-0008). Every tier-gated enum (Mode, status, context%)
carries an explicit **`unknown`/absent** rendering; a fact that can't be established honestly is
shown as unknown, never defaulted.

Two DERIVED soft-spots to render honestly, not hide: external liveness (process-match on `cwd` +
mtime is **not a unique key** — two `claude` in one repo can mis-match, and mtime goes stale
during long "thinking", so it can read live-as-idle); and `~n%` context (the window denominator
is model-dependent and may be unnamed in the transcript).
