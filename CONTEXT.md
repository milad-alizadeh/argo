# Argo

<!--
  Domain model being rebuilt from scratch, ACP-aligned, under
  "Domain model — the locked source of truth" (#182). This file is the SINGLE
  source of truth for the domain — terms are added the moment they lock in the
  grill. Prior model retired: see git history for docs/designs/cockpit-domain-model.md.
-->

## Language

_Rebuilt from scratch (#182), ACP-aligned, grilled layer by layer. Every term below survived
re-justification against ACP / Claude Code / Codex / Cursor + observability prior art. Layers,
all locked: **L1 Organisation · L2 Session · Honesty tier · L3 Runtime tree · L4 Delivery
detail · Ports · Experience · Relationships.**_

## Storage & ownership (locks how every entity below is sourced)

Every **source of truth is external and already has a home**: Work Items live in a
project-management provider (GitHub/Linear), Delivery truth lives in a code host, Sessions
live in the filesystem (CLI transcripts) + terminal. Argo owns only the **glue** — the
Project registry and the small set of user-asserted links no external signal carries.

- **Files are always the source of truth** — external providers, code hosts, CLI
  transcripts, and Argo's own owned config alike. Argo's owned state lives in **per-machine
  app data** (`userData`), **never committed to the repo** (sessions, paths, and
  registration are per-machine).
- **The join is derived, not stored.** Which branch a session is on, which work item a
  branch serves, PR/CI state — all derivable from the filesystem + providers + code host.
  The **Hub** assembles the full join in memory on launch and holds it as a throwaway
  projection; it is never persisted as truth (persisting a derived join is the drift bug
  ADR-0008 killed the SQLite mirror to avoid).
- **SQLite, if it ever returns, is only ever a rebuildable cache/index** (e.g. a search/recall
  index over transcripts) — never a source of truth. Deferred until profiling forces it.

## L1 · Organisation entities

- **Project** — the scope of one cockpit window: a **registered git repo, keyed to a stable
  id** (path is a mutable attribute), carrying an **optional** Work Item provider and an
  **optional** Code host. One git root = one Project (a monorepo is one Project, not one per
  app). Registration is the act that creates it — an unregistered repo on disk is not a
  Project. One active Project per window; the known set lives in a per-machine file registry.
  The **only entity above the Session that Argo owns rather than observes**, and the shared
  base ref every session's Workspace branches from.

- **Work Item** — intent. A ticket owned by a Work Item provider; **Argo stores only the
  link** (provider id + which port), never the content (title/status/body/blockers are
  read-through, cached but never authoritative). **No stored type** — "PRD" and "Task" are
  *roles derived from the hierarchy* (has children / is a leaf), normalized from whatever
  shape the provider uses (GitHub sub-issues, Linear milestone). `blockedBy` is a
  provider-sourced dependency DAG, Argo-normalized, with blocker states **verified directly**
  (the provider's summary count is stale). **Every provider is remote** — GitHub Issues /
  Linear via OAuth (Ports, below); no provider connected → no Work Items → all sessions
  unlinked. (A local-file/vault provider was considered and **descoped**.)

- **Delivery** — the product in flight: a **derived, branch-keyed** entity assembled per
  branch from local git facts ∪ code-host facts (PR/CI/review/merge). Not stored, not purely
  remote — derived. Comes into existence **at branch creation** (chat/planning sessions have
  no branch → no Delivery). One live Delivery = the current life of a branch; merge/close is
  its terminal state. May have **zero sessions** (a teammate's PR, assembled entirely from
  code-host facts). Deployment/Release are reserved **lifecycle nodes on its strip**, not
  sibling entities (unwired until a code-host deploy signal exists).

### L1 relationships — a triangle, not a chain

Three independent, optional, many-to-many edges (supersedes ADR-0013's "join only through
Delivery"):

- **Session → Work Item** — "what am I working on" (survives with no branch: a planning
  session pinned to a ticket). This is the one edge with no external signal → a
  **user-asserted link Argo persists**.
- **Session → Delivery** — "which branch / product am I moving."
- **Delivery → Work Item** — "what intent does this branch serve" (survives with no session:
  the teammate-PR case), derived via the join precedence (native-ref → id-in-branch →
  unlinked).

## L2 · Session

- **Session** — the observation unit: one **logical resume-chain**, keyed by a stable chain
  id (one-or-more transcript files stitched by `leafUuid`). The only stored classification is
  **`managed | external`** — no kinds (ADR-0013). `managed` = Argo spawned it, owns the PTY,
  companion plugin loaded → drivable + carries CONVENTION-tier facts. `external` = discovered
  from transcripts, read-only, no PTY. **All sessions are observed** (transcript-tailing is
  the floor); managed is *external + PTY steering + CONVENTION channel* layered on top —
  external is not extra spec, it is the baseline, and its DERIVED-liveness machinery is
  mandatory anyway for Argo's own sessions across a restart. v1 ranks external lower
  (read-only awareness), ships managed-first; foreign-session discovery may stage later.
  A Session **is the root Agent** (L3: `parentId: null`) — the node that additionally owns
  identity. Key attributes: **`cli`** (`claude | codex | …` — *which* program; the running
  session is ACP's "Agent", so the CLI program is named by this field, not by a separate
  "Agent" entity), **`cwd`** (DIRECT; the root of every L1-triangle derivation and of external
  liveness matching).

- **Transcript file** — the *physical* per-file CLI record (`<userData>`-external; owned by
  the CLI). One Session (logical chain) stitches one or more. Never itself called a "Session."

- **Session status** — a DERIVED rollup surfaced on the Session, from ACP `StopReason` +
  `request_permission` + the `AskUserQuestion` convention. Six states —
  `running · permission · asking · idle · stopped · ended`. Honesty-gated: `permission`
  (DIRECT) and `asking` (CONVENTION) are managed-only; **external floors at
  `running · idle · ended`**.

- **Session Mode** — the agent's *standing autonomy stance*: **`Ask | Plan | Code`** (locked
  in L3's autonomy cluster, below). DIRECT-observable for managed, tier-gated (not fabricated)
  for external.

- **`SessionFacts` — dissolved, not an entity.** Its members belong to already-named homes:
  git facts (`dirty/unpushed/headSha`) → **Workspace**; code-host facts (`pr/ci/review`) →
  **Delivery**; liveness/mode → **Session status/Mode**. Naming it as an entity would
  duplicate those homes and invite drift. What is real is the honesty tier on each fact, not
  the bundle.

## Honesty tier (cross-cutting)

A property **of each rendered fact**, not a session-wide mode — one Session mixes tiers.

- **DIRECT** — Argo owns the fact (managed pid, a mode Argo set).
- **DERIVED** — inferred from an observable signal (external liveness via process-match +
  mtime; the `~n%` context estimate).
- **CONVENTION** — arrived over the companion-plugin/MCP channel (managed-only; e.g.
  `report_status`); never existed in a transcript.

**Orthogonal to quality/Score** — tier is provenance confidence (*how we know*), never
output quality (*was it good*); the Score/eval slot stays empty for v1. **Degrade-down rule:**
ambiguity always resolves toward the lower tier / quieter state — **Argo never renders a false
DIRECT** (ADR-0008, generalized).

## L3 · Runtime tree

_Names re-derived from what Claude Code / Codex / Cursor / ACP + observability tools (OTel,
LangSmith, Langfuse) literally use — not the old `Actor`/`Run`/`Phase` coinages. `Actor` is
dropped (zero prior art; misleading Actor-model / GitHub-`actor` baggage). `kind: session |
agent` is dropped (every spec treats a session **as** an agent) — root-vs-child is carried by
`parentId`, not a type tag._

### The tree

- **Agent** — a node in the execution tree, **recursive**. Root-vs-child by **`parentId`**
  (root = `null`), never a `kind` discriminant. Matches ACP's top-level `Agent`, CC's `Agent`
  tool, and the one-recursive-node model of OTel `span` / LangSmith `run`.
- **Session** — the **root Agent** (`parentId: null`); see L2 for its identity fields. ACP's
  "Agent" (the CLI program) *is* the root Agent — the collision dissolves.
- **Subagent** — a **non-root Agent** (a delegated child). Unanimous term across CC / Codex /
  Cursor; reserving `Agent` for the node and `Subagent` for the child is how those tools
  disambiguate. Recursive (a subagent may spawn subagents).
- **Turn** — one exchange within an Agent: **prompt in → stop reason out**. First-class in ACP
  ("prompt turn") and Codex (`TurnContext`); synthesized from the DAG for CC. Stop reason ∈
  `end_turn · max_tokens · max_turn_requests · refusal · cancelled` (ACP's enum, adopted
  agnostically).
- **Tool Call** — the atomic observable action within a Turn (kind read/edit/execute/search/…,
  status pending/in_progress/completed/failed, target file, diff). *The* unit users watch
  scroll by (ACP-native).
- **Plan** — the agent-authored live to-do list within a Turn: `PlanEntry[]`, status
  `pending | in_progress | completed` (ACP `Plan`; CC's TodoWrite maps onto it). Distinct from
  Work Item (external intent) and from Delivery lifecycle.
- **Compaction** — a marker in an Agent's Turn sequence where history was condensed; the
  resume-chain stitches across it.
- **Usage** — a per-Turn value (tokens in/out, cache, cost, context used/size), DERIVED, rolled
  up to the Session. Not a tree node — a fact on Turn + Session.

**No "Run"/"Dispatch" grouping object, and no "Phase" entity** — both dissolved. `Run` collides
with LangSmith's single-unit `Run`; none of the CLIs have a runtime "Phase". Multi-agent
structure lives as **derived rendering over the tree** (below), not as a stored object.

### Sub-agent grouping — a derived blueprint, not an object

Two **optional, tier-gated attributes on a Subagent**, populated only when the CLI exposes them
and **absent, never fabricated, when it doesn't**:

- **`label`** — what this subagent is doing ("research: auth flow").
- **`group`** — the named phase/stage it belongs to ("Verify").

The **blueprint** ("3 researching, 2 queued to verify") is a DERIVED rollup — sibling Subagents
grouped by `group`, counted by status — with honest degradation across CLIs:

- **Claude Code** → full phased blueprint (Workflow exposes labels + phases + counts).
- **Codex** → labeled subagent tree (parent/child + path addresses, **no** phases).
- **Cursor / bare** → flat "N subagents running" (the DIRECT floor).

The cockpit never invents a phase a CLI didn't report; richer tools simply render more.

## L4 · Delivery detail

The Delivery lifecycle strip has nodes **commits · pr · ci · review · merge** (+ reserved
**deploy · release**, unwired — L1/D5). The sub-entities below hang off those nodes. All are
DERIVED from local git ∪ code host — **and code-host-sourced facts keep the host's vocabulary
verbatim** (Check names, PR states, review verdicts are never renamed or normalized;
renaming would misrepresent what we observed).

- **Diff** — the change-set of a Delivery (branch vs base), **git-addressed by commit SHA**
  (ADR-0008: refs are SHAs, never fabricated; no commit → no stable ref). The "what changed."

- **Review** — a submitted review round against a Delivery (matches the code host's own
  entity): `verdict` (`approve | request-changes | comment`, host's terms), author, reviewed
  SHA. Source-tiered: a teammate's review via the code host (DERIVED) or Argo's code-review
  skill (CONVENTION). The skill is a *source* of a Review — never call the entity "code
  review."

- **Finding** — an individual resolvable issue within a Review: `severity: blocking |
  advisory`, `state: open → addressing → fixed`. "N unresolved" is a derived count.

- **Check** — one observed CI check on a Delivery: **name verbatim from the code host** +
  status, DERIVED, rolling into the `ci` lifecycle node. **One level only — no Job/Step
  tree** (deferred drill). **Local lint/test is deliberately *not* modeled**: the cockpit
  observes git state (dirty/unpushed, DIRECT) but never runs or parses tooling — CI is the
  authoritative pass/fail, and local enforcement lives in pre-commit hooks + prose. Before a
  push/PR there are simply no Checks ("no CI yet"), never a reimplemented local runner.

- **Outcome** — the durable, git-addressed, provenance-tiered record of **what a Session
  produced**. Session-keyed and **persisted** (ADR-0008: a CONVENTION-tier outcome may never
  have existed in a transcript), which is why it survives distinct from the live-derived,
  branch-keyed Delivery. Broader than code — its content spans **code** (a Diff/Delivery),
  **tickets** (the `produces` edge → created Work Items), and **artifacts** (plans, research
  files). It is the concrete form of the `produces` link.

### Observation surface (agnostic across CLIs)

- **Terminal** — the **live, steerable** view of a session: a real PTY Argo owns. Managed
  sessions only.
- **Transcript** — the **read-only replay** view: parsed from the CLI's on-disk record. Any
  session, external or historical. (Same substrate as L2 "transcript file"; this is the
  rendered read-only mode.)

### Autonomy cluster

- **Mode** — the agent's *standing* autonomy stance: **`Ask | Plan | Code`** (Ask = gate every
  action; Plan = read + propose, no edits; Code = act autonomously within permissions).
  DIRECT for managed, tier-gated for external. Mode sets how often Permission fires.
- **Permission** — a *per-action* prompt the **agent** raises ("may I run this tool?"; ACP
  `request_permission`, options allow-once/always/reject-once/reject-always). DIRECT,
  managed-only; drives the `permission` session-status.
- **Gate** — **Argo's own** policy on automating *Delivery* steps (create-PR, merge,
  push-after-PR), each `ask | auto`. Argo-owned automation, **not** an agent prompt — a
  different actor and axis from Permission.

## Ports

Argo's two adapter ports — how **Argo itself** reads external truth. **Access is OAuth + the
provider's HTTP API, not the `gh` CLI** (the cockpit connects providers during onboarding and
stores per-machine tokens in the OS keychain; polled, since a desktop app receives no
webhooks). `gh` remains how *agents* operate the repo (AGENTS.md) — a different layer.

- **Work Item provider** — sources intent. GitHub Issues / Linear for v1; pluggable. One
  interface, per-provider adapters.
- **Code host** — sources Delivery truth (PR/CI/review/merge). GitHub for v1. One GitHub OAuth
  grant can feed **both** ports (Issues + PRs); Linear is Work-Item-only.
- **MCP server** — *distinct from the ports above*: tool/context providers the **observed
  session** connects to (the CLI's own MCP servers). An observable Session attribute, **not**
  an Argo port. Deferred for v1.

## Experience (ADR-settled; seats over the model)

- **Concierge** — the voice interface + its router/brain (ADR-0007, spike-gated, **unbuilt**;
  only the orb *visual* exists). Deferred for v1.
- **Companion plugin** — the bundled plugin that makes a Session `managed` and emits the
  **CONVENTION** tier (`report_status`, the `asking` signal, subagent `label`/`group`). It
  *is* the mechanism behind CONVENTION-tier facts (ADR-0016).
- **Preview** — the cockpit-spawned single-slot dev-server pane, **Agent-scoped** (attaches at
  the tree node, ADR-0010/0011).

## Not domain entities

**Cockpit · Roster · Panels · rooms** — UI surfaces. They *render* the domain; they are not in
it, and are modeled at design time, not here.

## Relationships (the whole graph)

- **Project** `1—N` **Session**, `1—N` **Delivery**; scopes which **Work Item provider** +
  **Code host** are connected.
- **L1 triangle** (all optional, many-to-many): **Session—Work Item** (user-asserted,
  persisted), **Session—Delivery** (which branch), **Delivery—Work Item** (join precedence).
- **Agent tree**: **Session** *is* the root **Agent** (`parentId: null`); an **Agent** `1—N`
  child **Subagent** (recursive via `parentId`). Each **Agent** `1—1` **Workspace**
  (`main | worktree`) and `0..1` **Preview** — both node-scoped (ADR-0010).
- **Inside an Agent**: `1—N` **Turn**; each **Turn** `1—N` **Tool Call**, `0..1` **Plan**,
  `1` **Usage**; **Compaction** markers punctuate the Turn sequence.
- **Delivery detail**: **Delivery** `1—1` **Diff** (current change-set), `1—N` **Review**
  (`1—N` **Finding**), `1—N` **Check**.
- **Session** `1—N` **Outcome** (the `produces` link made concrete; refs a Diff / Work Items /
  artifacts).
- **Honesty tier** — an attribute on *every* rendered fact (DIRECT / DERIVED / CONVENTION),
  not an entity.
- **Autonomy** — **Mode** (standing stance) + **Permission** (per-action prompt) sit on the
  Agent/Session; **Gate** (delivery automation) sits on the Delivery. Distinct axes.
