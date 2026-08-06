import { describe, expect, it } from 'vitest'
import { type HubEvent, workItemView } from '../../shared'
import { createWorkItemPoller } from './poller'
import type { WorkItemProvider, WorkItemRead } from './port'

// Polling is how a desktop app learns anything (ADR-0018). Two behaviours earn a test: the
// read reaches the projection as an event, and a FAILED read reaches it as nothing at all.

const item = workItemView({ id: 'github:1', projectId: 'p-argo' })

/** The provider would not answer right now — offline, rate limited, a repository that moved. */
const unavailable = (detail: string): WorkItemRead =>
  ({ ok: false, detail, reason: 'unavailable' }) as const

/** The provider refused the grant itself: expired, revoked, or scope-stripped. */
const rejected = (): WorkItemRead =>
  ({ ok: false, detail: 'Bad credentials', reason: 'rejected' }) as const

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

describe('a poll the provider could not answer', () => {
  it('emits nothing, so previously-fetched data stays rendered', async () => {
    // A dropped packet must not erase a backlog: the reducer only ever hears about reads that
    // actually happened, and staleness is the connection's to report.
    const events = await pump([unavailable('rate limited')], 3)
    expect(events).toEqual([])
  })

  it('leaves the grant alone, so a rate limit never asks the user to sign in again', async () => {
    const events = await pump([unavailable('offline')], 3)
    expect(events.some((event) => event.type === 'grant-changed')).toBe(false)
  })

  it('keeps trying rather than giving up on the connection', async () => {
    const events = await pump([unavailable('unreachable'), { ok: true, items: [item] }], 2)
    expect(events).toHaveLength(1)
  })
})

describe('a poll the provider refused the grant for', () => {
  it('reports the grant as needing a reconnect', async () => {
    const events = await pump([rejected()], 1)
    expect(events).toEqual([{ type: 'grant-changed', grant: 'needs-reconnect' }])
  })

  it('still emits no backlog, so a revoked token never empties the one on screen', async () => {
    const events = await pump([rejected()], 2)
    expect(events.some((event) => event.type === 'work-items-synced')).toBe(false)
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
