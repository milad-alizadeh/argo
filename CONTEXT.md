# Argo

<!--
  SINGLE source of truth for the domain — terms are added the moment they lock in the grill.
  Normative content only: entities, attributes, enums, tiers, cardinalities, bans.
  Why each term won its name (prior-art derivation, rejected alternatives, ADR archaeology)
  lives in docs/domain/rationale.md — read it when changing a term, not to apply one.
-->

Layers: **L1 Organisation · L2 Session · Honesty tier · L3 Runtime tree · L4 Delivery detail ·
Ports · Experience · Relationships.**

## Storage & ownership

Every source of truth is external: Work Items live in a project-management provider, Delivery
truth in a code host, Sessions in the filesystem (CLI transcripts) + terminal. Argo owns only
the **glue** — the Project registry and the user-asserted links no external signal carries.

- **Files are always the source of truth.** Argo's owned state lives in **per-machine app
  data** (`userData`), **never committed** (sessions, paths, registration are per-machine).
- **The join is derived, never stored.** Branch-per-session, work-item-per-branch, PR/CI state
  are all derivable. The **Hub** assembles the join in memory on launch as a throwaway
  projection (ADR-0008).
- **SQLite, if it returns, is only ever a rebuildable cache/index** — never a source of truth.
  Deferred until profiling forces it.

## L1 · Organisation entities

- **Project** — the scope of one cockpit window: a **registered git repo, keyed to a stable
  id** (path is a mutable attribute), carrying an **optional** Work Item provider and an
  **optional** Code host. One git root = one Project (a monorepo is one Project). Registration
  is the act that creates it — an unregistered repo on disk is not a Project. One active
  Project per window; the known set lives in a per-machine file registry. The **only entity
  above the Session that Argo owns rather than observes**, and the shared base ref every
  session's Workspace branches from.

- **Work Item** — intent. A ticket owned by a Work Item provider; **Argo stores only the link**
  (provider id + which port), never the content (title/status/body/blockers are read-through,
  cached but never authoritative). **No stored type** — "PRD" and "Task" are *roles*, taken from
  the **provider's declared type when it has one** and **falling back to hierarchy** (has
  children / is a leaf) only when the provider carries none. `blockedBy` is a provider-sourced
  dependency DAG, Argo-normalized, with blocker states **verified per-blocker** (the provider's
  summary count is stale).

  **`answer`** — a value object present *only* under the **decision-ticket** role (derived from
  the `wayfinder:<type>` label): the resolved text of a decision, **DERIVED and held verbatim**,
  formed from the `Answer:`-marked comment plus every later `Correction:`/`Amendment:`-marked
  one in creation order. A `ruled_out` closure carries `Out of scope:` instead and is
  uncomposable by construction. **No identity of its own** — addressed by the Work Item link.
  Markers match on a **plain-text projection** each Port supplies alongside a flat,
  creation-ordered comment list (provider bodies are not uniformly markdown).

  **State bucket** on that same role — `open · claimed · resolved · ruled_out`, **never
  stored**, a *bucket not a word*: the provider's own status word renders verbatim (#272); the
  bucket surfaces only where Argo must compute or group across providers. Authority splits:
  closure is **DERIVED per-port** (GitHub `state_reason`, Linear state `type`, Jira `resolution`
  through a configured mapping); `claimed` is **DIRECT** (no provider carries a claim).

  A confirmed `ruled_out` blocker **satisfies no `blockedBy` edge** — dependents render
  **stranded** until a human re-scopes one of the two. An **unresolvable** blocker blocks and
  reads `unknown`; a blocker closed with an **unreadable kind satisfies**, so ruling-out
  detection degrades to a chrome notice rather than stranding a map.

  **Every provider is remote** — GitHub Issues / Linear via OAuth; no provider connected → no
  Work Items → all sessions unlinked.

