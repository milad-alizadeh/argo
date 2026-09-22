// The fixture harness `harness-registration.vitest.ts` registers to prove #2488's generalisation
// without touching `registered-harnesses.ts`.
import type { SessionRosterRow } from '@/domains/sessions/contract/model/models'
import type { SessionIndex } from '@/domains/sessions/main/indexing/session-index/contract'
import { managedRow } from '@/domains/sessions/main/lifecycle/status/managed-row'
import type { HarnessRegistration } from '@/harnesses/composition/harness-registration'

const setup = { model: null, effort: null, mode: null } as const

// Never opened: the fixture's `createSource` ignores it, the way a harness with no index-backed
// backfill would (#2373's `backfillTick` stays undefined).
export const unusedIndex: SessionIndex = {
  filesAt: async () => [],
  filesOfChains: async () => [],
  rowsOfChains: async () => [],
  searchChains: async () => [],
  chainLinks: async () => [],
  strandedChains: async () => [],
  write: async () => {},
  backfillProgress: async () => ({ boundary: null, complete: true }),
  setBackfillProgress: async () => {},
  close: async () => {},
}

export type FixtureDriver = {
  sent: { sessionId: string; prompt: string }[]
  compacted: string[]
  closed: boolean
  rosterChangedListeners: Set<() => void>
  row: SessionRosterRow
}

function fixtureSource(fixtureDriver: FixtureDriver) {
  return {
    harness: 'fixture' as const,
    async discoverSessions() {
      return {
        rows: [fixtureDriver.row],
        filesFound: 0,
        filesRead: 0,
        filesUnreadable: 0,
        filesParsed: 0,
        nextCursor: null,
        historyComplete: true,
      }
    },
    managedSessions() {
      return [fixtureDriver.row]
    },
    async readSessionFiles() {
      return null
    },
    async readShellOutput() {
      throw new Error('the fixture harness records no Shell output')
    },
  }
}

function fixtureDriveAdapter(fixtureDriver: FixtureDriver) {
  return {
    harness: 'fixture' as const,
    failureMessage: () => 'Fixture Harness cannot drive this Session.',
    turnSetupSchema: { safeParse: () => ({ success: true as const, data: undefined }) },
    async start() {
      return { sessionId: 'fixture-1' }
    },
    async send({ sessionId, prompt }: { sessionId: string; prompt: string }) {
      fixtureDriver.sent.push({ sessionId, prompt })
      return { ok: true as const }
    },
    async interrupt() {
      return { ok: true as const }
    },
    async compact({ sessionId }: { sessionId: string }) {
      fixtureDriver.compacted.push(sessionId)
      return { ok: true as const }
    },
    async handoff() {
      return { ok: true as const }
    },
    async readPermission() {
      return { permission: null }
    },
    async decidePermission() {
      return { ok: true as const }
    },
    async decideQuestion() {
      return { ok: true as const }
    },
  }
}

export function fixtureHarness(): {
  harness: HarnessRegistration
  driver: FixtureDriver
} {
  const driver: FixtureDriver = {
    sent: [],
    compacted: [],
    closed: false,
    rosterChangedListeners: new Set(),
    row: managedRow('fixture-1', {
      harness: 'fixture',
      cwd: '/proj',
      status: 'running',
      setup,
      prompt: 'Fixture opener.',
      startedAt: '2026-09-14T09:00:00.000Z',
    }),
  }
  const harness: HarnessRegistration = {
    harness: 'fixture',
    start() {
      return {
        harness: 'fixture',
        source: fixtureSource(driver),
        driveAdapter: fixtureDriveAdapter(driver),
        watchedTranscriptRoots: [],
        async close() {
          driver.closed = true
        },
        onRosterChanged: (onChanged) => {
          driver.rosterChangedListeners.add(onChanged)
          return () => driver.rosterChangedListeners.delete(onChanged)
        },
      }
    },
  }
  return { harness, driver }
}
