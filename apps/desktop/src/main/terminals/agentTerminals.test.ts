import { describe, expect, it } from 'vitest'
import { fakePty } from './__fixtures__/fakePty'
import { createAgentTerminals, REPLAY_LIMIT } from './agentTerminals'

// The registry only ever uses three members of a pty handle, which is why the port is narrow
// enough for `fakePty` to drive it without a native module.

describe('agent terminals', () => {
  it('drains the agent while nobody is attached', () => {
    const terminals = createAgentTerminals()
    const pty = fakePty()
    terminals.adopt('claim-1', pty)

    // The drain is the whole point: an unread pty back-pressures until the child stalls.
    expect(() => pty.emit('working…')).not.toThrow()
  })

  it('replays what the agent already said to a Dock that attaches late', () => {
    const terminals = createAgentTerminals()
    const pty = fakePty()
    terminals.adopt('claim-1', pty)
    pty.emit('before the Dock opened\n')

    const seen: string[] = []
    terminals.attach('claim-1', (chunk) => seen.push(chunk))
    pty.emit('after\n')

    expect(seen.join('')).toBe('before the Dock opened\nafter\n')
  })

  it('keeps the replay bounded so a chatty agent cannot grow it without limit', () => {
    const terminals = createAgentTerminals()
    const pty = fakePty()
    terminals.adopt('claim-1', pty)
    pty.emit('x'.repeat(REPLAY_LIMIT + 500))

    const seen: string[] = []
    terminals.attach('claim-1', (chunk) => seen.push(chunk))

    expect(seen.join('')).toHaveLength(REPLAY_LIMIT)
  })

  it('routes keystrokes and resizes to the agent the attachment named', () => {
    const terminals = createAgentTerminals()
    const first = fakePty()
    const second = fakePty()
    terminals.adopt('claim-1', first)
    terminals.adopt('claim-2', second)

    terminals.attach('claim-2', () => {})?.write('hello\r')
    terminals.attach('claim-1', () => {})?.resize(100, 40)

    expect(second.written).toEqual(['hello\r'])
    expect(first.written).toEqual([])
    expect(first.sizes).toEqual(['100x40'])
  })

  it('leaves the agent running when its Dock detaches', () => {
    const terminals = createAgentTerminals()
    const pty = fakePty()
    terminals.adopt('claim-1', pty)

    const seen: string[] = []
    const view = terminals.attach('claim-1', (chunk) => seen.push(chunk))
    view?.detach()
    pty.emit('still going\n')

    // Nothing reaches the detached Dock, and the next attach still finds a live agent with the
    // output it produced meanwhile.
    expect(seen).toEqual([])
    expect(terminals.attach('claim-1', () => {})).not.toBeNull()
  })

  it('has nothing to attach to for a claim it never adopted, or one that exited', () => {
    const terminals = createAgentTerminals()
    terminals.adopt('claim-1', fakePty())
    terminals.drop('claim-1')

    expect(terminals.attach('claim-1', () => {})).toBeNull()
    expect(terminals.attach('never-spawned', () => {})).toBeNull()
  })
})
