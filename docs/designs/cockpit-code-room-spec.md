# Code room spec

> **The HTML prototypes this file cites no longer exist.** They were retired with the Electron
> cockpit (ADR-0023); `README.md` → *What left, and where it went* says why, and
> `git log --diff-filter=D -- docs/designs/` finds them in history. What this file decides still
> stands — read a `*-prototype.html` reference as a pointer to a settled decision, not to a file
> you can open. The current pixels are `cockpit-sessions-liquid-glass.png`; the current component
> vocabulary is `apps/macOS`.

> Wayfinder #183, part of #157. The **light-IDE surfaces**: file explorer, lightweight
> editor, scratch terminal, open-in-editor. Visual source of truth:
> `docs/designs/cockpit-code-room-prototype.html` (Penumbra #158). Look/density are Phase 2.
> Derived from the settled prototype; it owns the Code room, and **spins out** two things it
> surfaced (global git chrome → shell spec #172; the worktree-enable question → #202, which
> answered *no setting* and left this spec's scoping intact).

## Placement

- A **third top-level room**: `Sessions ⌘1 · Tickets ⌘2 · Code ⌘3`. A peer room, not a mode.
- **Session-independent by construction** — a scratch terminal attaches to no agent; the
  explorer reads a working tree directly. It could never live inside the Session card.

## Scoping — the file view is a mirror of the checkout

- The explorer/editor mirror the project's **primary working tree** at its **current branch**.
- **Git checkout state is project-global chrome** (a branch chip in the shell), never a
  Code-room-only widget. Switch the branch globally, the files follow.
- **No workspace/worktree picker, no session framing.** In the domain an Agent has `0..1` owned
  Workspace (else inherits its parent's), and external sessions are just read from git — so
  "session ⇒ worktree" is false and is not assumed anywhere in this surface.

## Worktrees — primary checkout only; live worktrees are seen through their session

**Settled by #202. Argo observes worktrees; it does not create them and offers no setting to
enable them.** Spawn is zero-config at the project root (#186) and the CLI's own harness
relocates itself afterwards, so `Workspace.kind: main | worktree` is a *read* — DIRECT for a
managed session, DERIVED for an external one (`CONTEXT.md`). A project-level toggle was rejected
as the one dial that survived #186's cull and, worse, an unenforceable one: flipping it off
cannot stop a skill from running `git worktree add`. Argo would be displaying a preference as if
it were a fact.

- The Code room shows the **primary checkout** only. A branch held by a **live worktree** is
  **not checkout-able here** — the branch selector deep-links to that **session** (`Open session ↗`),
  where its files and diff already live. The orphan case (worktree outlives its session) is
  settled in the shell spec's git chrome, not here.
- File access inside a running worktree, outside its session, is via **Open in External Editor**
  (pointed at the worktree path). Pointing the Code root at an arbitrary directory is a possible
  additive upgrade later; it is deliberately out of v1.
- **There is nowhere in Argo to browse a live worktree's whole tree, and that is the v1
  answer** (#202). The session shows its **diff**; the Code room mirrors one root. A tree of a
  worktree is the primary tree plus that diff, so the missing case — reading an *untouched* file
  in a running session's context — is served by External Editor. The alternatives both cost more
  than they close: a root picker in the Code room is the workspace/worktree picker this spec
  removed, and a full-tree mode in the session grows a second file explorer inside a surface
  #161 specced as the product view.

## Surfaces

### File explorer

- A tree of the current checkout, with **git status markers** (modified dot, `A` added, `U`
  untracked). Directories expand/collapse.
- **Search** (`⌘P`) — one field, **by file name or content**. Results are two groups: **file-name
  matches** (quick-open) then **in-file matches** with **highlighted snippets** and line numbers;
  selecting a line opens the file there.

### Lightweight editor

- A **real, editable** code editor (not a read-only quick-look). Tabs, dirty indicator per tab.
  A first-party edit **changes files on the current branch** — it surfaces as Workspace
  `dirty`/`unpushed`, no separate state.
- **Markdown** — a `Code / Preview` toggle in the tab bar (shown only for `.md`) renders the file.
- **Open in editor** — `⌘E` hands the file (or project) off to an **external editor** (VS Code, etc.).

### Scratch terminal

- A plain **PTY in the checkout's cwd, attached to no agent** (tagged `no agent`) — the shell
  sibling of first-party file editing. Docked below the editor, expandable; `New` opens another.

## Global git chrome — RATIFIED into the shell spec (#201)

The branch control is project-global chrome, not owned by the Code room. #201 moved the whole
definition into `cockpit-app-shell-spec.md` → **Canonical chrome / Global git · checkout
chrome**, and put it in **all three rooms** (always the primary checkout). Read it there; this
surface is just where it was discovered.

## Shell chrome refinements — RATIFIED into the shell spec (#201)

Everything the Code-room prototype does with the chrome — merged floating top bar with no fill
or divider line, Concierge orb and caption inside it, no wordmark, no project label, borderless
project strip, macOS traffic-light clearance, `⌘K` with no button — is now the **shell's chrome
in every room**, not a Code-room look. **This prototype is the chrome reference**; the Tickets-room
and Session-interior prototypes were reconciled to it. Definitions live in
`cockpit-app-shell-spec.md` → **Canonical chrome**.

## Degraded / empty states (DIRECT is the floor — files read from disk)

- **Empty folder** — honest empty state (`This folder is empty`) with `New file` / `Open terminal`;
  the main pane shows `No file open`.
- **Unsupported / binary / too-large file** — `This file can't be shown here` with size/type and
  `Open in VS Code ↗`.
- **No folder connected** — the Code room defers to the shell's empty-shell seam → onboarding (#165).
- **Folder recorded but missing** — not a Code-room state: the whole project is disabled with one
  error (Relocate / Remove). See `cockpit-failure-states-spec.md` §6 (#173), which also owns git-op
  failure output — one-line summary at the control, real stderr in the scratch terminal.

## Spun out of #183

- **Global git/branch chrome** (chip, select/manage, sync, conflict hatch) and the shell chrome
  refinements → **settled by #201**, now in `cockpit-app-shell-spec.md`.
- **Project-level "enable worktrees" setting** + how the file view relates to **live** worktrees
  when agents work in parallel → **settled by #202: there is no such setting, and this spec's
  scoping stands unchanged.** See *Worktrees* above.
