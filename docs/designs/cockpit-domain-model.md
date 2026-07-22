# Cockpit domain model — Work · Session · Delivery

The entity model behind the cockpit, grilled out to be unambiguous before layout.
Extends the CONTEXT.md glossary (which is the terse canonical form); this doc carries
the reasoning, cardinalities, and the two-port architecture. The visual "what shows
when" spec is its sibling `cockpit-surface-matrix.md`; the cockpit rendering itself is
being re-derived first-principles under wayfinder #157.

## Product stance (what we design for)

The cockpit is **designed for the fully-wired install**, and degrades honestly below it.

- **Design target.** Argo bundles its companion plugin (installed at setup) **and** a
  connected Work Item provider (established during onboarding). The backlog, work-item
  links, and prioritization are **spine, not optional** — that layer is the USP; without
  it the cockpit is "Claude CLI with a window."
- **Graceful fallback is a floor, not a target.** No provider connected, or an external
  (unmanaged) session → the dependent surfaces hide cleanly, nothing crashes. Supported,
  never optimized for.
- **Everything is provider/adapter based** so it scales (see *Two ports*).
- **Voice / Concierge is tier-independent** — always available, narrates whatever is present.

### Honesty tiers (from CONTEXT.md — the grading, unchanged)

Every rendered field carries a provenance grade; nothing is FABRICATED.

- **DIRECT** — read straight from git or the CLI transcript, zero inference (diff, branch,
  SHA, console, "PR merged").
- **DERIVED** — computed/estimated by Argo, fragile (work-item↔session link, progress
  roll-ups, the "what's next" ranking). Rendered a touch more quietly.
- **CONVENTION** — trustworthy only because an Argo skill/the plugin owned the prompt+output
  (committed plan, Outcomes, `/code-review` verdict, delegated-gate narration).

The tiers *are* the graceful-degradation ladder: DIRECT works with nothing installed;
DERIVED lights up with a connected provider; CONVENTION lights up with the bundled plugin.
The DIRECT layer must be coherent on its own.

## Project — the scope

The entity that owns adapter config, and **the** scoping rule of the app.

```
Project:
  id / name
  repo root                 # local checkout + its worktrees
  workItemProvider config   # v1: GitHub Issues
  codeHost         config   # v1: GitHub
  previewSources[]          # already project-declared (CONTEXT.md)
```

- `Session ──belongs to──▶ 1 Project` — DIRECT (the CLI runs inside the project's
  tree); a session is never project-less or cross-project. Work Items and
  Deliveries scope to the project via its two port configs.
- **Onboarding = creating a Project**: point at a repo, connect the two ports.

**Scoping rule (one sentence): the window shows one active project; the only
cross-project surfaces are the project strip and the Concierge.**

- **Project strip** — a thin vertical tab strip (Slack-workspace idiom), one icon
  per project, carrying the attention badge (another project's session needs
  input → its icon glows). Click = switch; the whole window swaps.
- **Concierge** — the voice is global by nature (one mic, one user); it may
  narrate cross-project ("the day-job session is waiting on you").

Everything else — Roster, Work room, home, orb — inherits the active project with
zero per-surface decisions. Project is a *scope*, never a per-surface grouping
facet.

## The three axes

Three distinct entities. **Never fused** — an earlier draft collapsed Session and Work Item
into one list, which is the modelling mistake this doc exists to prevent.

### 1. Work Item — *intent* ("what should be done")

A ticket or sub-ticket. **The Work Item provider is the single source of truth; Argo never
stores Work Items, it always reads them.**

```
Work Item:
  id                       # provider identifier: #42 (GitHub) | ARG-42 (Linear) | PROJ-42 (Jira)
  type      PRD | Task
  state     todo | in-progress | in-review | done | closed   # the PROVIDER's status field
  parent    → 0..1 Work Item        # hierarchy → this is a sub-ticket
  blockedBy → * Work Item           # dependency DAG; authored by the LLM at spec-time, stored in provider
  priority                          # provider field — a *sort*, not a judgement
```

- "PRD", "issue", "sub-issue" are **not separate entities** — a `type` field + a `parent`
  link on one entity.
- **Raw ideation is a stage, not an entity** — it lives in the grill (a normal chat) and
  becomes a Work Item only when promoted to the provider.
- A parent (PRD) is never worked directly; its **sub-items** are, and its progress is their
  roll-up (`3/5 sub-issues landed`).

### 2. Session — *observation* ("what an agent is doing")

A stock agentic CLI run observed by the cockpit (the CONTEXT.md *Session*: managed vs
external, spanning a resume-chain, owning an Actor tree of Agents/Runs).

```
Session:
  id
  managed | external      # the only stored distinction: PTY+plugin vs transcript-only
  Actor tree (Agents, Runs)
```

