import {
  sessionView,
  TERMINAL_ATTACH_CHANNEL,
  TERMINAL_INPUT_CHANNEL,
  TERMINAL_RESIZE_CHANNEL,
  type TerminalSize,
} from '../../shared'
import type { AgentLauncher } from '../agentLauncher'
import { createAgentTerminals } from '../agentTerminals'
import { createHub, type Hub } from '../hub'
import { createManagedSessions } from '../observe'
import { type DockWindow, wireTerminal } from '../terminalBridge'
import { fakePty } from './fakePty'
import { channels } from './ipcChannels'

// The world the Dock's bridge routes over. The bridge is pure routing, so the only things faked
// are its two ends: Electron's channel registry (`ipcChannels`, which each test file installs
// through its own `vi.mock('electron', …)`), and the agent ptys the terminal registry hands out.

export interface FakeDock {
  contents: DockWindow
  sent: { chunk: string; sessionId: string }[]
}

export function fakeDock(id: number): FakeDock {
  const sent: FakeDock['sent'] = []
  return {
    contents: {
      id,
      isDestroyed: () => false,
      send: (_channel, chunk, sessionId) => sent.push({ chunk, sessionId }),
      once: () => {},
    },
    sent,
  }
}

const SIZE = { cols: 80, rows: 24 }
export const CWD_A = '/Users/x/a'
export const CWD_B = '/Users/x/b'
const SPAWNED_AT = Date.parse('2026-07-20T13:00:00.000Z')
const STARTED_AT = Date.parse('2026-07-20T13:00:05.000Z')

/** One Session in the roster, which is where the bridge reads the cwd to run an agent in. */
export const observed = (hub: Hub, id: string, cwd: string): void =>
  hub.apply({ type: 'session-created', session: { ...sessionView({ id }), cwd } })

export const attach = (dock: FakeDock, sessionId: string): void =>
  channels.get(TERMINAL_ATTACH_CHANNEL)?.({ sender: dock.contents }, { sessionId, size: SIZE })
export const type = (dock: FakeDock, sessionId: string, data: string): void =>
  channels.get(TERMINAL_INPUT_CHANNEL)?.({ sender: dock.contents }, { sessionId, data })
export const resize = (dock: FakeDock, sessionId: string, size: TerminalSize): void =>
  channels.get(TERMINAL_RESIZE_CHANNEL)?.({ sender: dock.contents }, { sessionId, size })

/** Two agents Argo spawned, each observed as its own Session, plus the launcher that starts one
 * on demand for a Session Argo holds no PTY for. */
export function twoAgents() {
  const managed = createManagedSessions(() => SPAWNED_AT)
  const terminals = createAgentTerminals()
  const agents = { a: fakePty(), b: fakePty(), started: [] as string[] }
  terminals.adopt(managed.claim(CWD_A), agents.a)
  terminals.adopt(managed.claim(CWD_B), agents.b)
  managed.bind('session-a', CWD_A, STARTED_AT)
  managed.bind('session-b', CWD_B, STARTED_AT)

  const onDemand = fakePty()
  const launcher: AgentLauncher = {
    start(cwd) {
      agents.started.push(cwd)
      const claim = managed.claim(cwd)
      terminals.adopt(claim, onDemand)
      return { ok: true, claim }
    },
  }
  const hub = createHub()
  wireTerminal({ hub, managed, terminals, launcher })
  return { managed, terminals, agents, hub, onDemand }
}
