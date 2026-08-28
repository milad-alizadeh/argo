# The cockpit spec — the assembled contract

> **Wayfinder [#157](https://github.com/milad-alizadeh/argo/issues/157), Phase 1, assembled
> ([#253](https://github.com/milad-alizadeh/argo/issues/253) /
> [#254](https://github.com/milad-alizadeh/argo/issues/254)).** What the cockpit is, stated once.
> Read this to learn the whole product without opening the map.
>
> **This is the join, not a replacement.** Every surface spec, the status registry, the failure
> policy, the surface matrix and `CONTEXT.md` remain the **detail of record**. Where detail
> exists, this document states the *decision* and cites the owner rather than restating it — so
> there is exactly one place any given fact can go stale.
>
> **The amendments are already applied.** #201 (Concierge into the merged top bar; toggle and
> backlog counters cut; chip placed first; `last synced` on the project-tab tooltip), #202 (no
> "enable worktrees" setting), and #178's audit (density → out of scope; the Tickets-room
> bulk/filtering residue) live only in closed issue comments. They are folded **inline** below,
> so the assembled read is the current read. A per-surface doc that reads differently is the one
> that is behind.
>
> **Ordering caveat.** #157 declared a sequential pipeline: Phase 1 (the map) → Phase 2 (design
> foundations into the token contract) → Phase 3 (fresh UI inventory / build contract) →
> development. This document does **not** skip Phase 2/3 — it is the assembled Phase-1 contract
> and the *input* those phases consume. The architecture in §11 is stated here because
> `CONTEXT.md` and the ADRs already force it, not because the build starts now.

## Documents of record

| Owns | Document |
|---|---|
| The domain model (entities, relationships, tiers) | `CONTEXT.md` (repo root) |
| Chrome, navigation, keymap, connective tissue, Project Settings, OS notifications | `cockpit-app-shell-spec.md` |
| Code room — explorer, editor, scratch terminal, worktree stance | `cockpit-code-room-spec.md` |
| Onboarding and project setup | `cockpit-onboarding-spec.md` |
| Mid-flight failure policy | `cockpit-failure-states-spec.md` |
| One word per state — the canonical registry | `cockpit-status-vocabulary.md` |
| What shows when — surface × state | `cockpit-surface-matrix.md` |
| Session interior — the grill behind the prototype | `cockpit-session-interior-decisions.md` |
| Pre-map architecture decisions | `docs/adr/0013`–`0018` |
| The approved pixels | `cockpit-sessions-liquid-glass.png` + `cockpit-visual-identity-decisions.md` |

> **The HTML prototypes this file cites no longer exist.** They were retired with the Electron
> cockpit (ADR-0023); `README.md` → *What left, and where it went* says why, and
> `git log --diff-filter=D -- docs/designs/` finds them in history. What this file decides still
> stands — read a `*-prototype.html` reference as a pointer to a settled decision, not to a file
> you can open.

The Sessions room and the Tickets room have **no written surface spec** — their detail lives in
`cockpit-session-interior-decisions.md` plus their prototypes. §4 and §5 below are therefore
the closest thing to a spec they have, and are correspondingly less thin.

---

## 1 · The shell and cross-project chrome

**One window shows one active project** (ADR-0015). Only the project strip and the Concierge
cross projects.

- **Project strip** — far-left, vertical, **borderless** (tabs float on the background), one tab
  per project. Each tab carries a **single worst-state dot**: amber `Needs input` > red `Stopped` >
  green `running` > none. The **active** project's tab stays quiet — the strip only ever points
  somewhere *else*. Hovering the active tab reveals the project name and **`last synced`**
  (#201 rehomed this off the deleted project label; tooltip only — the strip dot stays
  session-only).