- **Delivery** — the product in flight: a **derived, branch-keyed** entity assembled per branch
  from local git facts ∪ code-host facts (PR/CI/review/merge). Comes into existence **at branch
  creation** (chat/planning sessions have no branch → no Delivery). One live Delivery = the
  current life of a branch; merge/close is its terminal state. May have **zero sessions** (a
  teammate's PR). Deployment/Release are reserved **lifecycle nodes on its strip**, not sibling
  entities (unwired).

- **Person** — a human actor, minimally **`me | other`**. Owns `Review.author` and the teammate
  distinction, and drives the "needs-**you**" attention signal. Not richer than this for v1.

### L1 relationships — a triangle, not a chain

Three independent, optional, many-to-many edges:

- **Session → Work Item** — "what am I working on" (survives with no branch). Persisted as a
  **user-asserted link only as the fallback**, when there is no Delivery to derive it through. A
  branch-backed link is *derived*, never also asserted (ADR-0017), so the edge is never
  double-sourced.

  This edge **is** the **claim lease** on a decision ticket — a ticket is `claimed` exactly
  while a live Session links to it, its age `now − link.createdAt` (DIRECT) and its release the
  session's own end; there is no TTL. Across a restart the link survives, **re-derived from the
  session's own read of its brief file**, but liveness drops to DERIVED — so the claim degrades
  to **stale** rather than reading as held: stale-on-open is takeable with a warning,
  stale-on-closed is inert (closure is read before claims). That derivation is why an
  **orphaned** session keeps its claim and a purely **external** session never holds one. The
  provider assignee is a **visible echo** for teammates, never the lease — it carries no age,
  nothing releases it, and it is written by the **agent** under `/wayfinder`, not by Argo.
- **Session → Delivery** — "which branch / product am I moving."
- **Delivery → Work Item** — "what intent does this branch serve" (survives with no session),
  derived via the join precedence (native-ref → id-in-branch → unlinked). When it derives to
  **unlinked**, the user can **assert branch→ticket manually**, persisted like the branchless
  link (ADR-0017). An assertion wins over a derived *unlinked*, **never over a positive
  derivation**.

## L2 · Session

- **Session** — the observation unit: one **logical resume-chain**, keyed by a stable chain id
  (one-or-more transcript files stitched by `leafUuid`). The only stored classification is
  **`managed | external`** — no kinds (ADR-0013). `managed` = Argo spawned it, owns the PTY,
  companion plugin loaded → drivable + carries CONVENTION-tier facts. `external` = discovered
  from transcripts, read-only, no PTY. **All sessions are observed** (transcript-tailing is the
  floor); managed is *external + PTY steering + CONVENTION channel* layered on top. v1 ranks
  external lower (read-only awareness), ships managed-first.

  **Managed-ness is not durable across an Argo restart**: the PTY/steering channel dies with the
  owning process and cannot be re-adopted, so a `managed` session whose owner is gone demotes to
  **orphaned** — observation-only, steering unrecoverable (CONVENTION may re-establish only if
  the plugin re-dials CLI-side). Orphaned is a third posture of the `managed | external` axis,
  not a fourth stored kind.

  A Session **is the root Agent** (`parentId: null`). Key attributes: **`cli`**
  (`claude | codex | …`), **`cwd`** (**DIRECT for managed / DERIVED for external** — the root of
  every L1-triangle derivation and of external liveness matching).

- **Transcript file** — the *physical* per-file CLI record (owned by the CLI). One Session
  stitches one or more. Never itself called a "Session."

- **Session status** — a DERIVED rollup on the Session:
  - **running** — a Turn is in progress.
  - **permission** — blocked on an agent `request_permission` prompt.
  - **asking** — blocked on a structured `AskUserQuestion`.
  - **idle** — Turn ended `end_turn`, or no live signal; **includes an agent's free-form
    question** (indistinguishable from idle in the record — never fabricated as `asking`).
  - **stopped** — Turn ended on `max_tokens · max_turn_requests · refusal`.
  - **ended** — session terminated (`cancelled` or process exit).

  Honesty-gated: `permission` is DIRECT, **managed-only**. `asking` is **CONVENTION for managed,
  DERIVED for external** — but only when "pending" is **confirmable** from the record (a
  resolved question reads as `idle`). `stopped` needs a stop-reason an external transcript may
  not carry. **External floors at `running · asking? · idle · ended`**; managed
  `permission`/`stopped` collapse to `idle`/`ended` when observed externally.

- **Session Mode** — the Session's *standing autonomy stance*; defined once in the Autonomy
  cluster below. A Session (root-Agent) fact, not per-Subagent. DIRECT for managed, tier-gated
  for external.

- **`SessionFacts` — dissolved, not an entity.** git facts (`dirty/unpushed/headSha`) →
  **Workspace**; code-host facts (`pr/ci/review`) → **Delivery**; liveness/mode → **Session
  status/Mode**.

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

## L4 · Delivery detail

Lifecycle strip nodes: **commits · pr · ci · review · merge** (+ reserved **deploy · release**,
unwired). All sub-entities are DERIVED from local git ∪ code host — and code-host-sourced facts
**keep the host's vocabulary verbatim** (Check names, PR states, review verdicts are never
renamed or normalized).

