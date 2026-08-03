import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProjectionDelta } from '../../shared'
import { createHub, type Hub } from '../hub'
import { createManagedSessions, type ManagedSessions } from './managed'
import { createObserver } from './observer'

// The process probe is the one piece of real I/O in the pipeline; stubbing it is what makes the
// rest deterministic. A live process on the fixtures' cwd is the interesting case.
vi.mock('./liveness', () => ({
  gatherClaudeProcesses: async () => [{ cwd: '/Users/x/tree' }],
}))

// A real transcript root on disk, because the incremental path IS the file reading: the sweep
// fills the cache, then one changed file is re-read on its own and nothing else is touched.
const NOW = Date.parse('2026-07-20T14:10:00.000Z')

// One `end_turn` assistant record: enough to close treeFull's open turn, which is the smallest
// change that must reach the renderer as an update.
const CLOSING_RECORD = JSON.stringify({
  type: 'assistant',
  cwd: '/Users/x/tree',
  timestamp: '2026-07-20T14:06:00.000Z',
  uuid: 't-a-4',
  parentUuid: 't-a-3',
  message: { role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text: 'ok' }] },
})

let root: string
let hub: Hub
let deltas: ProjectionDelta[]

const fixture = (name: string) =>
  readFileSync(join(__dirname, '__fixtures__', `${name}.jsonl`), 'utf8')

function plant(name: string, contents: string): string {
  const path = join(root, 'project-a', `${name}.jsonl`)
  writeFileSync(path, contents)
  return path
}

function observer(managed?: ManagedSessions) {
  return createObserver(hub, { root, now: () => NOW, watch: false, managed })
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'argo-observe-'))
  mkdirSync(join(root, 'project-a'))
  // A stray file where a project directory is expected must not break the sweep.
  writeFileSync(join(root, 'not-a-dir'), 'ignored')
  hub = createHub()
  deltas = []
  hub.subscribe((delta) => {
    if (delta.type !== 'snapshot') deltas.push(delta)
  })
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('the incremental observer', () => {
  it('sweeps once on start, then updates a changed file WITHOUT re-sweeping', async () => {
    plant('treeFull', fixture('treeFull'))
    const observed = observer()
    await observed.start()

    expect(deltas.map((delta) => delta.type)).toEqual(['session-added'])
    expect(hub.getState().sessions[0]?.facts.status).toBe('asking')

    // The same file grows a closing record: the Session must CHANGE, not be added twice.
    const path = plant('treeFull', `${fixture('treeFull').trimEnd()}\n${CLOSING_RECORD}\n`)
    await observed.refresh(path)

    expect(deltas.map((delta) => delta.type)).toEqual(['session-added', 'session-changed'])
    expect(hub.getState().sessions).toHaveLength(1)
    expect(hub.getState().sessions[0]?.facts.status).toBe('idle')
  })

  it('emits nothing when a re-read yields the same observation', async () => {
    const path = plant('treeFull', fixture('treeFull'))
    const observed = observer()
    await observed.start()
    deltas.length = 0

    await observed.refresh(path)
    await observed.refresh(path)

    expect(deltas).toEqual([])
  })

  it('picks up a transcript that did not exist at sweep time', async () => {
    plant('treeFull', fixture('treeFull'))
    const observed = observer()
    await observed.start()
    deltas.length = 0

    const path = plant('askAnswered', fixture('askAnswered'))
    await observed.refresh(path)

    expect(deltas.map((delta) => delta.type)).toEqual(['session-added'])
    expect(hub.getState().sessions.map((session) => session.id)).toEqual([
      'treeFull',
      'askAnswered',
    ])
  })
})

describe('what the incremental observer reports', () => {
  it('projects the whole tree, root plus Subagents, across the seam', async () => {
    plant('treeFull', fixture('treeFull'))
    await observer().start()

    const [session] = hub.getState().sessions
    expect(session.agents.filter((agent) => agent.parentId === null)).toHaveLength(1)
    expect(session.agents.filter((agent) => agent.parentId !== null)).toHaveLength(2)
  })

  it('reads a Session Argo spawned as managed, and demotes it to orphaned on PTY exit', async () => {
    const managed = createManagedSessions()
    managed.claim('/Users/x/tree')
    const path = plant('treeFull', fixture('treeFull'))
    const observed = observer(managed)
    await observed.start()

    expect(hub.getState().sessions[0]?.posture).toBe('managed')

    // Ownership dies with the PTY and cannot be re-adopted: the row survives, observation-only.
    managed.release('/Users/x/tree')
    await observed.refresh(path)

    expect(hub.getState().sessions[0]?.posture).toBe('orphaned')
    expect(deltas.at(-1)?.type).toBe('session-changed')
  })

  it('is a clean no-op on a machine with no transcript root at all', async () => {
    const observed = createObserver(hub, {
      root: join(root, 'nope'),
      now: () => NOW,
      watch: false,
    })

    await expect(observed.start()).resolves.toBeUndefined()
    expect(deltas).toEqual([])
  })
})
