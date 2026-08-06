import { beforeEach, describe, expect, it, vi } from 'vitest'
import { attach, fakeDock, observed, twoAgents, type } from './__fixtures__/dockHarness'
import { channels } from './__fixtures__/ipcChannels'

// A Dock is a terminal you type at, so a session Argo holds no PTY for gets an agent STARTED in
// its own working directory rather than a pane that rests forever.
vi.mock('electron', async () => {
  const { channels } = await import('./__fixtures__/ipcChannels')
  type Listener = Parameters<typeof channels.set>[1]
  return {
    ipcMain: { on: (channel: string, listener: Listener) => channels.set(channel, listener) },
  }
})

beforeEach(() => channels.clear())

describe('a Dock with no agent to attach to', () => {
  it('starts one in the session’s own cwd, and steers it', () => {
    const { agents, hub, onDemand } = twoAgents()
    const dock = fakeDock(1)
    observed(hub, 'session-c', '/Users/x/c')

    attach(dock, 'session-c')
    type(dock, 'session-c', 'hello?\r')
    onDemand.emit('claude here\n')

    expect(agents.started).toEqual(['/Users/x/c'])
    expect(onDemand.written).toEqual(['hello?\r'])
    expect(dock.sent).toEqual([{ chunk: 'claude here\n', sessionId: 'session-c' }])
    // The two agents Argo already owned are untouched by the one it had to start.
    expect(agents.a.written).toEqual([])
    expect(agents.b.written).toEqual([])
  })

  it('starts it ONCE, however often the Dock re-attaches', () => {
    const { agents, hub } = twoAgents()
    const dock = fakeDock(1)
    observed(hub, 'session-c', '/Users/x/c')

    attach(dock, 'session-c')
    attach(dock, 'session-c')

    expect(agents.started).toEqual(['/Users/x/c'])
  })

  it('starts nothing for a session with no cwd to run in', () => {
    const { agents } = twoAgents()
    const dock = fakeDock(1)

    // A session the roster never observed: there is no folder to run an agent in, and an attach
    // must never fall through to somebody else's agent.
    attach(dock, 'unknown-session')
    type(dock, 'unknown-session', 'hello?\r')

    expect(agents.started).toEqual([])
    expect(dock.sent).toEqual([])
    expect(agents.a.written).toEqual([])
    expect(agents.b.written).toEqual([])
  })
})
