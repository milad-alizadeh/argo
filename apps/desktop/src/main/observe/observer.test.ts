import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ProjectionDelta } from '../../shared'
import { createHub, type Hub } from '../hub'
import { provisionalSession } from '../terminals/provisionalSession'
import { type ClaimId, createManagedSessions, type ManagedSessions } from './managed'
import { createObserver, type ObserverOptions } from './observer'

// A real transcript root on disk, because the incremental path IS the file reading: the sweep
// fills the cache, then one changed file is re-read on its own and nothing else is touched. The
// process probe is the only collaborator stubbed, through the seam the options already offer.
const NOW = Date.parse('2026-07-20T14:10:00.000Z')
const FIXTURE_CWD = '/Users/x/tree'

// One `end_turn` assistant record: enough to close treeFull's open turn, which is the smallest
// change that must reach the renderer as an update.
const CLOSING_RECORD = JSON.stringify({
  type: 'assistant',
  cwd: FIXTURE_CWD,
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

function observer(over: Partial<ObserverOptions> = {}) {
  return createObserver(hub, {
    root,
    now: () => NOW,
    watch: false,
    probeProcesses: async () => [{ cwd: FIXTURE_CWD }],
    ...over,
  })
}

/**
 * A registry that claimed the fixture's folder BEFORE the fixture's session began, on a clock
 * that then moves past it — so a later `release` closes the window AROUND the session rather
 * than in front of it.
 */
function claimedManaged(): { managed: ManagedSessions; claim: ClaimId } {
  let clock = Date.parse('2026-07-20T13:00:00.000Z')
  const managed = createManagedSessions(() => clock)
  const claim = managed.claim(FIXTURE_CWD)
  clock = Date.parse('2026-07-20T15:00:00.000Z')
  return { managed, claim }
}

/** The roster row ⌘N publishes for an agent it has just started, before any transcript exists. */
const spawnedRow = (claim: ClaimId) =>
  provisionalSession({ claim, cwd: FIXTURE_CWD, cli: 'claude', spawnedAtMs: NOW })

const grown = () => `${fixture('treeFull').trimEnd()}\n${CLOSING_RECORD}\n`

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

describe('the launch sweep', () => {
  it('adds every Session it discovers, once', async () => {
    plant('treeFull', fixture('treeFull'))
    await observer().start()

    expect(deltas.map((delta) => delta.type)).toEqual(['session-added'])
    expect(hub.getState().sessions[0]?.facts.status).toBe('asking')
  })

  it('is a clean no-op on a machine with no transcript root at all', async () => {
    const observed = observer({ root: join(root, 'nope') })

    await expect(observed.start()).resolves.toBeUndefined()
    expect(deltas).toEqual([])
  })
})

describe('the incremental re-read', () => {
  it('changes an already-observed Session rather than adding it twice', async () => {
    plant('treeFull', fixture('treeFull'))
    const observed = observer()
    await observed.start()

    await observed.refresh(plant('treeFull', grown()))

    expect(deltas.map((delta) => delta.type)).toEqual(['session-added', 'session-changed'])
    expect(hub.getState().sessions).toHaveLength(1)
  })

  it('carries the newer reading of the Session onto projected state', async () => {
    plant('treeFull', fixture('treeFull'))
    const observed = observer()
    await observed.start()

    await observed.refresh(plant('treeFull', grown()))

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

    await observed.refresh(plant('askAnswered', fixture('askAnswered')))

    expect(deltas.map((delta) => delta.type)).toEqual(['session-added'])
    expect(hub.getState().sessions.map((session) => session.id)).toEqual([
      'treeFull',
      'askAnswered',
    ])
  })
})

describe('what the observer projects', () => {
  it('projects the whole tree, root plus Subagents, across the seam', async () => {
    plant('treeFull', fixture('treeFull'))
    await observer().start()

    const [session] = hub.getState().sessions
    expect(session.agents.filter((agent) => agent.parentId === null)).toHaveLength(1)
    expect(session.agents.filter((agent) => agent.parentId !== null)).toHaveLength(2)
  })

  it('reads a Session that began inside Argo’s own claim as managed', async () => {
    plant('treeFull', fixture('treeFull'))
    await observer({ managed: claimedManaged().managed }).start()

    expect(hub.getState().sessions[0]?.posture).toBe('managed')
  })

  it('leaves a Session that predates the claim external, folder match or not', async () => {
    // The claim opens AFTER this transcript started, so it cannot be the session Argo spawned.
    const managed = createManagedSessions(() => Date.parse('2026-07-20T20:00:00.000Z'))
    managed.claim(FIXTURE_CWD)
    plant('treeFull', fixture('treeFull'))
    await observer({ managed }).start()

    expect(hub.getState().sessions[0]?.posture).toBe('external')
  })

  it('replaces the row ⌘N published with the Session the CLI named, not a second row', async () => {
    const { managed, claim } = claimedManaged()
    hub.apply({ type: 'session-created', session: spawnedRow(claim) })
    plant('treeFull', fixture('treeFull'))

    await observer({ managed }).start()

    expect(hub.getState().sessions.map((session) => session.id)).toEqual(['treeFull'])
    expect(deltas.map((delta) => delta.type)).toEqual(['session-added', 'session-replaced'])
  })

  it('demotes a managed Session to orphaned once its PTY has exited', async () => {
    const { managed, claim } = claimedManaged()
    const path = plant('treeFull', fixture('treeFull'))
    const observed = observer({ managed })
    await observed.start()

    // Ownership dies with the PTY and cannot be re-adopted: the row survives, observation-only.
    managed.release(claim)
    await observed.refresh(path)

    expect(hub.getState().sessions[0]?.posture).toBe('orphaned')
  })
})
