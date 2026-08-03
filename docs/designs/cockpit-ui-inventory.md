# Cockpit UI inventory, the build contract

> **Wayfinder [#157](https://github.com/milad-alizadeh/argo/issues/157), Phase 3
> ([#263](https://github.com/milad-alizadeh/argo/issues/263)).** The component tree the shell and
> the three rooms are built from, named once, with its tier, its status, its states and its module
> slice.
>
> **This is a rebuild, not a retrofit.** The old `cockpit-inventory.md` was wiped with the rest of
> the pre-reset design set (PR #179) because it described the app being replaced. Nothing is
> carried over from it. Every row below is re-derived from three inputs and cites which:
> `cockpit-spec.md` (the assembled Phase 1 contract), the settled prototypes' own
> `data-component` names, and `argo-tokens.css` / `foundations.html` (the Phase 2 contract).
>
> **What this document is for.** A room ticket composes from this inventory instead of inventing
> one, and `componentize-design` consumes it. It fixes four things a build otherwise re-decides per
> file: the **name**, the **tier**, the **state set**, and the **slice**. It fixes neither markup
> nor pixels: the prototypes own the pixels and the token contract owns the values.

## How to read it

Six rules govern every row, and a row that breaks one is a bug in this document.

1. **Names come from the prototypes.** Every settled prototype carries
   `data-component="PascalCaseName"` on its meaningful regions. That name was decided in the
   study and is reproduced here verbatim. A name in the **Seed** column is a citation, not a
   proposal. Where a region has no `data-component` (the written specs have no prototype, and the
   session interior's own body predates the convention) the Seed column cites the owning spec
   section instead, and the name is coined here.
2. **States come from the matrix and the registry.** Every state traces to
   `cockpit-surface-matrix.md`, `cockpit-status-vocabulary.md`, `cockpit-failure-states-spec.md`,
   `CONTEXT.md`, or a prototype's own `?state=` list (22 states, enumerated in
   `cockpit-prototype-switcher.html`). No state is invented here. Where this document has to
   **compose** two settled facts into a mapping neither states outright, it says so in the row and
   repeats it under [Derived here, needs a bless](#derived-here-needs-a-bless). Where a needed
   state has no authority at all, it goes to [Unhomed and open](#unhomed-and-open) rather than
   getting filled in.
3. **Values come from the token contract.** `apps/desktop/src/renderer/src/styles/argo-tokens.css`
   settled by #262: one 9/11/13/15 sans ladder as the density, gold as the single accent **and**
   `needs you`, `done` quiet slate, planes by brightness. The prototypes' inline `:root` blocks
   are pre-contract drafts and are **not** an input to any row here.
4. **Tier decides what gets a file** (`rules/ui-components.md`). An **organism** is a screen or a
   self-contained domain section, and it is assembled in place: its markup lives in the room's
   screen. An **atom** or **molecule** gets its own file, because a lower-tier shape written inline
   inside an organism is a duplication bug even on first use. So the tier column is also the
   extraction rule, and `pure fn` marks a derivation with no markup at all.
5. **Status tracks drift** (`rules/design-studies.md`). `spec` means no component yet, so the
   prototype region is truth. `partial · <path>` means something exists and does not cover the
   row. `built · <path>` means the component and its stories are truth and the prototype region is
   allowed to go stale. A component that exists with no row here is a gap in this document, which
   is why [Retired, awaiting removal](#retired-awaiting-removal) enumerates the rest of the tree.
6. **A primitive is extended, never duplicated.** A "new" atom is usually an existing primitive
   plus a tone family. The kit below states, per primitive, whether it survives, changes, or is
   retired, and the changes are cited to the rule that forces them.

---

## Module slices

The target slice set is `cockpit-spec.md` §11.2, and `apps/desktop/scripts/module-boundaries.json`
carries it as of this change. The existing layer rules carry over unchanged in kind: slices are
mutually forbidden (a room never reaches into another room, the shell never reaches into a room,
and no new slice reaches into a retired panel domain), every slice may import `renderer-shared`,
and `renderer-shared` imports no slice. Composition of shell plus active room happens at the
renderer root, outside every slice, which is where `SessionScreen` composes the panel domains
today.

| Slice | Path | Public entry | Owns |
|---|---|---|---|
| `shell` | `src/renderer/src/shell/` | `shell/components/index.ts` | Project strip, the merged top bar and its four regions, the command palette, onboarding / Project Settings, the empty first-run seam, the disabled-project error |
| `rooms-sessions` | `src/renderer/src/rooms/sessions/` | `rooms/sessions/components/index.ts` | Roster rail, the session plane, header, Activity, Delivery, the Dock |
| `rooms-work` | `src/renderer/src/rooms/work/` | `rooms/work/components/index.ts` | List rail, the generic node tree, Next-up, ticket detail |
| `rooms-code` | `src/renderer/src/rooms/code/` | `rooms/code/components/index.ts` | Explorer, search, editor, scratch terminal, the degraded file states |
| `renderer-shared` | `src/renderer/src/shared/` | the `components/ui`, `components/ui/icons` and `status` barrels | The primitive kit, the icon set, the status word/tone vocabulary |

Two of the slice `Owns` cells add detail §11.2 does not spell out. `rooms-code` gains "search" and
"the degraded file states" from `cockpit-code-room-spec.md`, and `shell` gains "the
disabled-project error" from failure spec §6. Both are the same surfaces §11.2 lists, enumerated.

`renderer-shared/delivery/` **was renamed** to `renderer-shared/status/` (#284), because what it
actually holds is the status word and tone vocabulary that every room reads, and the old name
promised a Delivery coupling that the room slices must not have. The map carries one barrel for it.

---

## Retired, awaiting removal

**One panel domain is still standing.** `delivery/` derives from
ADR-0009's story/work split, which the redesign retires (`cockpit-spec.md` §12). It stays in the
boundary map while its code is on disk, so the gate keeps guarding it, and the entry is
removed by the ticket that moves its last file. Its components are listed here so that nothing
in the tree lacks a row. Four are **gone**: `roster/` (#267 rebuilt the rail inside
`rooms-sessions` and removed the module from the boundary map), `concierge/` (#284 deleted it whole,
ADR-0019 records why) and `activity/` (#261 deleted it whole, along with `rowCaret.ts` — `Run`, `Phase` and
`Actor` are retired vocabulary and #261's own criterion is that no such name survives anywhere.
`NowLine`'s successor is `NowHead` inside the Dock header row; `RosterRow`'s is `SessionRow`.
`rowCaret`'s one idea worth carrying — a non-expandable row still reserving the caret's width —
is recorded here for #272's generic node tree, which is the only thing that wanted it) and
`console/` (#268 deleted it whole: the channel strip died with the Console panel, and the PTY view
became the shared `TerminalPane`).

| Existing | Disposition |
|---|---|
| `domains/activity/components/rowCaret.ts` | **Delete, unless #272 wants the `reserved` rule.** Read by `RunRow`, `PhaseGroup` and `RosterRow`, all of which are deletions. Its one idea worth carrying is that a non-expandable row still reserves the caret's width, which the Work room's generic node tree will want. |
| `domains/delivery/components/`: `diffModel`, `nodeDrawerModel` | **Travel with the salvage (#269–#271).** These are the type modules beneath the components marked salvage above — `diffModel` under `FindingCard`/`FileDiff`/`AllFilesDiff`/`CommitGroup`, `nodeDrawerModel` under `NodeDrawer/*`. Moving a component without its type module is what makes a salvage import across the boundary instead of relocating. |
| ~~`domains/roster/`~~ | **Done (#267).** `Roster` and `SessionRow` were rebuilt onto the registry in `rooms/sessions/components/`, `ContextGauge` moved there unchanged for #268 to render as `ContextRing`, and `EmptyRoster` was **deleted**: the zero-state is the bare `+ New session` row, so there is no empty block to hold. |
| `domains/delivery/`: `Delivery`, `DeliveryTabs`, `DeliveryLifecycle`, `LifecycleNode`, `NodeDrawer/*`, `CiCard`, `CheckOutput`, `PrChecksList`, `PrAnchor`, `CommitGroup`, `FileDiff`, `AllFilesDiff`, `FindingCard`, `findingState`, `lifecycleNodeState` | **Salvage into `rooms-sessions`.** The lifecycle rail, the node drawer bodies, the check rows and the diff views all have rows below. Salvage means moving the file, never importing across the boundary. |
| ~~`domains/console/`~~ | **Done (#268).** The channel strip (`Console`, `ConsoleChannel`, `ConsoleChannelTab`) and its three derivations (`captureLabel`, `resolveActiveChannel`, `feedLines`) were **deleted** — the Dock is the session's one monospace surface and the Code room's scratch terminal is the other. `LiveTerminal` became `renderer-shared`'s `TerminalPane`, and `consoleChannels` did **not** travel with it: the pane takes its accessible name as a prop, so the channel vocabulary had nothing left to name. |
| Renderer root: ~~`SessionScreen`~~, ~~`SessionHeader`~~, ~~`WorkspaceIdentity`~~, `App` | **Done for three of four (#268); `App` stays the container.** #264 landed the root composition as `CockpitScreen` (the pure View: strip + bar + stage) over `RoomStage` (the room switch), so `SessionScreen` stays the **Sessions room** for #268 to rewrite rather than becoming the root. #267 took its RAIL (now `rooms/sessions/components/Roster`) and left the interior here: `SessionScreen` and `sessionScreenModel` render and type `domains/{console,delivery}`, which `rooms-sessions` is forbidden to import, so the interior moves with the salvage rather than ahead of it. `App` is the container. `RoomStage`'s Work and Code arms are scaffolding #272/#274 delete. #268 moved `SessionScreen` into `rooms/sessions/components/` and split `sessionScreenModel` into the room's four derivations; `SessionHeader` was rebuilt as the room's own, and `WorkspaceIdentity` was **deleted** — `SessionMeta`'s branch segment supersedes it. Its `sessionScreenModel.test.ts` stateMatrix sweep was dropped rather than re-based: `shared/status/stateMatrix.test.ts` already sweeps every S-row through `deliveryState` → `lifecycleModel`, so re-basing it would have been a second copy of that coverage. |

---

## renderer-shared: the primitive kit

### What survives

| Primitive | Tier | Status | Verdict and why |
|---|---|---|---|
| `Text` | atom | `built · shared/components/ui/Text.tsx` | **Keep unchanged.** Its variants already **are** the contract's type roles (`hero · headline · title · prose · row · row-strong · meta · eyebrow · tag · code · code-inline`). #262 settled the ladder these names read from, so the primitive needed no change and gets none. |
| `Button` | atom | `built · shared/components/ui/button.tsx` | **Keep, prune variants.** The `review-secondary` and `verdict-*` variants are ADR-0009-era. The settled Delivery has exactly **one** primary CTA per control line (`cockpit-spec.md` §4.3), so the variant set re-derives to primary · ghost · destructive plus the verdict washes `toneRecipes` already names. |
| `IconButton` | atom | `built · shared/components/ui/IconButton.tsx` | **Keep unchanged.** |
| `Badge` | atom | `built · shared/components/ui/badge.tsx` | **Keep.** Carries the two count-and-alarm jobs the settled control line needs: `Files (N)` and the red blocking badge on Code Review. No free-text status string is ever a Badge. |
| `StatusDot` | atom | `built · shared/components/ui/StatusDot.tsx` | **Keep, extend.** The single carrier of session state colour. Needs one addition: a **hollow** rendering for `external` (registry, Session status table). Extension of an existing primitive, not a new atom. |
| `Status` | molecule | `built · shared/components/ui/Status.tsx` | **Change.** It currently colours the word (`text-tone-${tone}`). The registry forbids that: state is carried by the dot, the word stays neutral dim text, no double-encoding. The word takes `--foreground-soft`; the tone reaches only the dot. |
| `Tabs` | molecule | `built · shared/components/ui/tabs.tsx` | **Keep.** Two callers: the session's `Activity · Delivery` pair and Delivery's `Overview · Code Review · Files` sub-tabs. The shell's room tabs are **not** this primitive (see `RoomSwitcher`). |
| `PanelSplitter` | molecule | `built · shared/components/ui/PanelSplitter.tsx` | **Keep.** Every master/detail surface in the app is a two-pane split, and the split is resizable in the prototypes. |
| `SectionHeader`, `PanelHeader` | molecule | `built · shared/components/ui/` | **Keep.** The eyebrow-plus-count header the Subagents group, the Timeline group and the Work rail's `BACKLOG · BY PRIORITY` row all share. |
| `AccentCard` | molecule | `partial · shared/components/ui/AccentCard.tsx` | **Audit before reuse.** Its tone family predates the contract's plane family (`--plane-top · --plane-bottom · --plane-cast` and their `-lit` pairs). Depth is brightness only now, and one frosted surface per region, never glass inside glass. Reconcile its tones onto the plane tokens in the first room ticket that renders a card. |
| `Checkbox`, `ToggleGroup`, `useDisclosure`, `toneRecipes`, the icon set | atom | `built · shared/components/ui/` | **Keep unchanged.** Nothing in the settled surfaces asks them to change. `ToggleGroup` is the Code room's `Code / Preview` lens and Delivery's `diff / rendered` artifact lens. |

### The status vocabulary, re-derived

`renderer-shared/status/` holds the one derivation every room reads. Today's `SESSION_STATUS` table
is pre-registry and disagrees with it in three ways, all of which are re-derivation work owned by
the first Sessions-room ticket:

- **The words themselves are wrong, not just their casing** (`Needs input` for the registry's
  `needs you`). The four words are `running · idle · needs you · failed`, plus no word at all for
  `external`. Casing is **not** a word change: the registry writes them lowercase and #267 renders
  the rail in caps, which is the eyebrow type role doing its job. The string in the table is the
  registry's; how a surface cases it is that surface's type decision.
- **The table's key set is the domain's, not the registry's.** `CONTEXT.md` L2 derives six session
  statuses (`running · permission · asking · idle · stopped · ended`); the registry shows four
  words. Exactly one leg of the fold is settled: `stopped` and `ended` both render `failed`
  (`cockpit-app-shell-spec.md`, Copy). The `permission | asking → needs you` leg is **derived
  here**, not stated by any settled document, and is listed as such below.
- **`queued` and `orphaned` are not registry states.** `orphaned` is a real domain posture
  (`CONTEXT.md` L2: a managed session whose owner is gone, observation-only with steering
  unrecoverable), and this document derives that it renders as an `external`-shaped row rather
  than earning a word. `queued` has no authority in any settled document and is dropped.

| Component | Tier | Status | States | Seed / authority |
|---|---|---|---|---|
| `sessionStatusWord` | pure fn | `built · shared/status/rosterStatus.ts` | the four words above, plus `external` (identity, no word) | registry, Session status |
| `deliveryClaimWord` | pure fn | `built · shared/status/rosterStatus.ts` | the registry's own delivery spellings: `blocked` · `CI failed` · `CI running` · `PR #42` · `landed`. The two attention words (`blocked`, `CI failed`) are read across the WHOLE lifecycle; a milestone stays head-scoped, so a dirty tree can suppress a milestone but never a failure. | registry, Delivery lifecycle (Merge/PR/CI states; the `CI failed` form is the registry's own Roster note) |
| `railStatus` | pure fn | `built · shared/status/rosterStatus.ts` | the priority pick: attention needs-input → attention failure → delivery milestone → liveness → kind. A delivery claim beats session status. Returns the word AND the dot from ONE pick over `railVocabulary.ts`'s state alphabet, so a row cannot report one state in text and another in colour. | `cockpit-spec.md` §4.1 |
| `worstStateDot` | pure fn | `built · shell/worstStateDot.ts` | `needs you > failed > running > none`, active project always `none` | registry, Attention |
| `connectionRollup` | pure fn | `spec` | `healthy` (renders nothing) · `stale` · `needs reconnect`, plus auth escalating past the roll-up. Keyed by **binding**, not project. | failure spec §2, §3 |

### Primitives the settled surfaces earn

Each is exercised by two or more slices, which is what makes it a primitive rather than a room's
own molecule.

| Primitive | Tier | Status | States | Seed / authority |
|---|---|---|---|---|
| `MasterDetail` | organism | `built · shared/components/ui/MasterDetail.tsx` | list-left navigation plus one continuous feed right, scroll-spy highlight, click-to-jump. The nav pane is a render prop, so each surface composes its own sections while the highlight and the jump stay the primitive's. **Not virtualised yet** — #268 built the interaction model and left the windowing to the first surface that measures a problem. | `cockpit-spec.md` §4.3, "Cross-surface interaction model": the whole cockpit shares one navigation feel |
| `GutterDiff` | organism | `partial · domains/delivery/components/FileDiff.tsx` | added · removed · context · anchored finding · comment thread · collapsed hunk | session-interior prototype, "self-contained GitHub gutter diffs (shared by every detail pane)" |
| `TerminalPane` | organism | `built · shared/components/ui/TerminalPane.tsx` | live · **unattached** (no PTY: it says so rather than painting a fake prompt) · expanded · collapsed. Dead-PTY `Relaunch` stays unbuilt — nothing reports a dead PTY yet. It takes `attach` as a prop rather than reading `window.cockpit`, so a primitive never knows the bridge (#268). | `CONTEXT.md`, Scratch terminal: "same PTY machinery as a session terminal, minus the agent" |
| `Menu` | molecule | `built · shared/components/ui/dropdown-menu.tsx` | closed · open · row enabled · row disabled with reason | `BranchMenu` and `BranchManage` (prototype seeds), the project tab context menu |
| `Tooltip` | molecule | `built · shared/components/ui/tooltip.tsx` | hidden · shown | the active project tab's name plus `last synced` (#201) is the only mandated tooltip in the shell |
| `EmptyState` | molecule | `spec` | one line of copy plus zero, one or two actions | the Code room's `EmptyFolder` / `NoFileOpen` / `UnsupportedFile`, the Work room's four empty-pool tiers. **Not** the roster zero-state: #267 settled that as the bare `+ New session` row, with no empty block at all |
| `useScrollSpy` | pure hook | `built · shared/components/ui/useScrollSpy.ts` | which feed section is in view, and the jump to one. `MasterDetail`'s half that is not markup; named here by #268 so the interaction model has one implementation rather than one per surface. | `cockpit-spec.md` §4.3 |
| `Kbd` | atom | `spec` | a rendered key hint | the canonical keymap is shown in the palette, not in chrome |

`TerminalPane` must import `@xterm/xterm/css/xterm.css`. Without it the pane renders ghost rows and
a solid selection block, because the character-measure span stays visible.

---

## `shell/`

The chrome is two fixed regions on one lit scene, and there is no bottom chrome: the bottom edge
belongs to the room. Chrome components render in **all three rooms** or they are not chrome. Every
row is `spec` unless stated.

| Component | Tier | Status | States | Seed |
|---|---|---|---|---|
| `ProjectStrip` | organism | `built · shell/components/project-strip/ProjectStrip.tsx` | one project · many · **none** (just `+`) | `data-component="ProjectStrip"` |
| `ProjectTab` | molecule | `built · shell/components/project-strip/ProjectTab.tsx` | active (quiet, never dotted) · inactive with worst-state dot (`needs you` / `failed` / `running` / none) · hovered (tooltip: the project's name, plus `last synced` only where that fact exists — it has no observed source yet, so the name shows alone). The **context-menu-open** state ships with the menu itself (#265): #264 left no dead right-click behind. | `data-component="ProjectTab"` |
| `TopBar` | organism | `built · shell/components/top-bar/TopBar.tsx` | one fixed layout: `[traffic lights] [orb + caption] ⋯ [chip] [room tabs] [git group]` | `cockpit-app-shell-spec.md`, Canonical chrome; the prototypes' `MERGED TOP BAR` sections |
| `WindowControls` | atom | `built · shell/components/top-bar/WindowControls.tsx` | a static clearance reserve, no states. `hiddenInset` clearance only: Argo draws no traffic lights. | `data-component="WindowControls"` |
| `ConciergeStrip` | organism | `built · shell/components/top-bar/ConciergeStrip.tsx` | seat only in v1: it renders the orb and the caption and owns no behaviour | `data-component="ConciergeStrip"` |
| `OrbMini` | molecule | `built · shell/components/top-bar/OrbMini.tsx` | `idle` in v1. The full state set belongs to map #190. Built as the **cheap CSS ring-orb** the shell spec names, NOT the salvaged three.js engine: the bar wants a 38px glyph, and `eclipseOrb/` stays the retired domain's until a room claims it. | `data-component="OrbMini"` |
| `ConciergeCaption` | atom | `built · shell/components/top-bar/ConciergeCaption.tsx` | silent (renders nothing) · caption text, width-capped so the right cluster keeps its room | `data-component="ConciergeCaption"` |
| `ConnectionChip` | molecule | `spec` | **healthy renders nothing, there is no green light** · `stale` with age and cause (`offline` / `unreachable` / `rate limited`) · `needs reconnect` (a button into the connect panel) · account-level auth, escalated past the roll-up | failure spec §3, placed first in the right cluster by #201 |
| `RoomSwitcher` | molecule | `built · shell/components/top-bar/RoomSwitcher.tsx` | active ∈ `Sessions ⌘1 · Work ⌘2 · Code ⌘3`. Not the `Tabs` primitive: it is a router, styled as floating chrome with no track. | `data-component="RoomSwitcher"` |
| `GitControls` | organism | `built · shell/components/git/GitControls.tsx` | present · **hidden whole** when the project folder is not a git repository | `data-component="GitControls"` |
| `BranchSelector` | molecule | `built · shell/components/git/BranchSelector.tsx` | clean · ahead · behind · diverged (ahead and behind) | `data-component="BranchSelector"` |
| `BranchMenu` | organism | `built · shell/components/git/BranchMenu.tsx` | per row: checkout-able local · remote `origin` ref offering `Check out` · worktree-held with a live session (`worktree` plus `↗ open its session`) · worktree-held and orphaned (`worktree` plus its **path**, no dead link) · a local checkout-able row additionally offering **`Delete`** (never the current branch, a worktree-held one, or a remote ref). Header reads "Files follow this". | `data-component="BranchMenu"` |
| `BranchManage` | organism | `built · shell/components/git/BranchManage.tsx` | `Fetch` always — **including on a diverged branch**, since fetching cannot lose work either · `Pull` only when fast-forward · `Push` only when ahead · `New branch` / `Rename`, each opening `BranchNameField` rather than firing without one. **No `Remove worktree`** (#202), and **no `Delete`**: this menu speaks for the checked-out branch, which git refuses to delete, so deleting moved to the branch rows where a branch is named. | `data-component="BranchManage"` |
| `ConflictHatch` | molecule | `built · shell/components/git/ConflictHatch.tsx` | shown only on diverged, beside the surviving `Fetch`: `Open a scratch terminal` · `Resolve with an agent ↗`. Argo ships no merge-conflict editor. | `data-component="ConflictHatch"` |
| `BranchMenuRow` | molecule | `built · shell/components/git/BranchMenuRow.tsx` | one row per ref, rendering the `BranchRowAction` the model derived. Extracted from `BranchMenu` at the line ceiling; named here by #264. | `data-component="BranchMenu"` (its rows) |
| `BranchNameField` | molecule | `built · shell/components/git/BranchNameField.tsx` | the name `New branch` / `Rename` need: empty (submit refused) · named. Opened in place of the row firing, because an operation with no name can only fail. Named here by #264. | `cockpit-app-shell-spec.md`, Manage menu (branch CRUD) |
| `TrackingCounts` | atom | `built · shell/components/git/TrackingCounts.tsx` | `↑ahead ↓behind`, each count silent at zero. One spelling shared by `BranchSelector` and every branch row. Named here by #264. | the spec's own `[⎇ main ↑2↓1 ▾]` notation |
| `CommandPalette` | organism | `spec` | closed · open and empty · results grouped (sessions · tickets · projects · commands) · no results. **No affordance in the bar.** | `cockpit-app-shell-spec.md`, ⌘K |
| `EmptyShell` | organism | `built · shell/components/EmptyShell.tsx` | the strip shows only `+`, one connect seam that hands off to the connect panel | `cockpit-app-shell-spec.md`, Connective tissue |
| `ConnectPanel` | organism | `spec` | `welcome · fresh · direct · connecting · partial · wired · error` | `cockpit-onboarding-spec.md`, States. **No prototype exists** (#205), so the pixels are Phase 2's contract plus this spec. |
| `ConnectRow` | molecule | `spec` | per row (Folder · Connections · Companion plugin), independently: unset · set · `connecting` (shows the device code and verification URL, it does not spin blind) · error offering `Continue offline` and `Reconnect` | `cockpit-onboarding-spec.md`, Shape |
| `AgentCliRow` | molecule | `spec` | the project's Agent/CLI choice. The one thing Project Settings holds that onboarding does not. | `cockpit-app-shell-spec.md`, Project Settings (#186 / #202) |
| `ProjectDisabled` | organism | `spec` | one error offering `Relocate` (first-class, the id survives and the path is re-pointed) or `Remove` | failure spec §6 |

The shell's own derivations, added by #264 because the chrome's refusals belong in tested pure
functions rather than in a View's branches. Each lives inside the slice and reaches the renderer
root through its barrel.

| Component | Tier | Status | States | Seed / authority |
|---|---|---|---|---|
| `buildShellModel` | pure fn | `built · shell/shellModel.ts` | the strip's tabs: active (dot forced to none) · inactive carrying `worstStateDot` · `connected` false when no project is registered | `cockpit-app-shell-spec.md`, Canonical chrome |
| `branchMenuRows` | pure fn | `built · shell/branchMenuModel.ts` | one `BranchRowAction` per ref: `current` · `checkout` · `worktree-session` · `worktree-orphaned`. The last two are the menu's refusals, so no View decides them. | `cockpit-app-shell-spec.md`, Global git chrome (#202) |
| `liveWorktreeSessions` | pure fn | `built · shell/branchMenuModel.ts` | worktree path → the roster session working in it. The label follows git; the link follows the session. | `cockpit-app-shell-spec.md`, Global git chrome (#202) |
| `manageMenu` | pure fn | `built · shell/branchMenuModel.ts` | `fetch` always · `pull` only fast-forward · `push` only ahead · CRUD always · `diverged` swaps the sync group for `ConflictHatch` | `cockpit-app-shell-spec.md`, Manage menu + Conflict policy |
| `shellCommand` | pure fn | `built · shell/shellCommand.ts` | the canonical keymap as one table: `⌘1/⌘2/⌘3` · `⌘[`/`⌘]` · `⌘K` · `⌘N` · `Esc` | `cockpit-app-shell-spec.md`, Canonical keymap |
| `recallProjectUi` · `rememberProjectUi` · `nextProjectId` | pure fn | `built · shell/projectUi.ts` | the remembered room and selection per project, and where `⌘[`/`⌘]` land. A swap is a view change, not a teardown. | `cockpit-app-shell-spec.md` (#164) |

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

| Component | Tier | Status | States | Seed |
|---|---|---|---|---|
| `Roster` | organism | `built · rooms/sessions/components/Roster.tsx` | populated · **zero-state is just the `+ New session` row** (a one-time transient costs no permanent chrome) · archived list open | `data-component="Roster"` |
| `SessionRow` | molecule | `built · rooms/sessions/components/SessionRow.tsx` | `dot · name · word` over `model · branch`. Dot: running green · idle grey · needs-you gold · failed red · external **hollow** — and it follows THE WORD, so a `blocked` row is gold and sweeping and a `CI failed` row is red, whatever the session status underneath says. Row: selected · unselected · external (ghosted, so read-only awareness looks different from a session you can drive). | `data-component="SessionRow"` (study template) |
| `RailActionRow` | molecule | `built · rooms/sessions/components/RailActionRow.tsx` | the quiet glyph+label row both ends of the rail wear, over the `Button` primitive. One shape, two labels — extracted rather than written twice. | the two rows below |
| `NewSessionRow` | molecule | `built · rooms/sessions/components/NewSessionRow.tsx` | pinned quiet at the top. `⌘N` spawns zero-config at the project root. | `cockpit-spec.md` §4.1 |
| `ArchivedFooter` | molecule | `built · rooms/sessions/components/ArchivedFooter.tsx` | `⚙ Archived (n)`. Archiving is a status transition, never a button. | `cockpit-spec.md` §4.1 |

Order is stable by most-recent activity and **attention never reorders the list**. Ordering is a
model concern, asserted in `buildSessionsRoomModel`, not a component state.

### The session plane

| Component | Tier | Status | States | Seed |
|---|---|---|---|---|
| `SessionScreen` | screen | `built · rooms/sessions/components/SessionScreen.tsx` | rail alone (nothing selected, which is also `zero`) · rail + plane. Pure View: it writes the room's three layout px onto `--c-rail`/`--c-act`/`--r-dock` and nothing inside sizes off a token. | the room itself; named here by #268, which moved it off the renderer root |
| `SessionPlane` | organism | `built · rooms/sessions/components/SessionPlane.tsx` | one continuous glass surface holding header, tabs, body and Dock. Per settled state: `fresh · activity · idle · delivery* · external`. Absent in `zero`. | `data-component="SessionPlane"`; the settled prototype's own section reads `SESSION CARD (one continuous glass)`. The plane spelling matches the contract's plane family; `SessionCard` is recorded as its superseded synonym so no ticket coins both. |
| `SessionHeader` | organism | `built · rooms/sessions/components/SessionHeader.tsx` | one band, glance only: **no action buttons and no `⋯` menu**. Takes per state: running · idle · external · fresh. | `data-component="SessionHeader"` |
| `ContextRing` | atom | `built · rooms/sessions/components/ContextRing.tsx` | honest `~n%` · **empty ring reading `unknown`** for external · `—`/`unknown` for a session whose context Argo cannot establish, which is also the fresh-session reading. An estimate is never dressed as a measurement — hence the tilde, and hence the ring drawing NO arc rather than one that could read as `0%`. **The estimate is `contextEstimate.ts`: the newest turn's input side (prompt + cache reads) over an Argo-owned model→window table. That table is derived here and wants a bless** — an id it does not know yields `unknown` rather than a guessed window. | `cockpit-spec.md` §4.2 |
| `SessionMeta` | molecule | `built · rooms/sessions/components/SessionMeta.tsx` | order is fixed: `status · model · mode · branch(+∆/↑) · elapsed · intent ↗`. Collapses the intent chip to `#<n> ↗` when the session is titled from its ticket. External drops `intent` (read-only). `mode ∈ Ask · Plan · Code · unknown`. The branch segment sheds the branch NAME once there is a `∆`/`↑` to report — the top bar and the roster row already named it. **`elapsed` is claimed only where it is observable**: a running turn's start is not in the runtime tree, so the segment is absent rather than reporting the age of the last record as a duration. | `cockpit-spec.md` §4.2; `CONTEXT.md`, Autonomy cluster |
| `SessionTabs` | molecule | `built · rooms/sessions/components/SessionTabs.tsx` | **exactly two**: `Activity · Delivery`. Outcomes was cut (C2.2). | `cockpit-spec.md` §4.2 |

The title resolves through a stable fallback chain (explicit name → linked ticket →
conversation-derived) and never rewrites per turn, so the rail and the header always match. That is
a model rule, not a component state.

The room's own derivations, added by #268 for the same reason the shell has its own: what the
interior refuses to claim belongs in a tested pure function rather than in a View's branches. Each
lives inside the slice and reaches the renderer root through its barrel.

| Component | Tier | Status | States | Seed / authority |
|---|---|---|---|---|
| `buildSessionInterior` | pure fn | `built · rooms/sessions/interiorModel.ts` | one Session + the room's UI state → header, tab, Activity, Dock, plus `fresh` (nothing observed yet, so the Dock is home) | `cockpit-spec.md` §4.2 |
| `buildInteriorHeader` | pure fn | `built · rooms/sessions/interiorHeader.ts` | the title as resolved, the ring's estimate, the meta line in its ONE fixed order, and the intent chip's two forms. A segment Argo cannot establish is ABSENT, except model and mode, whose absence is worth saying out loud. | `cockpit-spec.md` §4.2 |
| `contextPercent` · `contextWindow` · `sessionUsage` | pure fn | `built · rooms/sessions/contextEstimate.ts` | the ring's arc, or `null` when either half of the estimate is missing. External floors at `null` by POSTURE, not by data. | `CONTEXT.md`, Usage; `cockpit-spec.md` §4.2 |
| `subagentGroup` · `stepDot` | pure fn | `built · rooms/sessions/interiorSubagents.ts` | the group and its rows, plus the blueprint tier read off what the tree carries: `phased` (a group name) · `labelled` (labels only) · `flat`. Nothing fills a tier in. | `CONTEXT.md` L3, sub-agent grouping |
| `buildActivity` | pure fn | `built · rooms/sessions/interiorActivity.ts` | the timeline newest-first, each turn's steps and plan, the compaction marks, and the ONE ordered item list both panes read. An unparseable transcript yields an empty surface, not an error. | `cockpit-failure-states-spec.md` §8 |
| `buildDock` · `nowHead` | pure fn | `built · rooms/sessions/interiorDock.ts` | `pty` for a session Argo drives, `transcript` for one it only watches; the now-head's task, plan and `last`. | `cockpit-spec.md` §4.2 |

### Dock

| Component | Tier | Status | States | Seed |
|---|---|---|---|---|
| `Dock` | organism | `built · rooms/sessions/components/Dock.tsx` | always-on and expandable: collapsed (header row only) · expanded · **fresh, where the Dock is home** (the invitation body lifted from the fresh-session study) | session-interior prototype, `TERMINAL DOCK` and `FRESH SESSION` sections |
| `NowHead` | molecule | `built · rooms/sessions/components/NowHead.tsx` | current task plus plan `N/M`, living **in** the Dock header row, not on a line of its own | prototype: "now-head lives IN the dock header row" |

**You steer by typing at the Dock's prompt and stop with Ctrl-C.** There is no steer widget and no
Stop button, so neither is in this inventory. A `permission` prompt is answered here too: it is a
DIRECT managed-only fact that arrives in the PTY, and inventing a separate approval surface for it
would contradict the one-steering-channel decision.

### Activity

Two-pane master/detail over `MasterDetail`. **The retired runtime vocabulary does not appear**:
`RunRow`, `AgentRow`, `PhaseGroup`, `phaseState` and `agentState` are gone with `Run`, `Phase` and
`Actor` (`cockpit-spec.md` §11.3). The locked tree is `Agent · Subagent · Turn · Tool Call · Plan ·
Workspace · Compaction · Usage`.

| Component | Tier | Status | States | Seed |
|---|---|---|---|---|
| `ActivityPane` | organism | `built · rooms/sessions/components/ActivityPane.tsx` | left holds a `Subagents` group above a `Timeline` list, right holds the selected item's detail | prototype, `Activity master–detail` |
| `SubagentGroup` | organism | `built · rooms/sessions/components/SubagentGroup.tsx` | one collapsible group, **never interleaved into the timeline and never cards**. Blueprint degrades per CLI: full phased (Claude Code) · labelled tree, no phases (Codex) · flat `N subagents running` (bare). The cockpit never invents a phase a CLI did not report. | prototype, `Subagents = its own section`; `CONTEXT.md` L3 blueprint |
| `SubagentRow` | molecule | `built · rooms/sessions/components/SubagentRow.tsx` | `dot · name · target · status`, dense enough to scale to ~30 | prototype, "Dense rows scale to ~30" |
| `TurnTimeline` | organism | `built · rooms/sessions/components/TurnTimeline.tsx` | the step list, folded by default | prototype, `folded Turn timeline` |
| `TurnRow` | molecule | `built · rooms/sessions/components/TurnRow.tsx` | stop reason ∈ `end_turn · max_tokens · max_turn_requests · refusal · cancelled · unknown`. `unknown` is rendered, never guessed. | `CONTEXT.md` L3, Turn |
| `ToolCallRow` | molecule | `built · rooms/sessions/components/ToolCallRow.tsx` | status `pending · in_progress · completed · failed`; kind read/edit/execute/search; target file | `CONTEXT.md` L3, Tool Call |
| `PlanProgress` | molecule | `built · rooms/sessions/components/PlanProgress.tsx` | `N/M` plus per-entry `pending · in_progress · completed` | `CONTEXT.md` L3, Plan |
| `CompactionMarker` | molecule | `built · rooms/sessions/components/CompactionMarker.tsx` | rendered **in** the turn sequence with the resume chain stitched across it, so condensed history reads as continuous | `cockpit-spec.md` §4.2 |
| `rowRecipes` | pure fn | `built · rooms/sessions/components/rowRecipes.ts` | the ONE box and the ONE selected wash every row of the Activity list wears — `SubagentRow` and `ToolCallRow` — so the two sections read as one list. Selection is an ink wash, never a fill: the dot is already carrying that row's state. Named here by #268. | `penumbra` token contract (#262) |
| `AgentFeed` | organism | `built · rooms/sessions/components/AgentFeed.tsx` | the detail pane: the selected subagent's live feed, or the selected step's prose | prototype, `detail pane` |

An unparseable transcript renders `unknown` on the affected fact and **leaves the dot alone**.
Observation failure is not work failure, and red is reserved for the work actually breaking.

#### Reconciled against the prototype (#268, second pass)

The first build of this surface carried the interaction model but not the treatment. What the
reconciliation settled, so a reader is not left diffing screenshots:

- **State words come from one registry** (`rooms/sessions/activityWords.ts`), never from an enum
  identifier: `queued · running · done · failed` for a tool call, the same three a subagent row
  derives, and a turn's own stop reason verbatim. `in_progress` is a type name and never reaches a
  surface. The prototype spells a live subagent `live`; this is deliberately `running` instead —
  `cockpit-status-vocabulary.md`'s one rule is that a state has exactly one word everywhere, and
  two words for "working" is the thing that rule forbids.
- **A detail section's state word is told once**, in its head, held to the section's own right edge.
  Event rows carry no word: the gutter label burns `tone-red` for the call that failed, which is one
  channel for one state.
- **The event gutter is a column, not a prefix** — `--space-kind-col`, sized to the longest kind at
  the tag ramp. The first build used the 24px marker column and `COMPLETED` overran its box and
  painted over the content beside it.
- **A meta line is mono at its own case**, never the uppercasing `tag` role: a path shouted back as
  `ROTATION.TS` is not the string that was observed.
- **A turn is a card** (`TURN_CARD` in `rowRecipes.ts`), flat and inset with a lit lip — never a
  second glass layer inside the panel. A folded turn reports `N tools` rather than going silent.
- **The compaction mark renders UNDER the turn it precedes**, because the list runs newest first.
- **Plan entries carry a mark, not a dot** (`✓ · ▶ · ○`): a dot would put a to-do line in the same
  channel as a running tool call.
- **The tab strip uses the `rail` seat** — underlined in the attention ink, not seated on a filled
  pill, because it lives inside the header band.

Still divergent from `cockpit-session-interior-prototype.html`, and why:

| Prototype has | Why it is absent |
|---|---|
| `Turn · "wire verify()"` | `Turn` carries no prompt text. Wiring one is a transcript-parser change, not a rendering one — a label would be invented here. |
| Coalesce metrics on a plan step (`×4`, `+180`) | nothing in the tree counts repeats or diff lines yet. |
| `8 tools · 6m` on a folded turn | the tool count ships; the duration needs a turn START, which the tree does not carry (same gap as the header's `elapsed`). |
| A diff peek under a step's detail | the Diff belongs to Delivery (#269–#271); reaching for it here would cross a seam this ticket does not own. |
| Left rail listing **plan steps** as the selectable unit | this build keys the feed on **tool calls** — the ACP-native observable. Which unit the two panes address is an interaction decision, not a style one, and is left standing rather than swapped silently. |

### Delivery

One review surface across the pre-PR / PR-open boundary, reshaping only its rail and its CTA.

| Component | Tier | Status | States | Seed |
|---|---|---|---|---|
| `DeliveryPane` | organism | `spec` (the tab exists and says what it is waiting for; #268 left the review surface to #269–#271, and `domains/delivery/` is no longer composed by anything) | the same two-pane master/detail as Activity; the sub-tab selects what the left list contains | prototype, `DELIVERY master–detail two-pane` |
| `DeliveryControlLine` | organism | `spec` | one line: sub-tabs with badges, the lifecycle rail, one CTA. **No trailing free-text status string.** | prototype, `ONE control line` |
| `DeliverySubTabs` | molecule | `partial · domains/delivery/components/DeliveryTabs.tsx` | `Overview · Code Review · Files (N)`, with a red blocking badge on Code Review | `cockpit-spec.md` §4.3 |
| `LifecycleRail` | organism | `partial · domains/delivery/components/DeliveryLifecycle.tsx` | a **state readout, not navigation**. It never tries to be a router. | prototype, `CI pipeline rail`; matrix rows 5 to 9 |
| `LifecycleNode` | molecule | `partial · domains/delivery/components/LifecycleNode.tsx` | Commit `N dirty · committed · clean` · PR `no PR · PR #42 → main · draft` · CI `running · passing · failing` (+ `N running` / `N failed` aggregate) · Review agent `approved · changes requested · N findings`, human `approved · changes requested · pending` · Merge `blocked · ready · landed` · Deploy **reserved and unwired** | registry, Delivery lifecycle |
| `NodeDrawer` | organism | `partial · domains/delivery/components/NodeDrawer/` | per node: commit list plus local check output · PR meta and description with a deep link · `runs[]`, one row per check with durations and a failure note · the human review | matrix rows 5 to 9 |
| `CheckRow` | molecule | `partial · domains/delivery/components/PrChecksList.tsx` | `running · passed · failed · skipped · neutral`, mirroring the code host's own conclusions verbatim | registry, Check |
| `PrimaryCta` | molecule | `spec` | one button that reshapes across the pre-PR / PR-open boundary. The `delivery-prepr` state is exactly this reshape. | `cockpit-spec.md` §4.3 |
| `WalkthroughList` / `ChangeRow` | organism / molecule | `spec` | narrated changes that expand to their hunks, so a huge agent diff is legible before you read code. A row carries only a small `●` marker when a finding lives on it: the finding's full text lives in Code Review alone. | prototype, `Overview — PR body + narrated changes table` |
| `FindingsInbox` / `FindingRow` | organism / molecule | `spec` | severity-ranked, plus a collapsed `✓ N fixed since the last review` reconcile group at the foot. A new finding is tagged `new`. The list converges instead of piling up. | prototype, `Code Review — findings inbox` |
| `FindingCard` | molecule | `partial · domains/delivery/components/FindingCard.tsx` | anchored evidence inline, with `Apply fix · Dismiss` | prototype, feed sections |
| `ChangedFileList` / `ChangedFileRow` | organism / molecule | `partial · domains/delivery/components/AllFilesDiff.tsx` | GitHub-style sticky tree, per-file `Viewed`, findings anchored on the exact line. Named apart from the Code room's `FileTree` deliberately: same idiom, different data and different slice, and one name across two slices would invite a shared component that neither wants. | prototype, `Files — GitHub tree + gutter diff` |
| `ArtifactLens` | molecule | `spec` | `diff` (default) · `rendered`, per section | prototype, `per-file diff/rendered lens` |
| `DiffCommentThread` | molecule | `spec` | comment on any diff line; pending comments batch | `cockpit-spec.md` §4.3 |
| `PendingCommentBar` | molecule | `spec` | `Address with agent →` · `Submit review`. One primitive for iteration. | `cockpit-spec.md` §4.3 |

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
detail identically, so there is no `PrdRow` / `TaskRow` pair anywhere below. Nothing in this room
exists yet, so every row is `spec`.

| Component | Tier | States | Seed |
|---|---|---|---|
| `WorkList` | organism | resting: `NextUpHero` over the priority hierarchy | `data-component="WorkList"` |
| `WorkListFiltered` | organism | filtering: **the hierarchy flattens** so filtering does not fight the tree | `data-component="WorkListFiltered"` |
| `WorkFilter` | molecule | text plus state / label / type. Search is project-scoped. | `data-component="WorkFilter"` |
| `NextUpHero` | organism | a recommendation with **at most two earned reason chips** (`high priority` → `unblocked` → `next in <PRD>`, falling back honestly to `oldest untouched`) and **never a score**. Empty pool degrades in tiers: nothing unblocked · all in progress · backlog clear. "Nothing to do" says *which* nothing. With no dependency DAG the `unblocked` chip is **suppressed**, never faked. | `data-component="NextUpHero"` |
| `BacklogCounts` | molecule | the `BACKLOG · BY PRIORITY` row. This is where the counters #201 cut from global chrome live, because they are room content and would have blanked out in two of three rooms. | prototype, `backlog counts, re-homed here from the shell bar` |
| `WorkHierarchy` | organism | one level of nesting under parents, plus standalone root leaves | `data-component="WorkHierarchy"` |
| `ParentGroup` | molecule | expandable, carrying an `n/m` child roll-up | `data-component="ParentGroup"` |
| `ChildRows` | molecule | the nested rail rows under a parent | `data-component="ChildRows"` |
| `WorkRow` | molecule | `dot · id · title · priority`. Delivery signal is carried by the dot; PR chips appear only in detail. Selected parent and selected leaf select identically. A **blocked** item is shown but never recommended. | `data-component="WorkRow"` |
| `TicketDetail` | organism | a scrolling main column with a sticky sidebar, so metadata stays put while the body scrolls | `data-component="TicketDetail"` |
| `TicketMeta` | molecule | `id · type · breadcrumb` | `data-component="TicketMeta"` |
| `TicketBody` | organism | the body or spec, as markdown | `data-component="TicketBody"` |
| `WorkItemStatus` | atom | **the provider's own word, verbatim** (GitHub `Open`, Linear `In Progress`). The canonical five are an internal bucket for ranking, filtering and transitions and are **never shown in place of it**. `done` and `closed` stay distinct. A bare tracker exposes `todo` / `done` / `closed` only, with transitions greyed out. | registry, Work Item status |
| `ImplementAction` | molecule | leaf only, and the room's one primary action (`⌘⏎`). A parent shows its roll-up **in place of** Implement and offers drill only: work happens at leaves. | `data-component="ImplementAction"` |
| `ChildItems` | organism | the detail-side `Children` section, present on parents only | `data-component="ChildItems"` |
| `Deliveries` | molecule | `0 · 1 · N`. N renders as stacked chips, which **is** the visible "two PRs is heavier" nudge. Multiple PRs per ticket are first-class. A teammate's PR with no local session renders here with **no session row**, an honest gap rather than a stub. | `data-component="Deliveries"` |
| `Properties` | molecule | the sticky sidebar's property block | `data-component="Properties"` |
| `Labels` | molecule | provider labels, verbatim | `data-component="Labels"` |
| `Relationships` | molecule | `blockedBy`, with blocker states **verified directly**. The provider's `blocked_by` summary count is stale and must not be trusted. | `data-component="Relationships"`; `CONTEXT.md` L1, Work Item |

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
belong to `shell/`. Nothing in this room exists yet, so every row is `spec`.

| Component | Tier | States | Seed |
|---|---|---|---|
| `FileExplorer` | organism | the rail over the **primary working tree at its current branch**, so "which files am I looking at" has one answer | `data-component="FileExplorer"` |
| `FileTree` | organism | directories expand and collapse | `data-component="FileTree"` |
| `FileTreeRow` | molecule | git status markers: modified dot · `A` added · `U` untracked | `data-component="FileTree"` rows; code-room spec, File explorer |
| `FileSearch` | molecule | one field, by file name **or** content (`⌘P`) | `data-component="FileSearch"` |
| `SearchResults` | organism | two groups: file-name matches (quick-open) first, then in-file matches with highlighted snippets and line numbers. Selecting a line opens the file there. | `data-component="SearchResults"` |
| `Editor` | organism | the whole editor region: tab bar over the code surface over the status line, with the scratch terminal docked beneath. The seed names the region; `EditorPane` below is the same region's inner frame in the prototype's markup, and this inventory keeps only the outer name plus the three parts, so a build does not create two wrappers for one region. | `data-component="Editor"`, `data-component="EditorPane"` |
| `EditorTabs` | molecule | per-tab **dirty** indicator | `data-component="EditorTabs"` |
| `EditorCode` | organism | a real, editable editor, not a read-only quick-look | `data-component="EditorCode"` |
| `EditorStatus` | molecule | the status line under the editor | `data-component="EditorStatus"` |
| `MarkdownToggle` | molecule | `Code / Preview`, shown for `.md` only | `data-component="MarkdownToggle"` |
| `MarkdownPreview` | organism | the rendered file | `data-component="MarkdownPreview"` |
| `OpenInEditor` | molecule | `⌘E` hands the file or the project to an external editor, so Argo is never a dead end | `data-component="OpenInEditor"` |
| `ScratchTerminal` | organism | a PTY in the checkout's cwd attached to no agent, tagged `no agent`, docked and expandable, with `New` for another. Its output region (`ScratchOutput`) is `TerminalPane`, not a component of its own: the seed marks where the shared pane mounts. | `data-component="ScratchTerminal"`, `data-component="ScratchOutput"` |
| `NoFileOpen` | molecule | the main pane's resting empty state | `data-component="NoFileOpen"` |
| `EmptyFolder` | molecule | `This folder is empty`, with `New file` and `Open terminal` | `data-component="EmptyFolder"` |
| `UnsupportedFile` | molecule | `This file can't be shown here`, with the size and type and `Open in VS Code ↗`. The limit is stated with its escape hatch. | `data-component="UnsupportedFile"` |

A first-party edit surfaces as Workspace `dirty` / `unpushed` with **no separate state**: first-party
edits and agent edits are the same kind of fact. **There is no worktree browsing anywhere in v1**
(#202 upholding #183), so no tree-root picker and no worktree switcher appear above or may be added.

---

## Prototype names that are not components

Honouring the `data-component` seeds means also being explicit about the seeds that must **not**
become components. Eleven names, in five groups, do not:

| Name | Why not |
|---|---|
| `PascalCaseName`, `ScreenName` | placeholders in `study-template.html`, not regions |
| `StateSwitcher` | the prototype harness's own state picker. It ships with the throwaway files and has no app counterpart. |
| `ConciergeToggle` | the `CONVERSATION` mode toggle, **cut by #201**. Chrome holds no seat for an undesigned subsystem. |
| `DeliveryStrip` | the moodboard's bottom strip. #201 moved the Concierge into the top bar and there is no bottom chrome. |
| `ActivityPanel`, `PanelTabs`, `PreviewPanel`, `ConsoleTail`, `Outcomes`, `SessionCard` | `cockpit-session-moodboard.html` is a pre-#158 look exploration on the retired four-panel session anatomy (Activity · Delivery · Preview · Console). The settled interior is **two tabs plus an always-on Dock**: Outcomes was cut (C2.2), the Console's job is the Dock's, and `SessionCard` is `SessionPlane`'s superseded synonym. Only `Roster`, `SessionPlane`, `SessionHeader`, `OrbMini`, `ConciergeStrip`, `ConciergeCaption`, `ProjectStrip`, `ProjectTab` and `RoomSwitcher` survive from this file, and each is cited above. |

Two further seeds are **folded into a neighbouring row rather than dropped**, and their rows say
so: `EditorPane` folds into `Editor`, and `ScratchOutput` folds into `ScratchTerminal` as the mount
point for the shared `TerminalPane`. That accounts for all 60 `data-component` names in the set.

`cockpit-delivery-review-prototype.html` and `cockpit-fresh-session-prototype.html` carry **no**
`data-component` names at all, and need none: the session-interior prototype absorbed both, and
their content is inventoried above as Delivery and as the Dock's `fresh` state.

---

## Derived here, needs a bless

Rule 2 says no state is invented. These three are **composed** from settled facts rather than
stated by any one document, so they are called out instead of being buried in a row. Each is a
one-line decision, not a design question, but the decision is this document's and not #157's.

- **`permission | asking → needs you`.** The registry has one attention state and `CONTEXT.md` L2
  has two blocked statuses; nothing says in one place that the two fold into the one. The fold
  follows from the notification rule (amber fires on the session wanting you) and from `permission`
  being managed-only, but it is stated here first.
- **`orphaned` renders as an `external`-shaped row.** `CONTEXT.md` L2 makes orphaned
  observation-only with steering unrecoverable, which is exactly external's posture, so it takes
  external's ghosted row and hollow dot rather than a word of its own.
- **`queued` is dropped.** It is in today's `SESSION_STATUS` table and in no settled document.
- **The model → context-window table** (`rooms/sessions/contextEstimate.ts`, #268). The ring shows an
  honest `~n%`, and `CONTEXT.md` maps context `used`/`size` onto ACP's session-level `UsageUpdate` —
  but nothing observes `size` today, and no settled document says where a window comes from. #268
  derives it as an Argo-owned versioned table keyed by the model-id prefix a transcript reports, the
  same shape `CONTEXT.md` sanctions for the pricing table, with **`unknown` for any id it does not
  know** rather than a guessed window. The *shape* is the decision that wants a bless; the numbers
  are a maintained fact like any published price.

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

MCP servers, the Concierge's brain and ticket comments are **not** in this list: `cockpit-spec.md`
§13 and `CONTEXT.md` already place them out of v1 scope, so having no surface is their settled
state rather than a gap.

---

## What this contract asks of a room ticket

- Compose the screen from the rows in your slice, and name nothing this document has not named. If
  you need a name that is missing, add the row here in the same change.
- Take values from `argo-tokens.css` only. A study that needed a value the contract lacks marks it
  a **proposal**, and promoting one is a contract change through `/design-foundations`, not an
  inline hex.
- Respect the tier: assemble organisms in the screen, and give every atom and molecule its own
  file, which is what earns it a story.
- Move a row's Status forward in the same change as the code (`spec` → `partial · <path>` →
  `built · <path>`), and if you land a name that diverged from the row, keep the old name in the
  row so the prototype anchor stays greppable.
- Story the screen, plus each component you extract. Views get no unit tests: every story renders
  in CI as a smoke test, and pixel checks run on demand through `/visual-verify`.
- Assert derivations in `build<Room>Model`, not through the DOM. The roster's word priority, the
  worst-state roll-up, Next-up's ranking and the connection roll-up are pure functions and none of
  them needs a browser.
- Update `apps/desktop/scripts/module-boundaries.json` in the **same change** as any slice add,
  split or rename, and remove a retired panel domain from the map when you move its last file.
