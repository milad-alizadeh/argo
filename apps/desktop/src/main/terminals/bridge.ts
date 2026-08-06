import { ipcMain } from 'electron'
import {
  TERMINAL_ATTACH_CHANNEL,
  TERMINAL_DATA_CHANNEL,
  TERMINAL_INPUT_CHANNEL,
  TERMINAL_RESIZE_CHANNEL,
  type TerminalAttachRequest,
  type TerminalSize,
} from '../../shared'
import type { Hub } from '../hub'
import type { ClaimId, ManagedSessions } from '../observe'
import type { AgentLauncher } from './agentLauncher'
import type { AgentTerminals, AttachedTerminal } from './agentTerminals'

/** The slice of a renderer's `WebContents` the bridge uses. Narrow so a test drives the routing
 * without an Electron window; `WebContents` satisfies it structurally. */
export interface DockWindow {
  id: number
  isDestroyed(): boolean
  send(channel: string, chunk: string, sessionId: string): void
  once(event: 'destroyed', listener: () => void): void
}

// One attachment PER SESSION per window: a window holds several Docks, each watching its own agent.
const viewKey = (target: DockWindow, sessionId: string): string => `${target.id}:${sessionId}`

// A viewport that has not laid out yet reports 0 cells, which is not a size a pty may be told.
const cols = (size: TerminalSize): number => size.cols || 80
const rows = (size: TerminalSize): number => size.rows || 24

interface Docks {
  hub: Hub
  managed: ManagedSessions
  terminals: AgentTerminals
  launcher: AgentLauncher
  views: Map<string, { view: AttachedTerminal; target: DockWindow }>
  watched: Set<DockWindow>
}

/**
 * The claim whose agent this Dock steers. Normally the one the Session was bound to; when Argo
 * holds no PTY for it, the agent CLI is STARTED in the Session's own working directory rather than
 * leaving the pane inert — a Dock is a terminal you type at, so it runs an agent by default.
 * `null` only when there is no cwd to run in, or the CLI would not start.
 */
function claimFor(docks: Docks, sessionId: string): ClaimId | null {
  const bound = docks.managed.ownerOf(sessionId)
  if (bound !== null) return bound

  const cwd = docks.hub.getState().sessions.find((session) => session.id === sessionId)?.cwd
  if (cwd === undefined || cwd === null) return null
  const launched = docks.launcher.start(cwd)
  if (!launched.ok) return null
  docks.managed.adopt(sessionId, launched.claim)
  return launched.claim
}

function detach(docks: Docks, key: string): void {
  docks.views.get(key)?.view.detach()
  docks.views.delete(key)
}

/** Join one Dock to its session's agent PTY. */
function attachDock(docks: Docks, target: DockWindow, { sessionId, size }: TerminalAttachRequest) {
  const key = viewKey(target, sessionId)
  // A reload re-attaches the same session; drop the stale viewer so its output is not delivered
  // twice and nothing is sent to a WebContents on its way out.
  detach(docks, key)

  const claim = claimFor(docks, sessionId)
  if (claim === null) return
  const view = docks.terminals.attach(claim, (chunk) => {
    if (!target.isDestroyed()) target.send(TERMINAL_DATA_CHANNEL, chunk, sessionId)
  })
  if (view === null) return

  docks.views.set(key, { view, target })
  view.resize(cols(size), rows(size))
  watchWindow(docks, target)
}

// Once per window, not once per attach: a Dock re-attaches on every reload, and a listener per
// attach would pile up on the same WebContents.
function watchWindow(docks: Docks, target: DockWindow): void {
  if (docks.watched.has(target)) return
  docks.watched.add(target)
  target.once('destroyed', () => {
    for (const [key, entry] of [...docks.views]) if (entry.target === target) detach(docks, key)
    docks.watched.delete(target)
  })
}

/**
 * The steering PTY transport — ADR-0005's companion to the projection bridge.
 *
 * The Dock steers the agent's OWN terminal (#323), never a sibling shell in the same folder, and
 * detaching never kills it: the agent outlives the pane, still drained by the registry. A Dock
 * with no agent to attach to starts one rather than resting inert.
 */
export function wireTerminal(seams: Omit<Docks, 'views' | 'watched'>): void {
  const docks: Docks = { ...seams, views: new Map(), watched: new Set() }

  ipcMain.on(TERMINAL_ATTACH_CHANNEL, (event, request: TerminalAttachRequest) =>
    attachDock(docks, event.sender, request),
  )

  ipcMain.on(TERMINAL_INPUT_CHANNEL, (event, message: { sessionId: string; data: string }) => {
    docks.views.get(viewKey(event.sender, message.sessionId))?.view.write(message.data)
  })

  ipcMain.on(
    TERMINAL_RESIZE_CHANNEL,
    (event, { sessionId, size }: { sessionId: string; size: TerminalSize }) => {
      docks.views.get(viewKey(event.sender, sessionId))?.view.resize(cols(size), rows(size))
    },
  )
}
