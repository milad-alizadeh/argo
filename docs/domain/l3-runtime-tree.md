## L3 · Runtime tree

### The tree

- **Agent** — a node in the execution tree, **recursive**. Root-vs-child by **`parentId`**
  (root = `null`), never a `kind` discriminant.
- **Session** — the **root Agent** (`parentId: null`); see L2 for identity fields. Three
  referents kept straight: **(a)** ACP's program-level "Agent" = the CLI program (root Agent's
  identity + `cli`); **(b)** the tree **node** = any `Agent`; **(c)** CC's "Agent"/Task tool =
  the *mechanism that spawns* a Subagent.
- **Subagent** — a **non-root Agent** (a delegated child). Recursive.
- **Turn** — one exchange within an Agent: **prompt in → stop reason out**. Stop reason ∈
  `end_turn · max_tokens · max_turn_requests · refusal · cancelled`, plus **`unknown`** where
  the reason can't be inferred — never guessed. Carries **the prompt that opened it**, verbatim
  and DERIVED, absent rather than invented for a record that carried none. Steering text typed
  mid-run is a prompt like any other. Carries its own **start and end** — a Session's duration
  is measured from these; an agent still working has no end, so duration runs against the wall
  clock rather than closing at a fabricated one.
- **Message** — what the agent **said** within a Turn. **DERIVED and held verbatim** — never
  reworded, summarized, or lifted into a fact. `0—N` per Turn, in emission order.
- **Thought** — what the agent **reasoned** within a Turn. DERIVED, verbatim, `0—N` per Turn,
  and **never read as a Message** (different provenance claims; a Turn's final message routinely
  contradicts its own reasoning). Kept in **ONE ordered sequence** with Message, not two lists —
  emission order is the only thing that says which reasoning produced which answer.
- **Tool Call** — the atomic observable action within a Turn (kind read/edit/execute/search/…,
  status pending/in_progress/completed/failed, target file). Carries **when it was emitted and
  when its result came back** — the grain at which a time is worth rendering.

  What it produced is a **Result** — a kinded value object (`diff | output | media`) carrying
  **its own honesty tier**, not loose fields beside `target`.
  - A **`diff`** result is **point-in-time** — what that ONE edit changed when it was made,
    never re-read from disk, never updated by a later edit to the same file. This is what
    separates it from L4's **Diff** (branch-vs-base, git-addressed, current). One renderer draws
    both; only the feed's is bounded to a first hunk.
  - A **`media`** result takes the transcript's **embedded bytes** as primary at the DIRECT tier
    (what the agent actually looked at, and uninvalidatable); a **re-read of the path** is the
    fallback only, at the lower tier and labelled as the current file. Gated on the declared
    image **type**, not the tool's name. A result with no bytes renders as an honest absence,
    never a broken image.
- **Plan** — the agent-authored live to-do list, **Session-scoped and agent-replaced whole**:
  `PlanEntry[]`, status `pending | in_progress | completed` (ADR-0020). One list per Session,
  not one per Turn. A **Turn** carries at most the **snapshot** in force while it ran; the
  Session's current plan is the newest snapshot observed, which is **DERIVED** — which is why a
  turn that touched no plan does not blank it. Distinct from Work Item and Delivery lifecycle.
- **Workspace** — the git working context attached to an Agent: `kind: main | worktree`, plus
  `branch`, `baseRef`, `dirty`, `unpushed`, `headSha`, `ahead`/`behind`, `sharedCount`. **The
  join key `branch` lives here** — Delivery is keyed by `Workspace.branch`. Node-scoped
  (ADR-0010): an Agent has **`0..1` owned** Workspace and otherwise **inherits its parent's** —
  a Subagent without its own worktree renders no second chip. DIRECT for a managed Agent,
  DERIVED for external. Every owned Workspace branches from the Project's shared base ref.
- **Compaction** — a marker in an Agent's Turn sequence where history was condensed; the
  resume-chain stitches across it.
- **Usage** — token/cost/context telemetry, DERIVED. Not a tree node — a fact on Turn +
  Session, **and on a Subagent as a whole**: a Subagent's turns run in a sidechain the parent
  transcript does not attribute, so its spend is read off the delegating Tool Call's result, the
  only place it is ever reported. The Session roll-up sums both grains. **Cost is derived from
  an Argo-owned, versioned pricing table** — rebuildable owned-state, staleable on provider
  price changes.

**No "Run"/"Dispatch" grouping object, and no "Phase" entity.** Multi-agent structure lives as
**derived rendering over the tree**, not a stored object.

### Sub-agent grouping — a derived blueprint, not an object

Two **optional, tier-gated attributes on a Subagent**, populated only when the CLI exposes them
and **absent, never fabricated, when it doesn't**:

- **`label`** — what this subagent is doing ("research: auth flow").
- **`group`** — the named phase/stage it belongs to ("Verify").

The **blueprint** ("3 researching, 2 queued to verify") is a DERIVED rollup — sibling Subagents
grouped by `group`, counted by status — degrading honestly across CLIs:

- **Claude Code** → full phased blueprint (Workflow exposes labels + phases + counts).
- **Codex** → labeled subagent tree (parent/child + path addresses, **no** phases).
- **Cursor / bare** → flat "N subagents running" (the DIRECT floor).

The cockpit never invents a phase a CLI didn't report.
