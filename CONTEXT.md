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
  *roles*, taken from the **provider's declared type when it has one** (GitHub issue types,
  Linear's project/milestone/issue distinction) and **falling back to hierarchy** (has
  children / is a leaf) only when the provider carries none — so a childless PRD isn't miscast
  as a Task. `blockedBy` is a
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

- **Person** — a human actor, minimally **`me | other`**. Owns `Review.author` and the
  teammate distinction (a Delivery's teammate PR is authored by an `other`), and drives the
  "needs-**you**" attention signal. Not richer than this for v1.

### L1 relationships — a triangle, not a chain

Three independent, optional, many-to-many edges (supersedes ADR-0013's "join only through
Delivery"):

- **Session → Work Item** — "what am I working on" (survives with no branch: a planning
  session pinned to a ticket). Persisted as a **user-asserted link only as the fallback** —
  when there is no Delivery to derive it through (Session→Delivery→Work Item). A branch-backed
  link is *derived*, never also asserted; the assertion exists precisely for the branchless
  case (ADR-0017), so the edge is never double-sourced.
- **Session → Delivery** — "which branch / product am I moving."
- **Delivery → Work Item** — "what intent does this branch serve" (survives with no session:
  the teammate-PR case), derived via the join precedence (native-ref → id-in-branch →
  unlinked). When it derives to **unlinked** — a hand-named branch with no PR, the common case
  outside `/implement` — the user can **assert branch→ticket manually**, persisted like the
  branchless Session→Work Item link (ADR-0017). An assertion wins over a derived *unlinked*,
  never over a positive derivation. Without this escape hatch the whole triangle silently
  empties for ordinary branches.

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
  **Managed-ness is not durable across an Argo restart**: the PTY/steering channel dies with
  the owning Argo process and cannot be re-adopted, so a `managed` session whose owner is gone
  demotes to **orphaned** — observation-only (transcript tier), steering unrecoverable
  (CONVENTION may re-establish only if the plugin re-dials CLI-side). Orphaned is an honest
  third posture of the `managed | external` axis, not a fourth stored kind.
  A Session **is the root Agent** (L3: `parentId: null`) — the node that additionally owns
  identity. Key attributes: **`cli`** (`claude | codex | …` — *which* program; the running
  session is ACP's "Agent", so the CLI program is named by this field, not by a separate
  "Agent" entity), **`cwd`** (**DIRECT for managed / DERIVED for external** — read from the
  transcript when Argo didn't launch the session; the root of every L1-triangle derivation and
  of external liveness matching).

- **Transcript file** — the *physical* per-file CLI record (`<userData>`-external; owned by
  the CLI). One Session (logical chain) stitches one or more. Never itself called a "Session."

- **Session status** — a DERIVED rollup on the Session, defined:
  - **running** — a Turn is in progress.
  - **permission** — blocked on an agent `request_permission` prompt.
  - **asking** — blocked on a structured `AskUserQuestion`.
  - **idle** — Turn ended `end_turn`, or no live signal; **includes an agent's free-form
    question** (indistinguishable from idle in the record — never fabricated as `asking`).
  - **stopped** — Turn ended on `max_tokens · max_turn_requests · refusal`.
  - **ended** — session terminated (`cancelled` or process exit).

  Honesty-gated: `permission` is DIRECT, **managed-only** (the prompt isn't reliably in a
  transcript). `asking` is **CONVENTION for managed, DERIVED for external** — `AskUserQuestion`
  lands in the transcript as a tool call, so an external session *can* show `asking`, **but
  only when "pending" is confirmable** from the record (a resolved question reads as `idle`; a
  false "asking" is a false-active, so degrade down when unsure). `stopped` needs a stop-reason
  an external transcript may not carry. So **external floors at
  `running · asking? · idle · ended`** (`asking` only when pending-confirmable); managed
  `permission`/`stopped` collapse to `idle`/`ended` when observed externally.

- **Session Mode** — the Session's *standing autonomy stance*. **Defined once in the Autonomy
  cluster** (below); it is a Session (root-Agent) fact, not a per-Subagent one. DIRECT for
  managed, tier-gated (not fabricated) for external.

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
DIRECT** (ADR-0008, generalized). Every tier-gated enum (Mode, status, context%) carries an
explicit **`unknown`/absent** rendering — a fact that can't be established honestly is shown as
unknown, never defaulted. Two known DERIVED soft-spots to render honestly, not hide: external
liveness (process-match on `cwd` + mtime is **not a unique key** — two `claude` in one repo can
mis-match, and mtime goes stale during long "thinking", so it can read live-as-idle); and
`~n%` context (the window denominator is model-dependent and may be unnamed in the transcript).

## L3 · Runtime tree

_Names re-derived from what Claude Code / Codex / Cursor / ACP + observability tools (OTel,
LangSmith, Langfuse) literally use — not the old `Actor`/`Run`/`Phase` coinages. `Actor` is
dropped (zero prior art; misleading Actor-model / GitHub-`actor` baggage). `kind: session |
agent` is dropped (every spec treats a session **as** an agent) — root-vs-child is carried by
`parentId`, not a type tag._

### The tree

- **Agent** — a node in the execution tree, **recursive**. Root-vs-child by **`parentId`**
  (root = `null`), never a `kind` discriminant. Prior art for dropping a `session|agent`
  discriminant: neither OTel spans nor LangSmith runs distinguish a *session* node type from an
  *agent* one — the root is structural (position), not a type tag. (Both *do* carry a per-node
  operation/`run_type` kind — which Argo re-expresses as the separate **Tool Call** entity, not
  on the node.)
- **Session** — the **root Agent** (`parentId: null`); see L2 for its identity fields. Three
  distinct referents are kept straight rather than fused: **(a)** ACP's program-level "Agent"
  = the CLI program, represented by the root Agent's identity + `cli`; **(b)** the tree
  **node** = any `Agent`; **(c)** CC's "Agent"/Task tool = the *mechanism that spawns* a
  Subagent. One node, three roles — enumerated, not "dissolved."
- **Subagent** — a **non-root Agent** (a delegated child). Unanimous term across CC / Codex /
  Cursor; reserving `Agent` for the node and `Subagent` for the child is how those tools
  disambiguate. Recursive (a subagent may spawn subagents).
- **Turn** — one exchange within an Agent: **prompt in → stop reason out**. First-class in ACP
  ("prompt turn"); an internal per-turn context in Codex (`TurnContext`, an implementation
  struct, not a protocol surface); synthesized from the DAG for CC. Stop reason ∈
  `end_turn · max_tokens · max_turn_requests · refusal · cancelled` (ACP's enum, adopted
  agnostically), plus **`unknown`** for CC where the reason can't be inferred from the DAG —
  never guessed.
- **Tool Call** — the atomic observable action within a Turn (kind read/edit/execute/search/…,
  status pending/in_progress/completed/failed, target file, diff). *The* unit users watch
  scroll by (ACP-native).
- **Plan** — the agent-authored live to-do list within a Turn: `PlanEntry[]`, status
  `pending | in_progress | completed` (ACP `Plan`; CC's TodoWrite maps onto it). Distinct from
  Work Item (external intent) and from Delivery lifecycle.
- **Workspace** — the git working context attached to an Agent: `kind: main | worktree`, plus
  `branch`, `baseRef`, `dirty`, `unpushed`, `headSha`, `ahead`/`behind`, `sharedCount`. **The
  join key `branch` lives here** — Delivery is keyed by `Workspace.branch`. Node-scoped
  (ADR-0010): an Agent has **`0..1` owned** Workspace and otherwise **inherits its parent's** —
  a Subagent without its own worktree renders no second chip (the exact case ADR-0010 exists
  for). Tiers by session class: DIRECT for a managed Agent (Argo created the worktree), DERIVED
  for external (read from git). Every owned Workspace branches from the Project's shared base
  ref.
- **Compaction** — a marker in an Agent's Turn sequence where history was condensed; the
  resume-chain stitches across it.
- **Usage** — token/cost/context telemetry, DERIVED, rolled up to the Session. Not a tree node
  — a fact on Turn + Session. *Partially ACP-informed, not one ACP object*: context `used`/
  `size` + `cost` map to ACP's session-level `UsageUpdate`; per-turn in/out tokens map to ACP's
  `PromptResponse.usage` (RFD-stage, unpopulated in real agents today); **cache tokens are not
  in any ACP shape** (a Claude-specific extra). **Cost is derived from an Argo-owned, versioned
  pricing table** — a rebuildable owned-state, staleable on provider price changes.

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

- **Outcome** — the durable, provenance-tiered record of **what a Session produced**;
  Session-keyed and **persisted** (ADR-0008: a CONVENTION-tier outcome may never have existed
  in a transcript), which is why it survives distinct from the live-derived, branch-keyed
  Delivery. It is the `produces` edge made concrete, pointing at a **typed target** — each
  addressed in *its own* space, so there is no single "git-addressed" claim: **code** (a
  Diff/Delivery, git-addressed by SHA), **ticket** (a created Work Item, provider-id-addressed),
  or **artifact** (a plan/research file, path-addressed, possibly uncommitted). v1: **external
  sessions have no Outcome** (no plugin to emit one; not back-derived) — an honest gap, not a
  fabricated record.

## Observation surface (cross-cutting; agnostic across CLIs)

- **Terminal** — a PTY Argo owns, running in a Workspace's cwd. As an *observation* surface it
  is the **session terminal**: the live, steerable view of a managed Session (managed-only).
  Argo also opens agent-less **scratch terminals** — see Files, editing & shell.
- **Transcript** — the **read-only replay** view: parsed from the CLI's on-disk record. Any
  session, external or historical. (Same substrate as L2 "transcript file"; this is the
  rendered read-only mode.)

## Autonomy cluster (cross-cutting)

- **Mode** — the **Session's** *standing* autonomy stance (a root-Agent fact, not
  per-Subagent): **`Ask | Plan | Code`** (Ask = gate every action; Plan = read + propose, no
  edits; Code = act autonomously within permissions), plus **`unknown`** when unobservable.
  DIRECT for managed, tier-gated for external. Mode sets how often Permission fires. *Argo's
  own triplet* — informed by ACP's illustrative example (`ask/architect/code`) and CC's `plan`
  mode, but **not an ACP term** (ACP is sunsetting dedicated mode methods). The `Plan` **mode**
  value ≠ the `Plan` **entity** (L3 to-do list) — distinct senses, never in one clause.
- **Permission** — a *per-action* prompt the **agent** raises ("may I run this tool?"; ACP
  `request_permission`, options `allow_once · allow_always · reject_once · reject_always`).
  DIRECT, managed-only; drives the `permission` session-status.
- **Gate** — **Argo's own** policy on automating *Delivery* steps (create-PR, merge,
  push-after-PR), each `ask | auto`. Argo-owned automation, **not** an agent prompt — a
  different actor and axis from Permission.

## Files, editing & shell (Argo as a light agentic IDE)

Beyond *observing* agents, Argo directly views/edits files and runs commands — first-party
capabilities independent of any session (the user acting on the code, not through an agent).

- **File** — a path + content in a **Workspace**'s working tree (its branch/dir determines
  contents — so file views are Workspace-scoped, not Project-scoped). DIRECT (read from disk).
  The unit the explorer lists/searches and the editor views/edits. A first-party edit mutates
  the Workspace working tree → surfaces as Workspace `dirty`/`unpushed` (no separate state).