- **One merged floating top bar** (#201) — no fill, no divider line, no reserved band pushing
  content down, so the lit Penumbra scene reads as one room. Two fixed regions, not four, and
  **no bottom chrome**: the bottom edge belongs to the room (e.g. the session Dock).
- **Bar order** — `[traffic lights] [orb + caption] ⋯ [connection chip] [Sessions ⌘1 · Tickets ⌘2 ·
  Code ⌘3] [⎇ branch ▾] [⋯]`. Reading order runs condition-of-the-world → where I am → what I am
  on. macOS traffic-light clearance (`hiddenInset`).
- **The Concierge orb and caption ride in the bar, globally**, surviving every room switch
  (#201 overrides #159's bottom strip on **position only** — global, persistent and state-bearing
  are unchanged; every room regains ~54px and #190 inherits a top anchor that expands downward).
- **The bar deliberately carries no** wordmark, project label, `⌘K` button, conversation-mode
  toggle (#201: chrome holds no seat for an undesigned subsystem — that is #190's), or backlog
  counters (#201: room content, which would blank out in two of three rooms — they fold into the
  Tickets rail's `BACKLOG · BY PRIORITY` row).
- **The connection chip is placed first in the right cluster** (#201) — a right-aligned cluster
  means appending would shove permanent chrome sideways the moment a silent element wakes up.
- **Global git group, in all three rooms, always the primary checkout.** `select · manage`.
  Select lists local branches and `origin` refs with ahead/behind under a header reading
  **"Files follow this"** — the relationship between control and file view is stated, not
  inferred. Manage offers **safe sync only** (fetch, fast-forward pull, push when ahead) plus
  branch CRUD; a diverged branch gets an escape hatch to the scratch terminal or an agent,
  **never a merge-conflict GUI**. **Hidden whole** when the project folder is not a git repo.
- **A worktree-held branch shows `worktree` and refuses checkout** — the label follows git
  (`git worktree list`), so it always renders and always refuses. The `↗ open its session` link
  follows the **session**: a live worktree deep-links, an orphaned one shows its **path** instead
  of a dead link. There is no `Remove worktree` action — Argo does not destroy git state it did
  not create (#202).
- **Switching projects is a view change, not a teardown** — sessions keep running, per-project UI
  state is remembered on return, the Preview singleton survives.

Detail: `cockpit-app-shell-spec.md` → *Canonical chrome*, *Global git / checkout chrome*,
*Connection chip*.

## 2 · Navigation, keyboard, and the command palette

- **Direct manipulation is the floor** — every action has a visible clickable affordance; nothing
  is keyboard-only. `⌘K` is the **power spine**, additive: search and run commands, jump to any
  session / ticket / project, spawn, transition. It is what lets the shell scale past a handful of
  sessions without inventing a new surface.
- **One canonical keymap, in one place** — `⌘1`/`⌘2`/`⌘3`, `⌘[`/`⌘]`, `⌘K`, `⌘N`, `⌘⏎`,
  hold `⌘␣`, `Esc`, `↑↓↵`, `⌘P`, `⌘E`. No surface invents a conflicting binding. The table is in
  `cockpit-app-shell-spec.md` → *Canonical keymap* and is not repeated here.
- **You land in Sessions on launch** — the running world, not a backlog.
- **Drilling keeps the chrome and returns on `Esc`.** Navigation never leaves the shell and never
  opens a window; deep links (`↗`) are the sanctioned exit.

## 3 · Onboarding and project setup

Onboarding **is** creating a Project (ADR-0015) — the panel is the project-setup surface, not a
gated wizard.

- **Two screens** — a plain-language Welcome (three benefit rows: what Argo does, before you are
  asked to connect anything) → a **Connect panel with three independent rows** (Folder ·
  Connections · Companion plugin) completable in any order. Nothing blocks anything.
- **A folder, not a repository, is the floor.** Git is optional; an empty greenfield directory
  creates a working project at the observation floor. Git and a provider *unlock* backlog / PRs /
  CI — they never gate entry. **`Create project` is enabled the moment a folder is set.**
- **One GitHub OAuth device-flow sign-in feeds both ports** (ADR-0018) — one grant, one
  authorization, keychain-stored per-machine tokens. The `connecting` state shows the user code
  and verification URL so the panel waits visibly rather than spinning blind.
- **Honesty tiers are internal only** — DIRECT / DERIVED / CONVENTION never appear on screen.
  Plain benefit copy instead of Argo's provenance vocabulary.
- **Error and expiry stay in-panel** — a revoked or expired grant re-enters this same panel with
  `Continue offline` and `Reconnect`. There is no separate connections screen to hunt for.
- **Project Settings is this panel re-entered on an existing project** (#202) — the same three
  rows, CTA reading `Done`, plus the project's **Agent/CLI** row. Entry via the project tab's
  context menu and `⌘K`.
- **There is no app-global Preferences surface, at all.** #188 refused one for a boolean, #202 for
  a toggle: surfaces exist for *work*, not settings.

Detail: `cockpit-onboarding-spec.md`; Project Settings in `cockpit-app-shell-spec.md` →
*Project Settings*.

## 4 · Sessions room (`⌘1`, home)

### 4.1 Roster rail

- The active project's **observed** sessions — the running world's one home.
- **Row = `dot · name · word` over `model · branch`.** A glance plus cheap disambiguation, and
  nothing more.
- **State is carried entirely by the dot's colour** — running green, idle grey, needs-you gold,
  failed/blocked red, external **hollow**. Planes and words stay neutral: one channel says each
  thing once. An external session is ghosted, so read-only awareness looks different from a
  session you can drive.
- **An external row also carries a padlock, beside the name** — the composer's own mark for the
  same posture. Ghosting alone reads as *quiet* beside an idle session that is fully drivable, and
  which rows accept typing is not a thing to infer from ink density. The mark is the **external**
  row's alone: an orphaned row is ghosted without it, because selecting one resumes the chain
  (ADR-0026), and a padlock on a row one click from drivable would be a lie.
- **The single word is chosen by priority** — attention needs-input → attention failure →
  delivery milestone → liveness → kind. A delivery claim **beats** session status, so a session
  mid-delivery reads `CI failed`, not `running`.
- **Order is stable by most-recent activity, and attention never reorders the list** — the rail
  does not churn under you.
- **`+ New session` pinned quiet at the top, `⚙ Archived (n)` at the foot.** With no sessions at
  all the zero-state is *just* the `+ New session` row — a one-time transient state costs no
  permanent chrome.
- **`⌘N` spawns zero-config at the project root** into the active project. A session leaves the
  roster for Archived **only when you archive it** — archiving is an act, never a status
  transition.
  - **Amended by [#502](https://github.com/milad-alizadeh/argo/issues/502) — 2026-08-10:** this
    read "a finished or merged session leaves the roster automatically … archiving is a status
    transition, never a button". Overturned because a merged Session is often exactly the one you
    go back to, so the roster may not clear it on the branch's behalf.

### 4.2 Session interior

- **The header is one band** — a large context ring left, then title over a single meta line, tabs
  bottom-aligned right. Two bands collapsed into one, and it carries **no action buttons and no
  `⋯` menu**: glance only.
- **Title resolves through a stable fallback chain** — explicit name → linked ticket →
  conversation-derived — and never rewrites per turn, so rail and header always match.
- **Meta line order: `status · model · mode · branch(+∆/↑) · elapsed · intent ↗`** — the natural
  triage sweep. When the session is titled from its ticket the intent chip collapses to `#<n> ↗`
  so the link never echoes the title.
- **The context ring shows an honest `~n%`**, and an **empty** ring reading `unknown` for external
  sessions. An estimate is never dressed as a measurement.
- **Exactly two tabs — `Activity · Delivery`** — each a distinct domain cluster, no overlap.
- **An always-on expandable Dock sits beneath both tabs**, holding the live PTY with the now-head
  (current task + plan `N/M`) in its header row. Live-process state is visible across tabs without
  its own strip. **You steer by typing at the Dock's prompt and stop with Ctrl-C** — there is no
  separate steer widget and no Stop button.
- **Activity is two-pane master–detail** — left holds a `Subagents` group above a `Timeline` step
  list, right holds the selected item's detail. Thirty subagents render as a **dense row list**
  (`dot · name · target · status`) inside one collapsible group — never interleaved into the
  timeline, never as cards — and clicking one shows that agent's live feed in the detail pane
  without leaving the session.
- **The subagent blueprint degrades honestly per CLI** — full phased blueprint for Claude Code, a
  labelled tree for Codex, flat "N subagents running" for bare. The cockpit never invents a phase
  a CLI did not report.
- **Compaction markers render in the turn sequence with the resume chain stitched across them**,
  so a condensed history reads as continuous.

### 4.3 Delivery

- **One review surface across the pre-PR / PR-open boundary**, reshaping only its rail and its
  call-to-action. Review before the PR and review after it are the same object.
- **One control line** — `[Overview · Code Review · Files]` tabs, the
  `commits — pr — ci — review — merge` rail, and a single CTA. The rail is a **state readout, not
  navigation** — it never tries to be a router.
- **No free-text status string.** Blocking findings are a red badge on Code Review, file count is
  `Files (N)`, CI and review state are implicit in the rail's live/wait nodes.
- **Overview leads with the digestible `WHAT / WHY`** and a table of narrated changes that expand
  to their hunks — a huge agent diff is legible before you read code.
- **Code Review is the primary surface** — a severity-ranked findings inbox with evidence inline
  and `Apply fix · Dismiss`. Review is the actual bottleneck, so it gets the front door; **Files**
  (GitHub-style sticky tree plus gutter diff, per-file `Viewed`, findings anchored on the exact
  line) is the fallback.
- **Re-running a review reconciles against the current diff** — still-present findings stay, fixed
  ones collapse into "✓ N fixed since the last review", new ones are tagged `new`. The list
  converges instead of piling up.
- **Comment on any diff line; batch pending comments** to `Address with agent →` or
  `Submit review`. One primitive for iteration.
- **Mechanical git operations the cockpit runs** (discard, exclude-from-PR, revert-file, commit,
  push, create-PR, merge); **semantic changes route to the agent**. You never ask an LLM to run
  `git restore`, and you never hand-run plumbing. **There is no user-facing staging index** —
  "unstage" is spelled *exclude from PR*, and the mental model stays at review altitude.
- **A Delivery is one object anchored to the ticket**, embedded in the session rather than
  re-rendered, so the same PR seen from two rooms is one truth. A teammate's PR with no local
  session renders **Work-side only, with no session row** — an honest gap, not a stub.

**Cross-surface interaction model:** every master–detail surface in the app behaves like GitHub's
"Files changed" — the left list is navigation only, the right detail is one continuous virtualised
feed with scroll-spy and click-to-jump. The whole cockpit shares one navigation feel.

Detail: `cockpit-session-interior-decisions.md`, `cockpit-session-interior-prototype.html`.

## 5 · Tickets room (`⌘2`)

- **List rail plus two-pane detail** — the backlog gets a home with room for a ticket body.
  Kanban is out of scope for v1.
- **A generic node tree.** Any node opens in detail identically and **type is a property**, not a
  PRD→Task ladder: hierarchy is structural, not a schema. A parent node adds a **Children**
  section and offers **drill only, no Implement** — work happens at leaves.
- **Lean rail: `dot · id · title · priority`.** Delivery signal is carried by the dot; PR chips
  appear only in detail. The counters #201 cut from global chrome live in this rail's
  `BACKLOG · BY PRIORITY` row.
- **A pinned Next-up hero over a priority-sorted backlog** — the one recommendation and the full
  list share a surface.
- **Next-up is a cold-start planner** — the highest-value **not-yet-started leaf to spawn** —
  never a best-move-overall recommender. That is the attention channel's job (§7), and Next-up
  must not compete with it.
  - **Pool:** open, leaf, `todo`, unblocked, session-less. Parents are never candidates; blocked
    items are shown but not recommended.
  - **`unblocked` is closure-kind-aware, one definition app-wide.** A blocker closed as ruled-out
    satisfies no edge, so a **stranded** node is shown-but-not-recommended exactly as a blocked one
    is — the provider's `blocked_by` scalar reports it as clear and must never be trusted alone.
    The per-blocker walk is **lazy**: only the ranked leader is verified, and a stranded leader is
    dropped and the next one walked.
  - **Decision tickets never enter the hero.** They share the pool's predicate but not the
    recommendation: "answer this question" versus "ship this leaf" is a best-move-overall
    judgement, which this hero exists not to make. The planning surface picks the question.
  - **Ranking is dumb and legible:** `priority desc → PRD sequence → age`. You can predict the
    answer without reading a scoring function.
  - **At most two *earned* reason chips** (`high priority` → `unblocked` → `next in <PRD>`,
    falling back honestly to `oldest untouched`) and **never a score** — a fact, not a
    rationalization.
  - **No dependency DAG → the blocked filter no-ops and the `unblocked` chip is suppressed.** A
    missing signal never becomes a false claim.
  - **Re-ranked as a live projection** — on provider-poll deltas and instantly on local session
    start/stop. It needs no timer of its own.
  - **Empty pool degrades in tiers** — nothing unblocked / all in progress / backlog clear. "Nothing
    to do" says *which* nothing. The nothing-unblocked tier may **point at** open decisions
    (`nothing unblocked · 2 decisions open ↗`) — a count and a route, never a recommendation.
- **Ticket detail** is a scrolling main column with a sticky sidebar (Deliveries · Properties ·
  Labels · blockedBy), so metadata stays put while the body scrolls. **Multiple PRs per ticket are
  first-class** — a ticket that took two branches is not misrepresented.
- **Search is project-scoped and flattens the hierarchy on filter**, so filtering does not fight
  the tree.

Detail: `cockpit-work-room-prototype.html` (#185, refining #160).

## 6 · Code room (`⌘3`)

- **A third top-level room, session-independent** — reading and editing code is a peer activity,
  not a mode inside a session.
- **The explorer and editor mirror the project's primary working tree at its current branch**, so
  "which files am I looking at" has one answer. The file tree carries git status markers
  (modified dot, `A` added, `U` untracked).
- **`⌘P` searches one field by file name *or* content** — name matches first, then in-file matches
  with highlighted snippets and line numbers. Quick-open and grep are one gesture.
- **A real editable editor** with tabs and per-tab dirty indicators — a small fix does not require
  leaving the app. An edit here surfaces as Workspace `dirty`/`unpushed` with **no separate
  state**: first-party edits and agent edits are the same kind of fact. Markdown files get a
  **`Code / Preview`** toggle. **`⌘E`** hands the file or project to an external editor, so Argo is
  never a dead end.
- **A scratch terminal** — a PTY in the checkout's cwd attached to no agent, tagged `no agent`,
  docked and expandable, with `New` for another. The shell is a first-party surface.
- **No worktree browsing anywhere in v1, deliberately** (#202 upholding #183's floor). The session
  shows its diff; External Editor reaches the rest. A root picker *is* the workspace picker #183
  removed, and a full-tree mode inside the session grows a second explorer inside the product view.
- **There is no "enable worktrees" setting** (#202 — the ticket refuted its own premise). Argo
  **observes** worktrees and does not create them: spawn is fixed at the project root
  (zero-config, #186) and the CLI's own harness relocates itself afterwards, so
  `Workspace.kind: main | worktree` is a **read** (DIRECT managed / DERIVED external), not a dial.
  A toggle was also unenforceable — flipping it off cannot stop a skill running `git worktree
  add`, so Argo would be rendering a preference as a fact.
- **Degraded floor:** an empty folder says `This folder is empty` with `New file` / `Open
  terminal`; a binary or oversized file says `This file can't be shown here` with its size and
  type plus `Open in VS Code ↗`. The limit is stated with its escape hatch.

Detail: `cockpit-code-room-spec.md`.

## 7 · Status vocabulary

**One word per state, identical on every surface** — `running` in the roster and `active` in the
header can never disagree. The registry is the authority for Argo-owned words.

- **Ticket status is the provider's own word, verbatim.** Argo's canonical five are an
  **internal bucket** for ranking, filtering and transitions only — never shown in place of the
  provider's word. Argo never overwrites GitHub's `Open` with its own `todo`.
- **`done` (completed successfully) and `closed` (terminated without completing) stay distinct** —
  abandoning and finishing must not read alike.
- **A bare tracker gets `todo`/`done`/`closed` only, with transitions greyed out**; the full five
  appear only when the provider's workflow actually carries them.
- **Ticket status is never synthesized from local facts.** A running session does not make a
  ticket `in-progress`; an open PR does not make it `in-review`. Those are separate axes —
  session liveness and Delivery review.
- **Code-host vocabulary is preserved verbatim** — Check names, PR states and review verdicts are
  never renamed or normalized.

Detail: `cockpit-status-vocabulary.md`.

## 8 · Degradation — the honesty tiers

The tier axis covers *never established*.

- **Nothing connected (DIRECT)** — an honestly empty shell with a connect seam; the strip shows
  only `+`. The app never fabricates content.
- **Provider connected (DERIVED)** — projects, worst-state dots, backlog and delivery facts
  populate from provider plus git/code-host reality.
- **Companion plugin (CONVENTION)** — CONVENTION-tier sections **hide whole** rather than render
  half-filled skeletons. Absence reads as absence.
- **Degrade-down, always.** Ambiguity resolves toward the lower tier or the quieter state; Argo
  never renders a false `DIRECT`. Every tier-gated enum carries an explicit `unknown`/absent
  rendering.

**`Hide whole` governs the tier axis only.** Freshness is a separate axis — see §9.

## 9 · Failure policy — when a fact goes bad mid-flight

Eight rules, owned by `cockpit-failure-states-spec.md` and cross-referenced (never restated) by
the surface specs:

1. **Staleness is a fourth axis**, orthogonal to the tiers, carried by the **connection** and not
   by each fact — so previously-fetched data stays rendered **at full fidelity** when a poll
   fails, and there are no per-fact staleness badges.
2. **Connection state belongs to a *binding*** (folder · work-item provider · code host), not to a
   project — the three fail independently and at different levels. Per-project truth is shown only
   for the **active** project; background projects stay **silent**, and the strip dot stays
   session-only. "Your agent is waiting" and "GitHub is unreachable" never share an urgency.
3. **One connection chip rolls up the bindings** — **silent when healthy** (no green light),
   showing `stale` with age and cause (`offline` / `unreachable` / `rate limited`), or becoming a
   `needs reconnect` button into §3's panel. **Account-level auth failure escalates past the
   roll-up** — the one failure with a global blast radius and a real action is not buried.
4. **No optimistic writes.** An optimistic paint *is* a false DIRECT. Pending renders
   pessimistically — control disabled in place, no toast, no layout shift. Failure returns the
   control to its prior state with the error inline carrying the real reason and **no auto-retry**.
   Success **adopts the response body** as the new truth rather than waiting a poll interval to
   agree with itself.
5. **Real output, never a paraphrase** — a one-line summary at the control, the **unabridged**
   stderr one gesture away (the Dock in-session, the scratch terminal in Code). Git's stderr *is*
   the fix; paraphrasing it away destroys the only useful text.
6. **A missing folder disables the whole project** — one error offering **`Relocate`** or
   `Remove`. Relocate is first-class: the project id survives and the path is re-pointed, because
   the path is a mutable attribute on a stable id. Moving a repo is not a re-onboard.
7. **Writes stay live while `stale`** and disable only on `needs reconnect` — Argo never guesses a
   write will fail, and staleness never gates local actions.
8. **Observation failure is not work failure** — a DERIVED soft-spot or an unparseable transcript
   renders `unknown` on the affected fact and **never** reddens a dot. The session row survives on
   its direct facts (liveness, path) with derived facts absent; the dot follows liveness, not parse
   success. **Red is reserved for the work actually breaking.**

## 10 · Out-of-window attention

**An OS notification is the out-of-window projection of the session dot.** No new state, no new
vocabulary, no ranking of its own — which is why external sessions and blind observation need no
special case: they cannot honestly reach the firing states.

- **Fires on amber `Needs input` and red `Stopped` only** — exactly the set that lights a strip badge.
  **Never on `idle`**: it earns no badge and would fire every turn.
- **Suppressed whenever any Argo window is focused**, and regaining focus **closes** outstanding
  banners — when you are here, the in-app dots are authoritative. OS DND is honoured.
- **One live banner per session**, deduped on `(sessionId, state)`, replaced on amber→red, cleared
  on leaving the state. A state change is one interrupt.
- **The dock badge counts amber plus red across all projects, focus-independent** — banners are
  interrupts that focus answers; the badge is a state readout.
- **A click is a full deep-link** — focus → swap project → `Sessions ⌘1` → open that session,
  overriding remembered per-project state for that swap. An explicit deep-link wins over
  restoration.
- **Copy:** title `<session title>`, body `<project> · Needs input|Stopped`, words **verbatim from the
  registry** and **never the agent's raw request** — you should not have to decide from a truncated
  OS surface. The real output lives in the Dock.
- **No in-app toggle and no sound control** — macOS's own per-app settings are the switch; no
  Preferences surface is invented for a boolean.
- **Nothing else notifies.** Not connection failure, not Delivery events (CI / review / merge), and
  **no state of a decision map** — a map is not a running world, and this channel projects the
  running world. A blocked frontier and a stale claim are state readouts that live where you would
  act on them; a **stranded** node is a permanent deadlock needing a human, so it lights the
  **project-strip badge** — visible without entering the room — and stops there. No session dot
  moves for any of the three.

Detail: `cockpit-app-shell-spec.md` → *Out-of-window attention*.

## 11 · The architecture the domain model forces

> Stated here because `CONTEXT.md` and ADRs 0013–0018 already force it — this is the
> architectural half a Phase-3 ticket set is cut from, not a start signal for the build.
>
> **Written against the Electron runtime (ADR-0023 retired it).** The CLAIM this section
> makes survives the rewrite and is why it is kept: one owner holds authoritative state,
> there is exactly ONE seam, and views take facts rather than rendered states. The MECHANISM
> named below — `applyEvent`/`applyDelta`, `@shared/projection`, IPC deltas, stories — does
> not. Swift spells it Hub → cockpit projection → SwiftUI, with `swift-boundaries.sh`
> enforcing the seam that this section could only assert. Read it for the shape; take names
> and file paths from `apps/macOS`.

### 11.1 The one seam

**`CockpitState` in `@shared` is the single testing seam.** Everything upstream is an observer
emitting `HubEvent`s; everything downstream is a pure model function draining it into dumb views.

```
observe/*  ──HubEvent──▶  [ SEAM ]  ──delta──▶  build<Room>Model  ──▶  dumb views
ports/*    ──HubEvent──▶  @shared/projection          (pure)          (stories only)
git/*      ──HubEvent──▶   CockpitState
```

This is the existing shape generalized, not a new architecture: `applyEvent` (main) and
`applyDelta` (renderer) already run the same pure code so the two copies cannot drift (the retired ADR-0005; see the section note),
and `SessionView` already carries **facts, never a rendered state**, so grading stays on the
renderer's side of the bridge. The rooms extend that rule rather than bending it.

The contract grows along three axes — today's `projection.ts` has **one** event member and a
sessions-only state:

```ts
// The event vocabulary widens from one member to the three observer families.
type HubEvent =
  | { type: 'session-created' | 'session-updated'; session: SessionView }
  | { type: 'work-items-synced'; projectId: string; items: TicketView[] }
  | { type: 'delivery-derived'; branch: string; delivery: DeliveryView }
  | { type: 'workspace-changed'; workspace: WorkspaceView }
  | { type: 'binding-health'; binding: BindingId; health: ConnectionHealth }

// State is project-keyed; the window renders one active project (ADR-0015).
interface CockpitState {
  projects: ProjectView[]
  activeProjectId: string | null
  sessions: SessionView[]          // facts only — words/tones derived renderer-side
  tickets: TicketView[]        // provider word verbatim + canonical bucket alongside
  deliveries: DeliveryView[]       // branch-keyed, derived, never persisted
  connections: ConnectionHealth[]  // per binding, not per project (§9 rule 2)
}
```

Two disciplines the shape enforces: a `TicketView` carries **both** the provider's verbatim word
and the canonical bucket, because §7 needs the first for display and the second for ranking; and
`ConnectionHealth` is keyed by **binding**, not project, because the three bindings fail
independently.

### 11.2 Renderer — panels become rooms

The five current panel domains derive from ADR-0009's story/work split, which the redesign
retires. The target slice set:

- `shell/` — project strip, merged top bar (orb seat, connection chip, room tabs, git group),
  `⌘K` palette, keymap, the empty first-run seam, spawn, navigation.
- `rooms/sessions/` — roster rail and session interior (header, Activity, Delivery, Dock).
- `rooms/work/` — rail, generic node tree, Next-up, ticket detail.
- `rooms/code/` — explorer, editor, scratch terminal.
- `shared/` (renderer-shared) — the primitive kit plus the status-word/tone vocabulary every room
  reads.

`apps/desktop/scripts/module-boundaries.json` is updated **in the same change** as any slice add,
split or rename. The existing layer rules (domains ⊥ domains; every domain → renderer-shared;
renderer-shared imports no domain) carry over to the room slices unchanged, as does the Electron
main ⊥ preload ⊥ renderer isolation.

### 11.3 Runtime vocabulary correction

`RunRow`, `AgentRow`, `phaseState` and every `Run` / `Phase` / `Actor` name are retired to the
locked tree: **`Agent`** (recursive, root-vs-child by `parentId`, no `kind` discriminant) ·
**`Subagent`** · **`Turn`** (stop reason from ACP's enum plus `unknown`) · **`Tool Call`** ·
**`Plan`** · **`Workspace`** · **`Compaction`** · **`Usage`**. Open ticket #5 ("The Actor tree")
is an **amend** under #170's disposition, not a build-as-written.

### 11.4 Main process — observers and ports

`observe/` survives and extends (incremental tailing beyond the launch sweep). Two adapter ports
join it as observer families:

- **Ticket provider** — GitHub Issues v1, Linear pluggable. **OAuth device flow, provider HTTP
  API, keychain-stored per-machine tokens** (ADR-0018) — *not* the `gh` CLI, which remains how
  agents operate the repo. **Polled**: a desktop app receives no webhooks.
- **Code host** — GitHub v1. One GitHub grant feeds both ports and fails as one.

The port interface is **capability-declared canonical intents**, not provider-shaped setters:
`createTicket` · `updateFields` · `transitionTo(canonical)` (the adapter resolves the native
mechanism and the legal transition — deliberately not `setStatus`) · `addBlockedBy` /
`removeBlockedBy` · `setParent` · labels · `setPriority` · `close(reason)` / `reopen`. A
per-workspace **state-map** (provider state → canonical, heuristic-seeded, `in-review` by
name-match, customs collapsing to the nearest bucket) does the translation, with two declared
degradation tiers.

**Notifications live in main**, because Electron has no tag/replace: main holds the `Notification`
objects and closes them itself, sets the dock badge via `app.setBadgeCount`, and needs a
`navigate-to-session` command to the renderer — the same one `⌘K`'s jump requires.

**Grill-promotion stays agent-native** (#169, correcting #167): `/grilling` and `/wayfinder` write
PRD + sub-issues + `blockedBy` directly via the tracker doc's configured route. It is **not** a
cockpit-port caller in v1, and the contract is `docs/agents/issue-tracker.md`, not a skill fork.

### 11.5 Persistence and ownership

Files are always the source of truth (ADR-0008). Argo's own state lives in per-machine `userData`
and is **never committed**. Argo owns only the glue (ADR-0017) — the Project registry and the small
set of user-asserted links no external signal carries: branchless Session→Ticket, and
branch→ticket when the join derives to *unlinked*. **The join is derived, never persisted** — the
Hub assembles it in memory at launch as a throwaway projection. SQLite, if it ever returns, is a
rebuildable cache only.

### 11.6 What earns a test

A good test here exercises external behaviour **at the seam** and would survive a rewrite of
everything on either side of it. A test asserting that a component renders a particular `div`, or
that a reducer was called, is testing implementation and does not earn its place.

- **`@shared/projection`** — feed `HubEvent`s, assert `CockpitState`; replay deltas renderer-side
  and assert the two copies are identical. This is the one test that proves that no-drift
  claim.
- **`@shared/lifecycleModel`** — session facts → delivery render state, extended for the
  one-control-line decisions (rail node states, the blocking badge, `Files (N)`).
- **`main/observe/*`** — fixture-driven parse, resume-chain stitch, liveness, working-set
  discovery. Fixtures already live in `__fixtures__`.
- **The two adapter ports** — one suite run against **each** adapter through a fake HTTP layer,
  covering the eight canonical intents, the state-map translation and both degradation tiers.
  Provider-shaped behaviour is asserted **through** the canonical interface, never around it.
- **`build<Room>Model`** — one pure function per room. This is where Next-up ranking, the roster
  word priority, the worst-state dot roll-up and the connection roll-up are asserted; they are all
  pure derivations and none needs a DOM.
- **Views** — no unit tests. Every story renders in CI (the `stories` job) as a smoke test in real
  Chromium; pixel- or spec-level checks run on demand via `/pixel-review`.

Prior art to follow rather than re-invent: `src/shared/projection.test.ts`,
`src/shared/lifecycleModel.test.ts`, `src/main/observe/*.test.ts` with `__fixtures__`,
`observe.seamB.test.ts`, `sessionScreenModel.test.ts`, `hub.test.ts`.

## 12 · The delta from what runs today

**The running `apps/desktop` renders the *retired* model. It is not a partial implementation of
this spec.** Concretely, on `main` today:

- one `SessionScreen` composing the panel domains that are left — `roster`, `delivery`,
  `console` — from ADR-0009's story/work split (`concierge` went with #284, `activity` with #261);
- no project strip, no rooms, no Tickets or Code surface, no ports.

Two bullets that stood here are now closed: the retired runtime vocabulary in the components
(`RunRow`, `AgentRow`, `PhaseGroup`, `phaseState`, `agentState`) and the `demoSeed` standing in
for observed reality both died with #261, which put the locked tree behind an incremental
observer and pointed the packaged e2e run at a fixture transcript root instead.

The redesign is **three rooms on `Agent` / `Subagent` / `Turn` / `Tool Call`**. Nobody should read
the current UI as a step toward it.

**What survives and is reused, not restarted** — the observation floor:

- **`main/observe/`** — transcript parse (`claudeTranscript.ts`) now folding the runtime tree
  (`tree.ts`), resume-chain stitch (`resumeChain.ts`), the process probe (`liveness.ts`) under a
  class-gated status derivation (`sessionStatus.ts`), working-set discovery (`discover.ts`), and
  the incremental observer over them (`observer.ts` + `watch.ts`), with fixtures.
- **`@shared/projection`** — the `applyEvent` / `applyDelta` reducer pair (§11.1 widens it).
- **`@shared/lifecycleModel`** — session facts → delivery render state.
- **`main/terminalBridge.ts`** — the PTY bridge the Dock and the scratch terminal both need.

## 13 · Residue and scope

### Known-unspecified — flagged, deliberately not specced

**Tickets-room multi-select, bulk transitions, and filtering depth** beyond #160's project-scoped
flatten-on-filter. #178's audit found this did **not** fold into the shell's keyboard/command model
as #157 assumed: #172's spec settled `⌘K` and the global keymap but contains no multi-select,
bulk-operation or filtering-depth content, and **no surface ticket picked it up**. It is unowned,
sharp enough to ticket, and belongs in its own grill rather than in an assembly of decisions
already made. Phase 2/3 inherit it as a **known** gap.

Two further deferrals stay open and are not gaps in this document: **ticket comments** (needs a
purpose decision — discussion vs deep-link glance — plus provider sync) and a **state-map editor
UI** (ships heuristic-seeded; earns a ticket only if the heuristic proves wrong often enough).

### Downstream phases — not skipped, not owned here

- **Phase 2** — design foundations into the token contract (`/setup-design-foundations`, a new
  `foundations.html`). **Per-surface density settles here** — #178's audit moved it from open fog
  to out of scope for Phase 1, because every landed surface spec defers it. The prototypes are
  structurally real and visually approximate on purpose.
- **Phase 3** — a fresh UI inventory, the build contract; the component tree is re-derived there.
- **The build itself** — post-Phase-3.

### Owned by another effort

**The Concierge, wholesale** — voice, narration, conversation mode, its data model, `hold ⌘␣`
behaviour. Map #190 owns it. Phase 1 ships only the orb **seat** in the top bar; the
conversation-mode toggle was cut from chrome deliberately (#201).

*Phase-2 note carried forward:* #158's "orb as key light" means **the orb is the brightest object
and attention = brightness** — **not** that the scene's gradient originates at the orb. With the
Concierge in the top bar the orb sits top-left while the corona stays centre-right, as the
Code-room prototype already renders. Phase 2 inherits the decoupling rather than re-opening it.

### Cut inside #157, and staying cut

Deploy and release lifecycle nodes (reserved, unwired until a code-host deploy signal exists) ·
multi-Delivery rendering (v1 shows the single active Delivery; the glance banner was cut) · ticket
comments · a state-map editor UI · a menu-bar / tray item (a fourth rendering of the same attention
signal) · a merge-conflict GUI · kanban in the Tickets room · Linear-specific onboarding pixels ·
multi-user / assignee filtering · the file-vault Ticket provider · MCP servers as an observed
session attribute · any app-global Preferences surface · foreign-session discovery as a ranked v1
concern · stack or tooling changes.

---

## Two notes for anyone picking up a ticket

- **#170's disposition of the 18 pre-existing tickets stands** and should be honoured before any of
  them is picked up: **6 unaffected** (#4 · #6 · #7 · #9 · #67 · #68), **7 amend** (#1 · #5 · #8 ·
  #10 · #45 · #76 · #39 — #10 and #39 are corrections), **5 park** (#59 · #60 · #61 · #77 · #131,
  blocked by #157, to be re-derived against the Phase-2/3 rebuild).
- **The prototypes are throwaway and say so.** `cockpit-prototype-switcher.html` (#178) is a
  cross-surface review harness that expires with the files it wraps; its manifest is inline because
  `file://` blocks `fetch`, and its highlight is honestly captioned "what the rail last loaded"
  because inner iframe state is unreadable under opaque origins. **Onboarding has no prototype** —
  cut, not lost (#205) — and appears in the harness as a visible dead slot.
