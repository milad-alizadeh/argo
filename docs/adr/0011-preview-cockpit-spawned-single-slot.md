# 0011 · Preview: the cockpit spawns and embeds one dev server at a time

Status: accepted · 2026-07-20

## Context

Watching an agent build UI currently means leaving the cockpit: find its
worktree, start a dev server by hand, remember which port belongs to which
branch. The obvious in-app answer collides with two standing rules — the charter
("render-only … it never orchestrates agents itself") and the main window's
`setWindowOpenHandler`, which denies every window open and pushes external URLs
to the system browser.

Neither rule actually forbids this. A Vite process is not an Agent, the charter
permits acting *on explicit user gesture*, and the cockpit already spawns and
PTY-wraps managed Sessions (`node-pty` is a dependency today). But a preview is
the first long-lived child process that is not a Session, and the first external
content rendered inside the window, so the boundaries are worth writing down.

## Decision

**Preview is a pane showing a dev server the cockpit starts, on gesture, inside
the selected Actor's own Workspace.**

- **Spawned, not discovered.** The command comes from a list declared in the
  observed repo (never Argo's global settings, never a guess), and the cockpit
  injects the port. Because it assigns the port it *knows* the URL — DIRECT. The
  alternative, scraping a user-started server's stdout, is inference, and the
  honesty model exists to stop rendering guesses as facts.
- **Never auto-started.** The Gate's delegable `⚙ auto` remains the only
  sanctioned gesture-free action; a preview must not become a second one.
- **In the Actor's own worktree — not a shared tree that switches branches.** An
  agent's in-flight work is *uncommitted* and exists only in its own worktree. A
  shared preview tree on the same branch would show a stale committed snapshot of
  precisely the work being watched.
- **One at a time.** Starting a preview elsewhere stops the running one. Measured
  on this repo: ~287 MB resident per Storybook dev server, and 1.6s warm / 3.2s
  cold to a complete story index. Restart is cheap because Vite's pre-bundle
  survives on disk, so there is no grace period, no LRU and no idle reaper.
- **Embedded as an `<iframe>`, detachable to a real `BrowserWindow`.** An iframe
  flows in the DOM — it clips to the panel's radius and lets menus render above
  it. `WebContentsView` was rejected: as a native overlay it cannot be inset into
  a frosted surface and always paints on top, breaking the one-frosted-surface
  rule.
- **v1 is URL-embeddable surfaces only** — Storybook, web, and the Electron
  renderer via `electron-vite dev --rendererOnly` (which serves the renderer with
  no Electron window, avoiding multi-instance `userData` contention). A React
  Native simulator needs a frame-streaming engine and arrives later as another
  **Preview source** behind the same chrome.
- **Controls split by meaning.** The pane toggle only shows and hides; the
  chrome owns start/stop and carries all status. The canvas carries no honesty
  tier — it is not a claim but the running thing itself.

## Consequences

- First deliberate exception to `setWindowOpenHandler`'s deny-everything rule,
  for the detached window only.
- The cockpit becomes responsible for a process it does not observe: crash
  detection, port conflicts, and killing orphans on quit or when a Workspace is
  reclaimed. Orphaned dev servers are the known failure mode of this feature.
- Projects without a declared preview list show the chip disabled with a set-up
  affordance rather than hiding it, so the header stays stable across projects.
- Switching Actor or source costs a restart, not a reload.