- **File explorer / lightweight editor** — UI surfaces (not domain entities): browse the
  Workspace tree, filter/search by path + content, view and *light*-edit. Explicitly **not** a
  full IDE — enough to read structure and make small edits.
- **Open in editor** — an action on a File or the Project: open in Argo's built-in lightweight
  editor, or **hand off to an external editor** (VS Code, etc.). A capability, not an entity.
- **Scratch terminal** — a plain **Terminal** (PTY) Argo opens in a Workspace's cwd, attached
  to **no Agent/Session**, for running commands directly. Same PTY machinery as a session
  terminal, minus the agent — the shell sibling of first-party file editing.

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
  **CONVENTION** tier (e.g. `report_status`). It *is* the mechanism behind CONVENTION-tier
  facts (ADR-0016). Note: subagent `label`/`group` are **not exclusively CONVENTION** — their
  tier follows their source (CONVENTION when the plugin reports them; DERIVED when the CLI's
  own transcript carries them, e.g. a CC Workflow's phases). See the L3 blueprint's per-CLI
  degradation.
- **Preview** — a **cockpit-level singleton** (at most one across the whole cockpit; starting
  one stops the running one — ADR-0011) that *points at* an Agent. So the edge is per-Agent
  `0..1` *attachment*, but the running instance is global-single, not one-per-node.

## Not domain entities

**Cockpit · Roster · Panels · rooms** — UI surfaces. They *render* the domain; they are not in
it, and are modeled at design time, not here. The **Hub** (main-process in-memory projection
that assembles the join — ADR-0005/0017) and the **transcript-tailing parser** are runtime
*mechanisms*, likewise not domain entities.

## Relationships (the whole graph)

- **Project** `1—N` **Session**, `1—N` **Delivery**; scopes which **Work Item provider** +
  **Code host** are connected.
- **L1 triangle** (all optional): **Session—Work Item** (branchless-fallback assertion, else
  derived), **Session—Delivery** (**`0..1` at a time**, N over a resume chain — a chain can
  check out different branches), **Delivery—Work Item** (join precedence, **user-assertable
  when unlinked**). Many-to-many holds only *across time*; at any instant a Session is on at
  most one branch → one Delivery.
- **Agent tree**: **Session** *is* the root **Agent** (`parentId: null`); an **Agent** `0..N`
  child **Subagent** (recursive via `parentId`). Each **Agent** owns **`0..1` Workspace** (else
  inherits its parent's) and attaches **`0..1` Preview** — both node-scoped (ADR-0010); Preview
  is additionally a **cockpit-level singleton** (one running instance globally). A **Workspace**
  holds `0—N` **File** (its working tree; the explorer/editor surface).
- **Inside an Agent**: `1—N` **Turn**; each **Turn** `0—N` **Tool Call**, `0..1` **Plan**,
  `0..1` **Usage**, rolled up to a **Session**-level Usage; `0—N` **Compaction** markers
  punctuate the Turn sequence.
- **Delivery detail**: **Delivery** `1—1` **Diff** (current change-set), `0—N` **Review**
  (`0—N` **Finding**), `0—N` **Check**, and `1—N` **Gate** (per automatable step).
- **Session** `0—N` **Outcome** (the `produces` link; each refs a typed target —
  **Diff/Delivery** | **Work Item** | **artifact**). External sessions: none in v1.
- **Session** `0..1` **session Terminal** (live PTY, managed-only) and `0—N` **MCP server**
  (observed attribute, deferred); a **Workspace** additionally has `0—N` agent-less **scratch
  Terminal**.
- **Person** (`me | other`) authors a **Review** and owns the teammate-PR distinction on a
  **Delivery**; drives "needs-you" attention.
- **Honesty tier** — an attribute on *every* rendered fact (DIRECT / DERIVED / CONVENTION),
  not an entity.
- **Autonomy** — **Mode** (standing stance) + **Permission** (per-action prompt) sit on the
  **Session**; **Gate** (delivery automation) sits on the **Delivery**. Distinct axes.