**A session has no `kind`.** What a session *is* emerges from its links, all
observable — a stored type would fabricate a genre the session can outgrow (an
implement session drifts into chat; a chat types `/implement 42` halfway; a chat
produces tickets via `/grill-me` or a one-liner):

| observed links | the session renders as |
|---|---|
| intent ticket and/or Delivery | implementing — "working on #42" |
| `produces` links | it created tickets — listed in session detail |
| neither | just a session |

Grilling is a *stage* of the workflow (a skill run inside an ordinary chat), never a
session type; its effect is captured entirely by the `produces` link. A session that
writes tickets does so itself (agent runs the adapter under user gesture) — render-only
holds; the cockpit just observes the links.

### 3. Delivery — *product in flight* (the bridge)

**Keyed to the branch → PR, NOT owned by a Session.** This is what carries the delivery
lifecycle (`Commits→PR→CI→Review→Merge`; cockpit rendering re-derived under wayfinder #157).

```
Delivery:
  branch                   # identity
  pr        → 0..1         # once opened
  lifecycle (Commits→PR→CI→Review→Merge)
  head_sha
```

Sourced from the **code host** (+ local git). A Delivery **can exist with zero Sessions** —
e.g. a teammate's PR, or a branch pushed outside Argo. That is a first-class honest state:
*Delivery exists, Session doesn't* (PR state comes from the code-host API; there is no
session card because no local run is observable).

## Relationships

```
Work Item  ──parent────▶  Work Item          0..1   hierarchy (sub-ticket)
Work Item  ──blockedBy──▶ Work Item          *      dependency DAG
Work Item  ◀──addresses──▶ Delivery          *..*   join: see Two ports
Delivery   ──closes─────▶ Work Item          1..*   PR "closes #42, #43"
Delivery   ◀──contributes commits── Session  *..*   local observable runs only; may be 0
Session    ──produces───▶ Work Item          *      PROVENANCE ONLY (links shown in session detail)
Session    ──intent─────▶ Work Item          0..1   managed implement: named at spawn
```

Consequences that were explicitly decided:

- **Session ↔ Work Item is many-to-many, always joined *through* Delivery.** Nothing stops
  one session opening two PRs against two tickets — that is just a Session with two
  Deliveries, each cleanly linked. No direct session→ticket link is stored or guessed
  (except the managed `intent`, which only labels a freshly-spawned session before any
  commit exists).
- **One-PR-per-session is a nudge, not a constraint.** The model represents reality; the UX
  discourages a second PR by making it *visibly heavier* (a second lifecycle strip), never
  by blocking it. The "one primary control on screen" rule relaxes to *one per active
  Delivery*.
- **`Session ──produces──▶ Work Item` is provenance, not ownership.** Tickets created in a
  session (grill/chat, or a quick "create ticket" gesture) live in the provider; the session
  detail shows *links* to them, tagged "created here".
- **Tickets need no session.** A ticket added directly in GitHub/Linear/file just appears —
  the provider is the source of truth.

### Work Item state vs Delivery lifecycle — not the same thing

- **Work Item state** (`todo · in-progress · in-review · done · closed`) is the **provider's**
  field. Argo reflects it and writes it on key transitions (implement → `in-progress`).
- **Delivery lifecycle** is the **code-host/git** reality.

They reconcile but stay separate: a ticket can read `in-progress` while its Delivery sits at
`PR open · CI running`.

## Two ports (the extensible architecture)

Tickets and code are **two different sources**, each an adapter behind a port.

| Port | Sources | v1 adapter | Later |
|---|---|---|---|
| **Work Item provider** (intent) | tickets, hierarchy, dependencies, status | **GitHub Issues** | Linear, Jira, file vault (deferred) |
| **Code host** (delivery) | branches, PRs, CI, closing-refs | **GitHub** | GitLab, local-git-only |

They are *often* both GitHub, but **Linear tickets + GitHub PRs** is the common real case, so
they must be separate ports. v1 pins both to GitHub; the split exists so nothing else changes
when a port diverges.

### The join — native-first, id-in-branch fallback

How Work Item ↔ Delivery is linked, in precedence order:

1. **Native provider link (DIRECT).** GitHub exposes it directly — `closes #42` closing-refs
   on the PR + issue↔branch/PR development links. Argo reads it; no parsing. (This is the v1
   path since both ports are GitHub.)
2. **Argo emits the canonical signal** so #1 is always present: on `/implement 42` it names the
   branch with the id and writes `closes #42` into the PR body. Argo authors the standard link
   the standard way, then reads it back natively.
