# Cockpit surface matrix — Stage × Glance × Drill × Surface

The "what shows when" spec. Companion to `CONTEXT.md` (entities — the domain model lives at the
repo root; `cockpit-domain-model.md` was deleted in the #180 consolidation) and
`cockpit-status-vocabulary.md` (the words). The
delivery-lifecycle rendering (nodes, staleness, one-control) is being re-derived
first-principles under wayfinder #157 — this doc's routing/panel references below are
provisional and reconcile as the surface tickets land.

**Principle: not everything at once; nothing descoped.** Every stage of the
workflow has a home. Each home has a **Glance** (a collapsed-but-real view — a
rich summary, not a lone word) and a **Drill** (the full detail, one gesture
away). Nothing requires a third gesture except leaving the app (deep links).

## Top-level surfaces

Scoping rule (domain model): **the window shows one active project; only the
project strip and the Concierge cross projects.** Inside the project, **three rooms**
switched by ⌘1/⌘2/⌘3 (Sessions is home; Code added by #183).

| Surface | Axis | Content |
|---|---|---|
| **Project strip** (far-left vertical tabs) | cross-project | one icon per project + attention badge; click = swap the whole window. Borderless — tabs float on the scene (#201); hover the active tab for project name + `last synced` |
| **Sessions room** (⌘1, home) | Runtime | Roster rail + session card; zero-state = the pinned `+ New session` row alone — ~~bright orb + one compact **Next up** pointer card~~, struck by B6 (see below) |
| **Work room** (⌘2) | Work | provider-backed tickets, full-width; views: kanban ⇄ list+detail split; owns backlog + "what's next" |
| **Code room** (⌘3) | Workspace | file explorer + lightweight editor + scratch terminal over the primary checkout; session-independent (#183) |
| **Merged top bar** | chrome | one floating band (#201): Concierge orb + caption · connection chip · room tabs · global git group. No wordmark, no project label, no ⌘K button |
| **Roster** (rail inside Sessions room) | Runtime | the observed Sessions of the active project |
| **Session card** | Runtime + bridge | panels: Activity · Delivery · Preview · Console |

The Delivery axis has no top-level surface of its own: a Delivery renders inside
whichever Session card you view it from (single home = the branch), and as linked
state on its Ticket.

## The matrix

| # | Stage | Glance (collapsed, always visible on its surface) | Drill (one gesture) | Surface |
|---|---|---|---|---|
| 0 | **Tickets produced by a session** (grilling is a skill in an ordinary chat, not a session type) | ordinary Roster row; session detail lists the tickets it produced (`produces` links, tagged "created here") | a produced ticket opens in the Work room; the chat itself via the session's Console | Roster → session detail |
| 1 | **Ticket** (ideate) | Ticket row: `id · title · state word · priority` — parents show child roll-up `3/5` | ticket detail: body/spec, sub-items, `blockedBy`, linked Deliveries (incl. teammate PRs), producing session if any, **Implement** action | Tickets view |
| — | **Next judgement** | one "Next up" card: ticket + reason (`unblocked · spec ready`) — ~~echoed as a pointer card on the Sessions-room zero-state~~, struck (see below) | the ranked list with reasons; full backlog | Work room only |
| 2 | **Plan** | current task line + plan progress (`3/7`) at the top of Activity | the committed plan, step states | Session · Activity |
| 3 | **Build** | collapsed timeline: now-line, latest steps, Background Tasks summary (R15) | steps expand to prose; a tool/agent row fills the Console capture slot (R13) | Session · Activity (+ Console) |
| 4 | **Code** | `Changes · 12` tab label + net ± | per-file diff → hunks; All-files (cumulative) default, By-commit toggle | Session · Delivery · Changes |
| 5 | **Commit** | lifecycle node state (`● 3 dirty` / `◆` / `✓`) | node drawer: commit list, local check output | Delivery lifecycle strip |
| 6 | **PR** | node state + strip anchor `PR #42 → main` | node drawer: PR meta, description, deep link ↗ | Delivery lifecycle strip |
| 7 | **CI** | node + aggregate first segment (`● 1 running`) | drawer: `runs[]` — one row per check, durations, failure note | Delivery lifecycle strip |
| 8 | **Review** | **verdict + summary is the default view** — never verdict alone as terminus: agent verdict hero in the Review tab; human verdict on the Review node | findings list → inline finding card in the diff (R14); human review in the node drawer | Delivery · Review tab (agent) / Review node drawer (human) |
| 9 | **Merge** | gate `◆ [Merge #42]` or terminal card (`Landed · sha · by · when`) | confirm step; terminal card links | Delivery lifecycle strip |
| 10 | **Deploy** | *deferred* — post-Merge node, same drawer pattern as CI | — | Delivery lifecycle strip |
| — | **Preview** | chip: `running · :5173 · ⎇ clean`; the panel is the running UI itself (no tier — it is the thing) | interact with it; source picker (project-declared only) | Session · Preview |
| — | **Outcomes** | "what got done" rows in Activity | click scopes the Delivery panel to that outcome's diff (`← All changes` return) | Activity → Delivery |
| — | **Session status** | Roster row: ONE word (R16 — delivery claim beats session status) + attention dot | open the session | Roster |

## Cross-cutting rules

- **Glance is rich, not a word.** A collapsed timeline, a verdict *with summary*, a
  file count *with net ±*. The single-word extreme lives only in Roster rows (R16),
  where triage speed wins.
- **Drill is one gesture.** Expand in place (Activity prose, node drawers) or switch
  the owning panel's scope (outcome → diff). Never a new window; deep links (↗) are
  the sanctioned exit to GitHub.
- **Routing owns natures** (provisional, re-derived under #157): time-keyed prose → Activity;
  raw I/O → Console channel; sha-keyed product → Delivery; remote → node drawer/deep
  link. The matrix above never violates it.
- **Two-Delivery sessions** render two lifecycle strips — the active one open, the
  other collapsed to its glance line. The weight is the discouragement.
- **Fallbacks:** no provider → Tickets view and Next judgement absent, Home falls
  back to Roster + orb; external session → CONVENTION rows (Plan, Outcomes, agent
  Review verdict) absent, their sections hide; no code host → lifecycle ends at
  Commit. Surfaces hide whole — no half-filled skeletons.
- **Hide-whole governs the *tier* axis only.** A fact that went **stale** (the provider
  was reachable and no longer is) stays rendered at full fidelity; staleness is a
  separate axis carried by the connection, not the fact. Mid-flight failure policy —
  staleness, the connection chip, write failures, missing folder — is owned by
  `cockpit-failure-states-spec.md` (#173).

## Open

- Deploy node spec (deferred, see domain model).

Decided since first draft: **navigation = three rooms (⌘1 Sessions · ⌘2 Work · ⌘3 Code)
inside a project-scoped window, with a far-left vertical project strip** (Slack-workspace
idiom) as the only cross-project surface besides the Concierge. Sessions is home — you land
in the running world. The backlog's home is the Work room. Chrome is one merged floating top
bar (#201); the Concierge rides in it rather than in a bottom strip.

**Amended by [#273](https://github.com/milad-alizadeh/argo/issues/273) — 2026-08-28:** this read
"the Sessions-room zero-state carries a single Next-up *pointer* card". **There is no pointer
card.** `cockpit-session-interior-decisions.md` B6 settled the roster zero-state as *"only the
`+ New session` button — no hero, no illustration, no orb foregrounding, no Next-up card, no
onboarding copy"*, and `cockpit-spec.md` §4.1 repeats it: a one-time transient state costs no
permanent chrome. Two later decisions against this one line, and both name the card explicitly, so
the line goes rather than the decisions. The hero lives in the Work room and only there — which
keeps the surface-matrix rule intact anyway: the ranked list has exactly one home.

The `spec ready` in the Next-judgement row above is left standing and is **not implemented**. It
would need an explicit provider label, never a read of the ticket's prose, and the approved
`cockpit-work-room.md` draws four chips of which it is not one. It stays here as an open design
question rather than being quietly deleted to match the code.