- **Diff** — the change-set of a Delivery (branch vs base), **git-addressed by commit SHA**
  (ADR-0008: refs are SHAs, never fabricated; no commit → no stable ref).

- **Review** — a submitted review round against a Delivery: `verdict`
  (`approve | request-changes | comment`, host's terms), author, reviewed SHA. Source-tiered: a
  teammate's review via the code host (DERIVED) or Argo's code-review skill (CONVENTION). The
  skill is a *source* of a Review — **never call the entity "code review."**

- **Finding** — an individual resolvable issue within a Review: `severity: blocking | advisory`,
  `state: open → addressing → fixed`. "N unresolved" is a derived count.

- **Check** — one observed CI check on a Delivery: **name verbatim from the code host** +
  status, DERIVED, rolling into the `ci` node. **One level only — no Job/Step tree.** **Local
  lint/test is deliberately *not* modeled**: the cockpit observes git state (dirty/unpushed,
  DIRECT) but never runs or parses tooling — CI is the authoritative pass/fail. Before a
  push/PR there are simply no Checks ("no CI yet"), never a reimplemented local runner.

- **Outcome** — the durable, provenance-tiered record of **what a Session produced**;
  Session-keyed and **persisted** (ADR-0008), which is why it survives distinct from the
  live-derived, branch-keyed Delivery. The `produces` edge made concrete, pointing at a **typed
  target**, each addressed in *its own* space: **code** (a Diff/Delivery, git-addressed by SHA),
  **ticket** (a created Work Item, provider-id-addressed), or **artifact** (a plan/research
  file, path-addressed, possibly uncommitted). v1: **external sessions have no Outcome** — an
  honest gap, not a fabricated record.

## Observation surface (cross-cutting)

- **Terminal** — a PTY Argo owns, running in a Workspace's cwd. As an *observation* surface it
  is the **session terminal**: the live, steerable view of a managed Session (managed-only).
- **Transcript** — the **read-only replay** view, parsed from the CLI's on-disk record. Any
  session, external or historical.

## Autonomy cluster (cross-cutting)

- **Mode** — the **Session's** *standing* autonomy stance (root-Agent fact, not per-Subagent):
  **`Ask | Plan | Code`** (Ask = gate every action; Plan = read + propose, no edits; Code = act
  autonomously within permissions), plus **`unknown`** when unobservable. DIRECT for managed,
  tier-gated for external. Mode sets how often Permission fires. The `Plan` **mode** value ≠ the
  `Plan` **entity** (L3 to-do list) — distinct senses, never in one clause.
- **Permission** — a *per-action* prompt the **agent** raises ("may I run this tool?"; options
  `allow_once · allow_always · reject_once · reject_always`). DIRECT, managed-only; drives the
  `permission` session-status.
- **Gate** — **Argo's own** policy on automating *Delivery* steps (create-PR, merge,
  push-after-PR), each `ask | auto`. Argo-owned automation, **not** an agent prompt — a
  different actor and axis from Permission.

## Files, editing & shell (Argo as a light agentic IDE)

Beyond *observing* agents, Argo directly views/edits files and runs commands — first-party
capabilities independent of any session.

- **File** — a path + content in a **Workspace**'s working tree (so file views are
  Workspace-scoped, not Project-scoped). DIRECT. A first-party edit mutates the working tree →
  surfaces as Workspace `dirty`/`unpushed` (no separate state).
- **File explorer / lightweight editor** — UI surfaces, not domain entities. Explicitly **not**
  a full IDE.
- **Open in editor** — an action on a File or the Project: Argo's built-in editor, or **hand off
  to an external editor**. A capability, not an entity.
