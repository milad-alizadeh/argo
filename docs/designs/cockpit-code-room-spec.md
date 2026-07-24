# Code room spec

> Wayfinder #183, part of #157. The **light-IDE surfaces**: file explorer, lightweight
> editor, scratch terminal, open-in-editor. Visual source of truth:
> `docs/designs/cockpit-code-room-prototype.html` (Penumbra #158). Look/density are Phase 2.
> Derived from the settled prototype; it owns the Code room, and **spins out** two things it
> surfaced (global git chrome → shell spec #172; the worktree-enable question → its own ticket).

## Placement

- A **third top-level room**: `Sessions ⌘1 · Work ⌘2 · Code ⌘3`. A peer room, not a mode.
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

- The Code room shows the **primary checkout** only. A branch held by a **live worktree** is
  **not checkout-able here** — the branch selector deep-links to that **session** (`Open session ↗`),
  where its files and diff already live.
- File access inside a running worktree, outside its session, is via **Open in External Editor**
  (pointed at the worktree path). Pointing the Code root at an arbitrary directory is a possible
  additive upgrade later; it is deliberately out of v1.

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

## Global git chrome — SPUN OUT → app-shell spec amendment (#172)

The branch control is project-global chrome, not owned by the Code room. Captured here because
this surface drove it; it belongs in the shell spec.

- **Two-button group**: `[⎇ branch · ↑ahead ↓behind ▾]` (select) · `[⋯]` (manage).
- **Select menu** — local branches + **remote/`origin` refs**, each with ahead/behind; a
  worktree-held branch shows `worktree` + `↗` (open session); a remote ref offers `Check out`.
- **Manage menu** — **safe sync only** (`Fetch`, `Pull` when fast-forward, `Push` when ahead) +
  branch CRUD (`New branch`, `Rename`, `Delete`).
- **Conflict policy** — **Argo ships no merge-conflict editor.** A **diverged** branch (ahead *and*
  behind) does not auto-merge; it surfaces an **escape hatch**: *Open a scratch terminal* or
  *Resolve with an agent ↗*. Conflict resolution is delegated, not a UI Argo maintains.

## Shell chrome refinements — SPUN OUT → app-shell spec amendment (#172)

- **Merged single top bar**, floating on the scene: **no fill, no divider line**, no reserved band
  pushing content down.
- **No wordmark, no project label** (the project strip + window identity are enough). The
  **project strip is borderless / surface-less** — tabs float on the background.
- **macOS traffic-light clearance** reserved top-left (hiddenInset window).
- **`⌘K` has no button** — the palette is a shortcut only.

## Degraded / empty states (DIRECT is the floor — files read from disk)

- **Empty folder** — honest empty state (`This folder is empty`) with `New file` / `Open terminal`;
  the main pane shows `No file open`.
- **Unsupported / binary / too-large file** — `This file can't be shown here` with size/type and
  `Open in VS Code ↗`.
- **No folder connected** — the Code room defers to the shell's empty-shell seam → onboarding (#165).

## Spun out of #183 (not decided here)

- **Global git/branch chrome** (chip, select/manage, sync, conflict hatch) → amendment to the
  **app-shell spec #172**.
- **Project-level "enable worktrees" setting** + how the file view relates to **live** worktrees
  when agents work in parallel → its **own decision ticket**.
