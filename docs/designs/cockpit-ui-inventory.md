# Cockpit UI inventory, the build contract

> **Wayfinder [#157](https://github.com/milad-alizadeh/argo/issues/157), Phase 3
> ([#263](https://github.com/milad-alizadeh/argo/issues/263)).** The component tree the shell and
> the three rooms are built from, named once, with its states and its module slice.
>
> **This is a rebuild, not a retrofit.** The old `cockpit-inventory.md` was wiped with the rest of
> the pre-reset design set (PR #179) because it described the app being replaced. Nothing is
> carried over from it. Every row below is re-derived from three inputs and cites which:
> `cockpit-spec.md` (the assembled Phase 1 contract), the settled prototypes' own
> `data-component` names, and `argo-tokens.css` / `foundations.html` (the Phase 2 contract).
>
> **What this document is for.** A room ticket composes from this inventory instead of inventing
> one. It fixes three things a build otherwise re-decides per file: the **name**, the **state
> set**, and the **slice**. It fixes neither markup nor pixels: the prototypes own the pixels and
> the token contract owns the values.

## How to read it

Five rules govern every row, and a row that breaks one is a bug in this document.

1. **Names come from the prototypes.** Every settled prototype carries
   `data-component="PascalCaseName"` on its meaningful regions. That name was decided in the
   study and is reproduced here verbatim. A name in the **Seed** column is a citation, not a
   proposal. Where a region has no `data-component` (the written specs have no prototype, and the
   session interior's own body predates the convention) the Seed column cites the owning spec
   section instead, and the name is coined here.
2. **States come from the matrix and the registry.** Every state traces to
   `cockpit-surface-matrix.md`, `cockpit-status-vocabulary.md`, `cockpit-failure-states-spec.md`,
   `CONTEXT.md`, or a prototype's own `?state=` list (22 states, enumerated in
   `cockpit-prototype-switcher.html`). No state is invented here. Where a needed state has no
   authority, it is listed under **[Unhomed and open](#unhomed-and-open)** rather than filled in.
3. **Values come from the token contract.** `apps/desktop/src/renderer/src/styles/argo-tokens.css`
   settled by #262: one 9/11/13/15 sans ladder as the density, gold as the single accent **and**
   `needs you`, `done` quiet slate, planes by brightness. The prototypes' inline `:root` blocks
   are pre-contract drafts and are **not** an input to any row here.
4. **Extraction is earned, not assumed.** Each row is marked **shared** (two or more slices
   exercise it, so it is a primitive from the first commit) or **inline** (build it inside its
   room's screen, extract only when a second caller or an unexercised state appears). This is
   `componentize-design`'s screen-first stance: the name is fixed now so two rooms cannot coin
   two names for one thing, but the file is not created ahead of the screen that needs it.
5. **A primitive is extended, never duplicated.** A "new" atom is usually an existing primitive
   plus a tone family. The kit below states, per primitive, whether it survives, changes, or is
   retired, and the changes are cited to the rule that forces them.

---

## Module slices

The target slice set is `cockpit-spec.md` §11.2, and `apps/desktop/scripts/module-boundaries.json`
carries it as of this change. The existing layer rules carry over unchanged: slices are mutually
forbidden (a room never reaches into another room, and the shell never reaches into a room), every
slice may import `renderer-shared`, and `renderer-shared` imports no slice. Composition of shell
plus active room happens at the renderer root, outside every slice, which is where `SessionScreen`
composes the panel domains today.

| Slice | Path | Public entry | Owns |
|---|---|---|---|
| `shell` | `src/renderer/src/shell/` | `shell/components/index.ts` | Project strip, the merged top bar and its four regions, the command palette, onboarding / Project Settings, the empty first-run seam, the disabled-project error |
| `rooms/sessions` | `src/renderer/src/rooms/sessions/` | `rooms/sessions/components/index.ts` | Roster rail, the session plane, header, Activity, Delivery, the Dock |
| `rooms/work` | `src/renderer/src/rooms/work/` | `rooms/work/components/index.ts` | List rail, the generic node tree, Next-up, ticket detail |
| `rooms/code` | `src/renderer/src/rooms/code/` | `rooms/code/components/index.ts` | Explorer, search, editor, scratch terminal, the degraded file states |
| `renderer-shared` | `src/renderer/src/shared/` | the `components/ui`, `components/ui/icons` and `status` barrels | The primitive kit, the icon set, the status word/tone vocabulary |

**The five current panel domains are retired, not deleted by this ticket.** `roster/`, `activity/`,
`delivery/`, `console/` and `concierge/` derive from ADR-0009's story/work split, which the
redesign retires (`cockpit-spec.md` §12). They stay in the map while their code is still on disk,
so the boundary gate keeps guarding them; each is removed from the map by the ticket that moves its
last file. Two of them have salvage value and are named in the rows below: `concierge/`'s orb engine
is the shell's orb, and `delivery/`'s `NodeDrawer` bodies are the lifecycle drawers.

`renderer-shared/delivery/` is renamed to `renderer-shared/status/`, because what it actually holds
is the status word and tone vocabulary that every room reads, and the name promised a Delivery
coupling that the room slices must not have.

---

## renderer-shared: the primitive kit

### What survives

| Primitive | Verdict | Why |
|---|---|---|
| `Text` | **keep unchanged** | Its variants already **are** the contract's type roles (`hero · headline · title · prose · row · row-strong · meta · eyebrow · tag · code · code-inline`). #262 settled the ladder these names read from, so the primitive needed no change and gets none. |
| `Button`, `IconButton` | **keep, prune variants** | The `review-secondary` and `verdict-*` variants are ADR-0009-era. The settled Delivery has exactly **one** primary CTA per control line (`cockpit-spec.md` §4.3), so the variant set re-derives to primary · ghost · destructive plus the verdict washes that `toneRecipes` already names. |
| `Badge` | **keep** | Carries the two count-and-alarm jobs the settled control line needs: `Files (N)` and the red blocking badge on Code Review. No free-text status string is ever a Badge. |
| `StatusDot` | **keep, extend** | The single carrier of session state colour. Needs one addition: a **hollow** rendering for `external` (registry, Session status table). Extension of an existing primitive, not a new atom. |
| `Status` | **change** | It currently colours the word (`text-tone-${tone}`). The registry forbids that: state is carried by the dot, the word stays neutral dim text, no double-encoding. The word takes `--foreground-soft`; the tone reaches only the dot. |
| `Tabs` | **keep** | Two callers: the session's `Activity · Delivery` pair and Delivery's `Overview · Code Review · Files` sub-tabs. The shell's room tabs are **not** this primitive (see `RoomSwitcher`). |
| `PanelSplitter` | **keep** | Every master/detail surface in the app is a two-pane split, and the split is resizable in the prototypes. |
| `SectionHeader`, `PanelHeader` | **keep** | The eyebrow-plus-count header the Subagents group, the Timeline group and the Work rail's `BACKLOG · BY PRIORITY` row all share. |
| `AccentCard` | **audit before reuse** | Its tone family predates the contract's plane family (`--plane-top · --plane-bottom · --plane-cast` and their `-lit` pairs). Depth is brightness only now, and one frosted surface per region, never glass inside glass. Reconcile its tones onto the plane tokens in the first room ticket that renders a card. |
| `Checkbox`, `ToggleGroup`, `useDisclosure`, `toneRecipes`, the icon set | **keep unchanged** | Nothing in the settled surfaces asks them to change. `ToggleGroup` is the Code room's `Code / Preview` lens and Delivery's `diff / rendered` artifact lens. |

### The status vocabulary, re-derived

`renderer-shared/status/` holds the one derivation every room reads. Today's `SESSION_STATUS` table
is pre-registry and disagrees with it in three ways, all of which are re-derivation work owned by
the first Sessions-room ticket:

- **Words are Title Case** (`Running`, `Needs input`). The registry's words are lowercase and
  literal: `running · idle · needs you · failed`, plus no word at all for `external`.
- **The table's key set is the domain's, not the registry's.** `CONTEXT.md` L2 derives six session
  statuses (`running · permission · asking · idle · stopped · ended`); the registry shows four
  words. The fold is stated by its owners and must live here as a pure function, once:
  `permission | asking → needs you`, `stopped | ended → failed` (`cockpit-app-shell-spec.md`,
  Copy), `running → running`, `idle → idle`, and `external` renders identity with no state word.
- **`queued` and `orphaned` are not registry states.** `orphaned` is a real domain posture
  (`CONTEXT.md` L2: a managed session whose owner is gone) and it degrades to observation-only, so
  it renders as an `external`-shaped row, not as a word of its own. `queued` has no authority in
  any settled document and is dropped.

| Component | States | Seed / authority | Extraction |
|---|---|---|---|
| `sessionStatusWord` | the four words above, plus `external` (identity, no word) | registry, Session status | **shared**, pure function, no DOM |
| `deliveryClaimWord` | `commits · pr · ci · review · merge` node words, e.g. `CI failed` | registry, Delivery lifecycle | **shared**, pure |
| `rosterWord` | the priority pick: attention needs-input → attention failure → delivery milestone → liveness → kind | `cockpit-spec.md` §4.1 | **shared**, pure. A delivery claim beats session status. |
| `worstStateDot` | `needs you > failed > running > none`, active project always `none` | registry, Attention | **shared**, pure |
| `connectionRollup` | `healthy` (renders nothing) · `stale` · `needs reconnect`, plus auth escalating past the roll-up | failure spec §3 | **shared**, pure, keyed by **binding** not project |

### Primitives the settled surfaces earn

Each is exercised by two or more slices, which is what makes it a primitive rather than a room's
own molecule.

| Primitive | States | Seed / authority | Callers |
|---|---|---|---|
| `MasterDetail` | list-left navigation plus one continuous virtualised feed right, scroll-spy highlight, click-to-jump | `cockpit-spec.md` §4.3, "Cross-surface interaction model": the whole cockpit shares one navigation feel | Activity, all three Delivery sub-tabs, the Work rail plus detail |
| `GutterDiff` | added · removed · context · anchored finding · comment thread · collapsed hunk | session-interior prototype, "self-contained GitHub gutter diffs (shared by every detail pane)" | Delivery Overview, Code Review, Files |
| `TerminalPane` | live · dead PTY (offers `Relaunch`, never a status word) · expanded · collapsed | `CONTEXT.md`, Scratch terminal: "same PTY machinery as a session terminal, minus the agent" | the session Dock, the Code room's scratch terminal |
| `Menu` | closed · open · row enabled · row disabled with reason | `BranchMenu` and `BranchManage` (prototype seeds), the project tab context menu | shell, and any room row menu |
| `Tooltip` | hidden · shown | the active project tab's name plus `last synced` (#201) is the only mandated tooltip in the shell | shell |
| `EmptyState` | one line of copy plus zero, one or two actions | Code room's `EmptyFolder` / `NoFileOpen` / `UnsupportedFile`, the Work room's four empty-pool tiers, the roster zero-state | every room |
| `Kbd` | a rendered key hint | the canonical keymap is shown in the palette, not in chrome | shell |

`TerminalPane` must import `@xterm/xterm/css/xterm.css`. Without it the pane renders ghost rows and
a solid selection block, because the character-measure span stays visible.

---

## `shell/`

The chrome is two fixed regions on one lit scene, and there is no bottom chrome: the bottom edge
belongs to the room. Chrome components render in **all three rooms** or they are not chrome.

| Component | States | Seed | Extraction |
|---|---|---|---|
| `ProjectStrip` | one project · many · **none** (just `+`) | `data-component="ProjectStrip"` | **inline** in the shell screen |
| `ProjectTab` | active (quiet, never dotted) · inactive with worst-state dot (`needs you` / `failed` / `running` / none) · hovered (tooltip: name plus `last synced`) · context menu open | `data-component="ProjectTab"` | **shared** within `shell` |
| `TopBar` | one fixed layout: `[traffic lights] [orb + caption] ⋯ [chip] [room tabs] [git group]` | `cockpit-app-shell-spec.md`, Canonical chrome; the prototypes' `MERGED TOP BAR` sections | **inline** |
| `WindowControls` | a static clearance reserve, no states | `data-component="WindowControls"` | **inline**. `hiddenInset` clearance only. Argo draws no traffic lights. |
| `ConciergeStrip` | seat only in v1: it renders the orb and the caption and owns no behaviour | `data-component="ConciergeStrip"` | **inline** |
| `OrbMini` | `idle` in v1. The full state set belongs to map #190. | `data-component="OrbMini"`; engine salvaged from `domains/concierge/` (`eclipseOrb/`, `sceneConfig.ts`, `ConciergeDock`) | **shared** within `shell` |
| `ConciergeCaption` | silent (renders nothing) · caption text, width-capped so the right cluster keeps its room | `data-component="ConciergeCaption"` | **inline** |
| `ConnectionChip` | **healthy renders nothing, there is no green light** · `stale` with age and cause (`offline` / `unreachable` / `rate limited`) · `needs reconnect` (a button into the connect panel) · account-level auth, escalated past the roll-up | failure spec §3, placed first in the right cluster by #201 | **inline** |
| `RoomSwitcher` | active ∈ `Sessions ⌘1 · Work ⌘2 · Code ⌘3` | `data-component="RoomSwitcher"` | **inline**. Not the `Tabs` primitive: it is a router, styled as floating chrome with no track. |
| `GitControls` | present · **hidden whole** when the project folder is not a git repository | `data-component="GitControls"` | **inline** |
| `BranchSelector` | clean · ahead · behind · diverged (ahead and behind) | `data-component="BranchSelector"` | **inline** |
| `BranchMenu` | per row: checkout-able local · remote `origin` ref offering `Check out` · worktree-held with a live session (`worktree` plus `↗ open its session`) · worktree-held and orphaned (`worktree` plus its **path**, no dead link). Header reads "Files follow this". | `data-component="BranchMenu"` | **inline** over `Menu` |
| `BranchManage` | `Fetch` always · `Pull` only when fast-forward · `Push` only when ahead · `New branch` / `Rename` / `Delete`. **No `Remove worktree`** (#202). | `data-component="BranchManage"` | **inline** over `Menu` |
| `ConflictHatch` | shown only on diverged: `Open a scratch terminal` · `Resolve with an agent ↗`. Argo ships no merge-conflict editor. | `data-component="ConflictHatch"` | **inline** |
| `CommandPalette` | closed · open and empty · results grouped (sessions · tickets · projects · commands) · no results | `cockpit-app-shell-spec.md`, ⌘K. **No affordance in the bar.** | **inline** |
| `EmptyShell` | the strip shows only `+`, one connect seam that hands off to the connect panel | `cockpit-app-shell-spec.md`, Connective tissue | **inline** |
| `ConnectPanel` | `welcome · fresh · direct · connecting · partial · wired · error` | `cockpit-onboarding-spec.md`, States. **No prototype exists** (#205), so the pixels are Phase 2's contract plus this spec. | **inline** |
| `ConnectRow` | per row (Folder · Connections · Companion plugin), independently: unset · set · `connecting` (shows the device code and verification URL, it does not spin blind) · error offering `Continue offline` and `Reconnect` | `cockpit-onboarding-spec.md`, Shape | **shared** within `shell`, three instances |
| `AgentCliRow` | the project's Agent/CLI choice. The one thing Project Settings holds that onboarding does not. | `cockpit-app-shell-spec.md`, Project Settings (#186 / #202) | **inline** |
| `ProjectDisabled` | one error offering `Relocate` (first-class, the id survives and the path is re-pointed) or `Remove` | failure spec §6 | **inline** |

**Project Settings is not a component.** It is `ConnectPanel` re-entered on an existing project
with its CTA reading `Done`, plus `AgentCliRow`. Building a second panel would be the duplication
#202 refused.

**Out-of-window attention renders no component.** OS notifications and the dock badge live in the
main process, because Electron has no tag/replace and main must hold the `Notification` objects to
close them itself. The renderer's only obligation is to accept a `navigate-to-session` command,
which the palette's jump needs anyway.

---

## `rooms/sessions/`

Eleven of the 22 settled states are this room's: `zero · fresh · activity · idle · delivery ·
delivery-review · delivery-files · delivery-prepr · dock · external · archived`.

### Roster rail

| Component | States | Seed | Extraction |
|---|---|---|---|
| `Roster` | populated · **zero-state is just the `+ New session` row** (a one-time transient costs no permanent chrome) · archived list open | `data-component="Roster"` | **inline** |
| `SessionRow` | `dot · name · word` over `model · branch`. Dot: running green · idle grey · needs-you gold · failed red · external **hollow**. Row: selected · unselected · external (ghosted, so read-only awareness looks different from a session you can drive). | `data-component="SessionRow"` (study template) | **shared** within the room |
| `NewSessionRow` | pinned quiet at the top. `⌘N` spawns zero-config at the project root. | `cockpit-spec.md` §4.1 | **inline** |
| `ArchivedFooter` | `⚙ Archived (n)`. Archiving is a status transition, never a button. | `cockpit-spec.md` §4.1 | **inline** |

Order is stable by most-recent activity and **attention never reorders the list**. Ordering is a
model concern, asserted in `buildSessionsRoomModel`, not a component state.

### The session plane

| Component | States | Seed | Extraction |
|---|---|---|---|
| `SessionPlane` | one continuous glass surface holding header, tabs, body and Dock. Per settled state: `fresh · activity · idle · delivery* · external`. Absent in `zero`. | `data-component="SessionPlane"`; the settled prototype's own section reads `SESSION CARD (one continuous glass)`. The plane spelling matches the contract's plane family; `SessionCard` is recorded as its superseded synonym so no ticket coins both. | **inline** |
| `SessionHeader` | one band, glance only: **no action buttons and no `⋯` menu**. Takes per state: running · idle · external · fresh. | `data-component="SessionHeader"` | **inline** |
| `ContextRing` | honest `~n%` · **empty ring reading `unknown`** for external · `—/ready` for a fresh session. An estimate is never dressed as a measurement. | `cockpit-spec.md` §4.2 | **shared** within the room |
| `SessionMeta` | order is fixed: `status · model · mode · branch(+∆/↑) · elapsed · intent ↗`. Collapses the intent chip to `#<n> ↗` when the session is titled from its ticket. External drops `intent` (read-only). `mode ∈ Ask · Plan · Code · unknown`. | `cockpit-spec.md` §4.2; `CONTEXT.md`, Autonomy cluster | **inline** |
| `SessionTabs` | **exactly two**: `Activity · Delivery`. Outcomes was cut (C2.2). | `cockpit-spec.md` §4.2 | **inline** over `Tabs` |

The title resolves through a stable fallback chain (explicit name → linked ticket →
conversation-derived) and never rewrites per turn, so the rail and the header always match. That is
a model rule, not a component state.

### Dock

| Component | States | Seed | Extraction |
|---|---|---|---|
| `Dock` | always-on and expandable: collapsed (header row only) · expanded · **fresh, where the Dock is home** (the invitation body lifted from the fresh-session study) | session-interior prototype, `TERMINAL DOCK` and `FRESH SESSION` sections | **inline** over `TerminalPane` |
| `NowHead` | current task plus plan `N/M`, living **in** the Dock header row, not on a line of its own | prototype: "now-head lives IN the dock header row" | **inline** |

**You steer by typing at the Dock's prompt and stop with Ctrl-C.** There is no steer widget and no
Stop button, so neither is in this inventory. A `permission` prompt is answered here too: it is a
DIRECT managed-only fact that arrives in the PTY, and inventing a separate approval surface for it
would contradict the one-steering-channel decision.

### Activity

Two-pane master/detail over `MasterDetail`. **The retired runtime vocabulary does not appear**:
`RunRow`, `AgentRow`, `PhaseGroup`, `phaseState` and `agentState` are gone with `Run`, `Phase` and
`Actor` (`cockpit-spec.md` §11.3). The locked tree is `Agent · Subagent · Turn · Tool Call · Plan ·
Workspace · Compaction · Usage`.

| Component | States | Seed | Extraction |
|---|---|---|---|
| `ActivityPane` | left holds a `Subagents` group above a `Timeline` list, right holds the selected item's detail | prototype, `Activity master–detail` | **inline** over `MasterDetail` |
| `SubagentGroup` | one collapsible group, **never interleaved into the timeline and never cards**. Blueprint degrades per CLI: full phased (Claude Code) · labelled tree, no phases (Codex) · flat `N subagents running` (bare). The cockpit never invents a phase a CLI did not report. | prototype, `Subagents = its own section`; `CONTEXT.md` L3 blueprint | **inline** |
| `SubagentRow` | `dot · name · target · status`, dense enough to scale to ~30 | prototype, "Dense rows scale to ~30" | **shared** within the room |
| `TurnTimeline` | the step list, folded by default | prototype, `folded Turn timeline` | **inline** |
| `TurnRow` | stop reason ∈ `end_turn · max_tokens · max_turn_requests · refusal · cancelled · unknown`. `unknown` is rendered, never guessed. | `CONTEXT.md` L3, Turn | **shared** within the room |
| `ToolCallRow` | status `pending · in_progress · completed · failed`; kind read/edit/execute/search; target file | `CONTEXT.md` L3, Tool Call | **shared** within the room |
| `PlanProgress` | `N/M` plus per-entry `pending · in_progress · completed` | `CONTEXT.md` L3, Plan | **inline** |
| `CompactionMarker` | rendered **in** the turn sequence with the resume chain stitched across it, so condensed history reads as continuous | `cockpit-spec.md` §4.2 | **inline** |
| `AgentFeed` | the detail pane: the selected subagent's live feed, or the selected step's prose | prototype, `detail pane` | **inline** |

An unparseable transcript renders `unknown` on the affected fact and **leaves the dot alone**.
Observation failure is not work failure, and red is reserved for the work actually breaking.

### Delivery

One review surface across the pre-PR / PR-open boundary, reshaping only its rail and its CTA.

| Component | States | Seed | Extraction |
|---|---|---|---|
| `DeliveryPane` | the same two-pane master/detail as Activity; the sub-tab selects what the left list contains | prototype, `DELIVERY master–detail two-pane` | **inline** over `MasterDetail` |
| `DeliveryControlLine` | one line: sub-tabs with badges, the lifecycle rail, one CTA. **No trailing free-text status string.** | prototype, `ONE control line` | **inline** |
| `DeliverySubTabs` | `Overview · Code Review · Files (N)`, with a red blocking badge on Code Review | `cockpit-spec.md` §4.3 | **inline** over `Tabs` |
| `LifecycleRail` | a **state readout, not navigation**. It never tries to be a router. | prototype, `CI pipeline rail`; matrix rows 5 to 9 | **inline** |
| `LifecycleNode` | Commit `N dirty · committed · clean` · PR `no PR · PR #42 → main · draft` · CI `running · passing · failing` (+ `N running` / `N failed` aggregate) · Review agent `approved · changes requested · N findings`, human `approved · changes requested · pending` · Merge `blocked · ready · landed` · Deploy **reserved and unwired** | registry, Delivery lifecycle | **shared** within the room |
| `NodeDrawer` | per node: commit list plus local check output · PR meta and description with a deep link · `runs[]`, one row per check with durations and a failure note · the human review | matrix rows 5 to 9; bodies salvaged from `domains/delivery/NodeDrawer/` | **inline** |
| `CheckRow` | `running · passed · failed · skipped · neutral`, mirroring the code host's own conclusions verbatim | registry, Check | **shared** within the room |
| `PrimaryCta` | one button that reshapes across the pre-PR / PR-open boundary. The `delivery-prepr` state is exactly this reshape. | `cockpit-spec.md` §4.3 | **inline** |
| `WalkthroughList` / `ChangeRow` | narrated changes that expand to their hunks, so a huge agent diff is legible before you read code. A row carries only a small `●` marker when a finding lives on it: the finding's full text lives in Code Review alone. | prototype, `Overview — PR body + narrated changes table` | **inline** |
| `FindingsInbox` / `FindingRow` | severity-ranked, plus a collapsed `✓ N fixed since the last review` reconcile group at the foot. A new finding is tagged `new`. The list converges instead of piling up. | prototype, `Code Review — findings inbox` | **inline** |
| `FindingCard` | anchored evidence inline, with `Apply fix · Dismiss` | prototype, feed sections | **shared** within the room |
| `ChangedFileList` / `ChangedFileRow` | GitHub-style sticky tree, per-file `Viewed`, findings anchored on the exact line. Named apart from the Code room's `FileTree` deliberately: same idiom, different data and different slice, and one name across two slices would invite a shared component that neither wants. | prototype, `Files — GitHub tree + gutter diff` | **inline** |
| `ArtifactLens` | `diff` (default) · `rendered`, per section | prototype, `per-file diff|rendered lens` | **inline** over `ToggleGroup` |
| `DiffCommentThread` | comment on any diff line; pending comments batch | `cockpit-spec.md` §4.3 | **inline** |
| `PendingCommentBar` | `Address with agent →` · `Submit review`. One primitive for iteration. | `cockpit-spec.md` §4.3 | **inline** |

Mechanical git operations the cockpit runs are discard, exclude-from-PR, revert-file, commit, push,
create-PR and merge. Semantic changes route to the agent. **There is no user-facing staging index**:
"unstage" is spelled *exclude from PR*, so no `StagingArea` component exists or may be added.

A write renders **pessimistically**: the control disables in place, with no toast and no layout
shift. Failure returns the control to its prior state with the error inline, carrying the real
reason and **no auto-retry**. A one-line summary sits at the control and the unabridged stderr is
one gesture away in the Dock. Git's stderr *is* the fix, so no component paraphrases it.

**Cut, and staying cut:** the multi-Delivery glance banner (v1 renders the single active Delivery),
and the "Also in this session · N more" banner the prototype removed.

---

## `rooms/work/`

Three settled states: `leaf · parent · filter`. The rail has two modes, resting (hierarchy plus
hero) and filtering (flat matches), and **type is a property, not a schema**: any node opens in
detail identically, so there is no `PrdRow` / `TaskRow` pair anywhere below.

| Component | States | Seed | Extraction |
|---|---|---|---|
| `WorkList` | resting: `NextUpHero` over the priority hierarchy | `data-component="WorkList"` | **inline** |
| `WorkListFiltered` | filtering: **the hierarchy flattens** so filtering does not fight the tree | `data-component="WorkListFiltered"` | **inline** |
| `WorkFilter` | text plus state / label / type. Search is project-scoped. | `data-component="WorkFilter"` | **inline** |
| `NextUpHero` | a recommendation with **at most two earned reason chips** (`high priority` → `unblocked` → `next in <PRD>`, falling back honestly to `oldest untouched`) and **never a score**. Empty pool degrades in tiers: nothing unblocked · all in progress · backlog clear. "Nothing to do" says *which* nothing. With no dependency DAG the `unblocked` chip is **suppressed**, never faked. | `data-component="NextUpHero"` | **inline** |
| `BacklogCounts` | the `BACKLOG · BY PRIORITY` row. This is where the counters #201 cut from global chrome live, because they are room content and would have blanked out in two of three rooms. | prototype, `backlog counts — re-homed here from the shell bar` | **inline** over `SectionHeader` |
| `WorkHierarchy` | one level of nesting under parents, plus standalone root leaves | `data-component="WorkHierarchy"` | **inline** |
| `ParentGroup` | expandable, carrying an `n/m` child roll-up | `data-component="ParentGroup"` | **shared** within the room |
| `ChildRows` | the nested rail rows under a parent | `data-component="ChildRows"` | **inline** |
| `WorkRow` | `dot · id · title · priority`. Delivery signal is carried by the dot; PR chips appear only in detail. Selected parent and selected leaf select identically. A **blocked** item is shown but never recommended. | `data-component="WorkRow"` | **shared** within the room |
| `TicketDetail` | a scrolling main column with a sticky sidebar, so metadata stays put while the body scrolls | `data-component="TicketDetail"` | **inline** |
| `TicketMeta` | `id · type · breadcrumb` | `data-component="TicketMeta"` | **inline** |
| `TicketBody` | the body or spec, as markdown | `data-component="TicketBody"` | **inline** |
| `WorkItemStatus` | **the provider's own word, verbatim** (GitHub `Open`, Linear `In Progress`). The canonical five are an internal bucket for ranking, filtering and transitions and are **never shown in place of it**. `done` and `closed` stay distinct. A bare tracker exposes `todo` / `done` / `closed` only, with transitions greyed out. | registry, Work Item status | **shared** within the room |
| `ImplementAction` | leaf only, and the room's one primary action (`⌘⏎`). A parent shows its roll-up **in place of** Implement and offers drill only: work happens at leaves. | `data-component="ImplementAction"` | **inline** |
| `ChildItems` | the detail-side `Children` section, present on parents only | `data-component="ChildItems"` | **inline** |
| `Deliveries` | `0 · 1 · N`. N renders as stacked chips, which **is** the visible "two PRs is heavier" nudge. Multiple PRs per ticket are first-class. A teammate's PR with no local session renders here with **no session row**, an honest gap rather than a stub. | `data-component="Deliveries"` | **shared** within the room |
| `Properties` | the sticky sidebar's property block | `data-component="Properties"` | **inline** |
| `Labels` | provider labels, verbatim | `data-component="Labels"` | **inline** |
| `Relationships` | `blockedBy`, with blocker states **verified directly**. The provider's `blocked_by` summary count is stale and must not be trusted. | `data-component="Relationships"`; `CONTEXT.md` L1, Work Item | **inline** |

Next-up ranking is `priority desc → PRD sequence → age`, dumb and legible on purpose, over a pool
of open leaf `todo` unblocked session-less items. It is a **cold-start planner**, the highest-value
not-yet-started leaf to spawn, never a best-move-overall recommender: that is the attention
channel's job. It re-ranks as a live projection on provider-poll deltas and instantly on local
session start or stop, so it needs no timer. All of that is asserted in `buildWorkRoomModel`, not in
a component.

**With no provider connected there are no Work Items at all**, so this room hides whole rather than
rendering an empty backlog (matrix, Fallbacks).

---

## `rooms/code/`

Seven settled states: `editor · search · preview · empty · binary · bselect · bmanage`. The last
two are the shell's git menus, rendered here because this prototype is the chrome reference; they
belong to `shell/`.

| Component | States | Seed | Extraction |
|---|---|---|---|
| `FileExplorer` | the rail over the **primary working tree at its current branch**, so "which files am I looking at" has one answer | `data-component="FileExplorer"` | **inline** |
| `FileTree` | directories expand and collapse | `data-component="FileTree"` | **inline** |
| `FileTreeRow` | git status markers: modified dot · `A` added · `U` untracked | `data-component="FileTree"` rows; code-room spec, File explorer | **shared** within the room |
| `FileSearch` | one field, by file name **or** content (`⌘P`) | `data-component="FileSearch"` | **inline** |
| `SearchResults` | two groups: file-name matches (quick-open) first, then in-file matches with highlighted snippets and line numbers. Selecting a line opens the file there. | `data-component="SearchResults"` | **inline** |
| `EditorPane` | the main pane over a docked terminal | `data-component="EditorPane"` | **inline** |
| `EditorTabs` | per-tab **dirty** indicator | `data-component="EditorTabs"` | **inline** |
| `EditorCode` | a real, editable editor, not a read-only quick-look | `data-component="EditorCode"` | **inline** |
| `EditorStatus` | the status line under the editor | `data-component="EditorStatus"` | **inline** |
| `MarkdownToggle` | `Code / Preview`, shown for `.md` only | `data-component="MarkdownToggle"` | **inline** over `ToggleGroup` |
| `MarkdownPreview` | the rendered file | `data-component="MarkdownPreview"` | **inline** |
| `OpenInEditor` | `⌘E` hands the file or the project to an external editor, so Argo is never a dead end | `data-component="OpenInEditor"` | **inline** |
| `ScratchTerminal` | a PTY in the checkout's cwd attached to no agent, tagged `no agent`, docked and expandable, with `New` for another | `data-component="ScratchTerminal"` | **inline** over `TerminalPane` |
| `NoFileOpen` | the main pane's resting empty state | `data-component="NoFileOpen"` | **inline** over `EmptyState` |
| `EmptyFolder` | `This folder is empty`, with `New file` and `Open terminal` | `data-component="EmptyFolder"` | **inline** over `EmptyState` |
| `UnsupportedFile` | `This file can't be shown here`, with the size and type and `Open in VS Code ↗`. The limit is stated with its escape hatch. | `data-component="UnsupportedFile"` | **inline** over `EmptyState` |

A first-party edit surfaces as Workspace `dirty` / `unpushed` with **no separate state**: first-party
edits and agent edits are the same kind of fact. **There is no worktree browsing anywhere in v1**
(#202 upholding #183), so no tree-root picker and no worktree switcher appear above or may be added.

---

## Prototype names that are not components

Honouring the `data-component` seeds means also being explicit about the seeds that must **not**
become components. Six do not:

| Name | Why not |
|---|---|
| `PascalCaseName`, `ScreenName` | placeholders in `study-template.html`, not regions |
| `StateSwitcher` | the prototype harness's own state picker. It ships with the throwaway files and has no app counterpart. |
| `ConciergeToggle` | the `CONVERSATION` mode toggle, **cut by #201**. Chrome holds no seat for an undesigned subsystem. |
| `DeliveryStrip` | the moodboard's bottom strip. #201 moved the Concierge into the top bar and there is no bottom chrome. |
| `ActivityPanel`, `PanelTabs`, `PreviewPanel`, `ConsoleTail`, `Outcomes`, `SessionCard` | `cockpit-session-moodboard.html` is a pre-#158 look exploration on the retired four-panel session anatomy (Activity · Delivery · Preview · Console). The settled interior is **two tabs plus an always-on Dock**: Outcomes was cut (C2.2), the Console's job is the Dock's, and `SessionCard` is `SessionPlane`'s superseded synonym. Only `Roster`, `SessionPlane`, `SessionHeader`, `OrbMini`, `ConciergeStrip`, `ConciergeCaption`, `ProjectStrip`, `ProjectTab` and `RoomSwitcher` survive from this file, and each is cited above. |

`cockpit-delivery-review-prototype.html` and `cockpit-fresh-session-prototype.html` carry **no**
`data-component` names at all, and need none: the session-interior prototype absorbed both, and
their content is inventoried above as Delivery and as the Dock's `fresh` state.

---

## Unhomed and open

Named here so a room ticket does not silently invent a surface for them. Each is a real domain
object or a real decision with no settled home, which makes it a ticket, not a row above.

- **Preview has no home in the settled interior.** `CONTEXT.md` (Experience) keeps it as a
  cockpit-level singleton pointing at an Agent, ADR-0011 governs it, and `cockpit-spec.md` §1 says
  the singleton survives a project switch. But the settled session interior has **exactly two
  tabs**, and `cockpit-surface-matrix.md` still lists the session card's panels as `Activity ·
  Delivery · Preview · Console` under its own "provisional, reconciles as the surface tickets land"
  caveat. The two-tab decision is the newer one and wins, which leaves Preview specified and
  unplaced. It needs a ticket, not a guess.
- **Gate (`ask | auto` on create-PR, merge, push-after-PR)** is a domain object in the Autonomy
  cluster with no surface in any prototype, and no Preferences surface exists to hold it. Its only
  plausible home is the Delivery CTA's behaviour.
- **Usage beyond the context ring.** The ring renders context. `CONTEXT.md` also derives cost from
  an Argo-owned versioned pricing table, which nothing renders.
- **Work-room multi-select, bulk transitions and filtering depth**, beyond flatten-on-filter.
  `cockpit-spec.md` §13 flags it as unowned and deliberately unspecced: #172 settled `⌘K` and the
  keymap without it, and no surface ticket picked it up.
- **Onboarding has no prototype** (#205). `ConnectPanel` and `ConnectRow` above are built from a
  written spec plus the Phase 2 contract, so they are the two rows in this document most likely to
  need a design pass before they are committed.
- **Deploy and release** stay reserved lifecycle nodes, unwired until a code-host deploy signal
  exists.

---

## What this contract asks of a room ticket

- Compose the screen from the rows in your slice, and name nothing this document has not named. If
  you need a name that is missing, add the row here in the same change.
- Take values from `argo-tokens.css` only. A study that needed a value the contract lacks marks it
  a **proposal**, and promoting one is a contract change through `/design-foundations`, not an
  inline hex.
- Build **inline** rows inside the screen. Extract one to its own file when a second caller appears
  or when it has a state the screen does not exercise, which is what earns a story.
- Story the screen, plus each component you extract. Views get no unit tests: every story renders
  in CI as a smoke test, and pixel checks run on demand through `/visual-verify`.
- Assert derivations in `build<Room>Model`, not through the DOM. The roster's word priority, the
  worst-state roll-up, Next-up's ranking and the connection roll-up are pure functions and none of
  them needs a browser.
- Update `apps/desktop/scripts/module-boundaries.json` in the **same change** as any slice add,
  split or rename, and remove a retired panel domain from the map when you move its last file.