3. **Fallback — parse the id token from the branch/PR name.** This is exactly how Linear
   (`ARG-42` in the branch) and Jira (`PROJ-42`) work — the established industry convention,
   not a hack. Carries the link when the two ports are not natively integrated (future file
   vault, Linear-before-integration).

Precedence: **native reference → id-in-branch/PR-name → unlinked (honest gap, never guessed).**

Each **Work Item provider** adapter declares its **id format** and canonical **branch-name
pattern**; each **Code host** adapter exposes branches/PRs/CI + native closing-refs if it has
them; a small **linker** joins them. Add GitLab = a code-host adapter; add Linear = a work-item
adapter declaring `ARG-…`. Nothing else changes.

## Identity clarification

The cockpit is **render-only over agents** — it never orchestrates them. It **is** a
read/write **client of the Work Item provider**: editing or creating a ticket via gesture is
fine (you clicking, like any GitHub client), and **Implement** spawns a managed session (the
sanctioned gesture). "Never orchestrates" is about *agents*, not *tickets*.

`/implement 42` from the Work Items view and typing `/implement 42` into a session are the
**same act** — the button is a shortcut that spawns a session pre-loaded with the ticket.
Effect: create the branch for the ticket, flip the Work Item to `in-progress`. It creates
**links, not a type** — the session it spawns is an ordinary session whose intent/Delivery
links happen to be pre-established.

## The lifecycle arc

The workflow is longer than the cockpit. Stages, and where each lives:

| # | Stage | Home | Notes |
|---|---|---|---|
| 0 | **Grill / spec** | a skill run in an ordinary chat session → writes tickets to the provider | first-class; a stage, never a session type — captured by the `produces` link |
| 1 | **Ideate** | provider (or the grill) | referenced, not authored in the cockpit |
| 2 | **Plan** | Session (Activity) | the agent's committed approach (CONVENTION) |
| 3 | **Build** | Session (Activity + Console) | live "what's happening" |
| 4 | **Code** | Delivery (Changes) | the diff — file level by default |
| 5–9 | **Commit · PR · CI · Review · Merge** | Delivery lifecycle | rendering re-derived under wayfinder #157 |
| 10 | **Deploy** | Delivery lifecycle (deferred) | a post-Merge node sourced from the same code-host CI/CD, keyed to the merge sha; the lifecycle grows a node on the right, no model change |
| — | **Preview** | cross-cutting | the running UI, on gesture, spans Build→Deploy |

## Views (surfaces) — two rooms inside the active project

Because Work and Runtime are distinct entities, they are distinct **rooms**, switched
by a top-level toggle (⌘1/⌘2) inside the project scope:

- **Work room (⌘1)** — the Work Items surface, full-width. Its *view* is switchable:
  kanban, or list + detail split (same layout family as the session screen). Ticket
  click → detail + status; editable; **Implement** is an action on it. Owns the full
  backlog and the ranked "what's next" judgement.
- **Sessions room (⌘2)** — Roster rail + session card (today's spine). Click a
  session → session detail. If the session's branch has a Delivery, the Delivery
  renders there (single home = the branch, shown in the session's context). Session
  detail also lists any tickets the session created. Zero-state (no session
  selected) = the bright orb + a single compact **Next up** card — a *pointer* into
  the Work room (same pointer discipline as R16 words), never the backlog itself.

### Prioritization — sort vs judgement

- **Provider priority is a *sort*** — Argo reflects it (DIRECT).
- **Argo's "what's next" is a *judgement*** (DERIVED) — reasoning over the dependency DAG
  (`blockedBy`), done-state, and sequencing to guide the developer's next move. Rendered as a
  suggestion with its reason visible (`unblocked · spec ready`), never fabricated certainty. If
  a provider lacks dependency data the judgement degrades to priority+state and says so.

## The disclosure principle (sets up the surface matrix)

**Not everything at once; nothing descoped.** Every stage stays in scope; the craft is what
shows at a glance vs. what is one gesture away. Each stage has a **collapsed (glance)** view
and an **expanded (drill)** view — e.g. collapsed timeline + current task → steps → tool calls;
review verdict + summary → findings → inline hunks; files + net ± → per-file → hunks. The
forthcoming surface matrix fills `Stage × Glance × Drill × Surface` for every stage.

## Open items (not yet decided)

- The **surface matrix** itself (`Stage × Glance × Drill × Surface`) — the next deliverable.
- **Deploy** node spec — deferred; extends the Delivery lifecycle post-Merge (see arc table), no model change.
- **File vault** work-item adapter — deferred past v1.
- **Assignee filtering** on Work Items / Deliveries — later.

Decided since first draft: **2-PR discouragement is visual weight alone** — the second
lifecycle strip is the message; no explicit note (it would restate what's visible and break
single-home). Escalation path if too subtle: the Roster word, never a banner.