- **Scratch terminal** — a plain **Terminal** (PTY) in a Workspace's cwd, attached to **no
  Agent/Session**. Same PTY machinery as a session terminal, minus the agent.

## Ports

Argo's two adapter ports — how **Argo itself** reads external truth. **Access is OAuth + the
provider's HTTP API, not the `gh` CLI** (tokens in the OS keychain; polled, since a desktop app
receives no webhooks). `gh` remains how *agents* operate the repo — a different layer.

- **Work Item provider** — sources intent. GitHub Issues / Linear for v1; pluggable. The read
  contract is children **in author order** (native on every provider); per ticket the verbatim
  status word, open/closed, closure kind, assignee, priority and labels; `blockedBy` **verified
  per-blocker**; and comments as `{ id, text, revisedAt }`, flat and creation-ordered.

  An adapter declares its gaps two ways — **a static capability descriptor** for what must be
  known before any read (`canAssign`, `canComment`,
  `closureKind: native | configured | none`), and **per-fact `unknown`** for a value it reads
  but cannot establish. Capabilities decide whether an affordance **exists**; `unknown` decides
  what a present affordance **shows**.
- **Code host** — sources Delivery truth (PR/CI/review/merge). GitHub for v1. One GitHub OAuth
  grant can feed **both** ports; Linear is Work-Item-only.
- **MCP server** — *distinct from the ports above*: tool/context providers the **observed
  session** connects to. An observable Session attribute, **not** an Argo port. Deferred for v1.

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

## Not domain entities

**Cockpit · Roster · Panels · rooms** — UI surfaces; they *render* the domain and are modeled at
design time. The **Hub** (main-process in-memory projection assembling the join —
ADR-0005/0017) and the **transcript-tailing parser** are runtime *mechanisms*.

## Relationships (the whole graph)

- **Project** `1—N` **Session**, `1—N` **Delivery**; scopes which **Work Item provider** +
  **Code host** are connected.
- **L1 triangle** (all optional): **Session—Work Item** (branchless-fallback assertion, else
  derived), **Session—Delivery** (**`0..1` at a time**, N over a resume chain),
  **Delivery—Work Item** (join precedence, **user-assertable when unlinked**). Many-to-many
  holds only *across time*; at any instant a Session is on at most one branch → one Delivery.
- **Agent tree**: **Session** *is* the root **Agent** (`parentId: null`); an **Agent** `0..N`
  child **Subagent** (recursive via `parentId`). Each **Agent** owns **`0..1` Workspace** (else
  inherits its parent's) and attaches **`0..1` Preview** — both node-scoped (ADR-0010); Preview
  is additionally a **cockpit-level singleton**. A **Workspace** holds `0—N` **File**.
- **Inside an Agent**: `1—N` **Turn**; each **Turn** `0—N` **Tool Call**, `0—N` **Message** and
  `0—N` **Thought** (one ordered prose sequence, the two kinds distinct within it), `0..1` its
  opening **prompt**, and `0..1` **Usage**, rolled up to a **Session**-level Usage; `0—N`
  **Compaction** markers punctuate the Turn sequence. The **Plan** is **not** on this line: a
  **Session** holds `0..1` **Plan** (the live list), and a **Turn** carries `0..1` **snapshot**
  of it (ADR-0020).
- **Delivery detail**: **Delivery** `1—1` **Diff**, `0—N` **Review** (`0—N` **Finding**), `0—N`
  **Check**, and `1—N` **Gate** (per automatable step).
- **Session** `0—N` **Outcome** (the `produces` link; each refs a typed target —
  **Diff/Delivery** | **Work Item** | **artifact**). External sessions: none in v1.
- **Session** `0..1` **session Terminal** (live PTY, managed-only) and `0—N` **MCP server**
  (observed attribute, deferred); a **Workspace** additionally has `0—N` agent-less **scratch
  Terminal**.
- **Person** (`me | other`) authors a **Review** and owns the teammate-PR distinction on a
  **Delivery**; drives "needs-you" attention.
- **Honesty tier** — an attribute on *every* rendered fact (DIRECT / DERIVED / CONVENTION), not
  an entity.
- **Autonomy** — **Mode** (standing stance) + **Permission** (per-action prompt) sit on the
  **Session**; **Gate** (delivery automation) sits on the **Delivery**. Distinct axes.
