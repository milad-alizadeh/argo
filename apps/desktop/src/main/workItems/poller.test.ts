import { describe, expect, it } from 'vitest'
import { type HubEvent, workItemView } from '../../shared'
import { createWorkItemPoller } from './poller'
import type { WorkItemProvider, WorkItemRead } from './port'

// Polling is how a desktop app learns anything (ADR-0018). Two behaviours earn a test: the
// read reaches the projection as an event, and a FAILED read reaches it as nothing at all.

const item = workItemView({ id: 'github:1', projectId: 'p-argo' })

function provider(reads: WorkItemRead[]): WorkItemProvider {
  let next = 0
  return {
    id: 'fake',
    capabilities: () => ({
      canAssign: false,
      canComment: false,
      closureKind: 'none',
      tier: 'bare',
    }),
    read: () => {
      const read = reads[next] ?? reads[reads.length - 1]
      next += 1
      return Promise.resolve(read ?? { ok: true, items: [] })
    },
  }
}

/** Runs the loop until `polls` reads have happened, then stops it — the wait is where the test
 * gets to count, so it is also where it gets to end. */
async function pump(reads: WorkItemRead[], polls: number): Promise<HubEvent[]> {
  const events: HubEvent[] = []
  const delays: number[] = []
  const poller = createWorkItemPoller({
    provider: provider(reads),
    projectId: 'p-argo',
    emit: (event) => events.push(event),
    wait: (ms) => {
      delays.push(ms)
      if (delays.length >= polls) poller.stop()
      return Promise.resolve()
    },
    intervalMs: 1000,
  })
  poller.start()
  // Every step of the loop is a resolved promise, so draining the microtask queue runs it.
  await new Promise((resolve) => setTimeout(resolve, 0))
  return events
}

describe('emitting into the projection', () => {
  it('emits the backlog a poll read', async () => {
    const events = await pump([{ ok: true, items: [item] }], 1)
    expect(events).toEqual([{ type: 'work-items-synced', projectId: 'p-argo', items: [item] }])
  })

  it('emits once per poll, so a live backlog keeps arriving', async () => {
    const events = await pump([{ ok: true, items: [item] }], 3)
    expect(events).toHaveLength(3)
  })
})

describe('a poll that failed', () => {
  it('emits nothing, so previously-fetched data stays rendered', async () => {
    // A dropped packet must not erase a backlog: the reducer only ever hears about reads that
    // actually happened, and staleness is the connection's to report.
    const events = await pump([{ ok: false, detail: 'rate limited' }], 3)
    expect(events).toEqual([])
  })

  it('keeps trying rather than giving up on the connection', async () => {
    const events = await pump(
      [
        { ok: false, detail: 'unreachable' },
        { ok: true, items: [item] },
      ],
      2,
    )
    expect(events).toHaveLength(1)
  })
})

describe('the loop itself', () => {
  it('stops asking once stopped', async () => {
    const events: HubEvent[] = []
    const poller = createWorkItemPoller({
      provider: provider([{ ok: true, items: [item] }]),
      projectId: 'p-argo',
      emit: (event) => events.push(event),
      wait: () => Promise.resolve(),
      intervalMs: 1000,
    })
    poller.start()
    poller.stop()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(events).toHaveLength(1)
  })
})
