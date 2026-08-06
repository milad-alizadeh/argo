import { beforeEach, describe, expect, it, vi } from 'vitest'
import { attach, fakeDock, resize, twoAgents, type } from './__fixtures__/dockHarness'
import { channels } from './__fixtures__/ipcChannels'

// The factory is hoisted above the imports, so the registry is reached by dynamic import rather
// than through the binding above, which is not initialised yet when this runs.
vi.mock('electron', async () => {
  const { channels } = await import('./__fixtures__/ipcChannels')
  type Listener = Parameters<typeof channels.set>[1]
  return {
    ipcMain: { on: (channel: string, listener: Listener) => channels.set(channel, listener) },
  }
})

beforeEach(() => channels.clear())

describe('the Dock’s terminal bridge', () => {
  it('sends what you type to the session’s OWN agent, Ctrl-C included', () => {
    const { agents } = twoAgents()
    const dock = fakeDock(1)

    attach(dock, 'session-a')
    type(dock, 'session-a', 'run the tests\r')
    type(dock, 'session-a', '\x03')

    expect(agents.a.written).toEqual(['run the tests\r', '\x03'])
    expect(agents.b.written).toEqual([])
  })

  it('never crosses two sessions open in one window', () => {
    const { agents } = twoAgents()
    const dock = fakeDock(1)

    attach(dock, 'session-a')
    attach(dock, 'session-b')
    type(dock, 'session-b', 'only b\r')
    agents.a.emit('a speaks\n')
    agents.b.emit('b speaks\n')

    expect(agents.a.written).toEqual([])
    expect(agents.b.written).toEqual(['only b\r'])
    expect(dock.sent).toEqual([
      { chunk: 'a speaks\n', sessionId: 'session-a' },
      { chunk: 'b speaks\n', sessionId: 'session-b' },
    ])
  })

  it('streams the agent’s output to the pane drawn for it, and resizes that agent alone', () => {
    const { agents } = twoAgents()
    const dock = fakeDock(1)

    attach(dock, 'session-a')
    resize(dock, 'session-a', { cols: 120, rows: 40 })
    agents.a.emit('thinking…')

    expect(dock.sent).toEqual([{ chunk: 'thinking…', sessionId: 'session-a' }])
    expect(agents.a.sizes).toEqual(['80x24', '120x40'])
    expect(agents.b.sizes).toEqual([])
  })

  it('leaves the agent running, and replays it, when a Dock reattaches', () => {
    const { agents } = twoAgents()
    const dock = fakeDock(1)

    attach(dock, 'session-a')
    agents.a.emit('line one\n')
    // A reload: the same session attaches again, and the agent has kept working meanwhile.
    attach(dock, 'session-a')
    agents.a.emit('line two\n')

    expect(dock.sent).toEqual([
      { chunk: 'line one\n', sessionId: 'session-a' },
      { chunk: 'line one\n', sessionId: 'session-a' },
      { chunk: 'line two\n', sessionId: 'session-a' },
    ])
  })
})
