## Honesty tier (cross-cutting)

A property **of each rendered fact**, not a session-wide mode — one Session mixes tiers.

- **DIRECT** — Argo owns the fact (managed pid, a mode Argo set).
- **DERIVED** — observed from outside Argo, whether **inferred** from a signal (external
  liveness via process-match + mtime; the `~n%` context estimate) **or read verbatim** from an
  external authority (a code-host Review or Check; a Ticket's Answer prose). Verbatim reads
  are **never reworded or summarized**.
- **CONVENTION** — arrived over the companion-plugin/MCP channel (managed-only, e.g.
  `report_status`); never existed in a transcript.

**INFERRED is the Atlas's own mark on a DERIVED fact, not a fourth tier** (#1157). Everything the
Atlas holds is DERIVED — the repository is the only source — but a Domain is not observed the way
a Measure or a Coupling is: it is guessed by a technique whose own literature reports it scoring
36 on one codebase and 94 on another. So the Atlas marks that one kind of fact INFERRED wherever
it is drawn, which is a statement about how a fact was arrived at inside one tier rather than a
new tier. What it means: `docs/domain/atlas.md`, Domain and Inference; how it is drawn: #650.

**Orthogonal to quality/Score** — tier is provenance confidence (*how we know*), never output
quality (*was it good*); the Score/eval slot stays empty for v1.

**Degrade-down rule:** ambiguity always resolves toward the lower tier / quieter state — **Argo
never renders a false DIRECT** (ADR-0008). Every tier-gated enum (Mode, status, context%)
carries an explicit **`unknown`/absent** rendering; a fact that can't be established honestly is
shown as unknown, never defaulted.

**The `≈` mark is approximation, not a tier.** A fact Argo owns whose value has no exact rung in
Argo's own enum — a `claude` in `default` — is rendered as the **nearest rung marked `≈`**, with
the CLI's own value stated verbatim on hover. The tier stays DIRECT, because Argo knows the fact
exactly and only its vocabulary is coarser. Degrading it to `unknown` would discard something
plainly observed, which is the opposite failure from the one the rule above prevents (ADR-0025).

**The mark has a second sense, and it is not DIRECT** (#940). A rung the user picked while a Turn
was running cannot be walked yet — the ring is stepped with keystrokes mid-Turn nobody can promise
the agent receives — so Argo holds the intent and walks it at the Turn's boundary. The control
draws that rung under the same `≈`, because the mark's common meaning across both senses is *the
word is not exactly the fact*. Here Argo has only ASKED, so the fact is not one it owns. What keeps
it honest rather than a false DIRECT is that the held rung **ticks nothing**, and the footnote on
the closed control and in the menu names **the rung the Session is standing on** until the walk
lands, so nothing on screen claims the held rung is established.

**Nearest is judged by what happens without further user input**, which is the tiebreak a
standing stance needs: `default` reads and nothing else while nobody is answering prompts, so it
is `Read Only ≈` rather than the `Code` its approvals could eventually reach. Where even that is
undecidable the ordinary rule applies and the value is `unknown` — `claude` `dontAsk` is the
case, because its boundary is an allowlist Argo cannot see.

Two DERIVED soft-spots to render honestly, not hide: external liveness (process-match on `cwd` +
mtime is **not a unique key** — two `claude` in one repo can mis-match, and mtime goes stale
during long "thinking", so it can read live-as-idle); and `~n%` context (the window denominator
is model-dependent and may be unnamed in the transcript).
