import { afterEach, expect, test, vi } from 'vitest'
import { SessionListChanges } from '@/domains/sessions/main/api/session-list-changes'
import { TICKET_SYNC_TIMING } from '@/domains/tickets/main/sync/ticket-sync-supervisor-machine'
import type { HarnessRegistry } from '@/harnesses/registry'
import { migratedDatabase } from '@/mocks/database/migrated-database'

const electron = vi.hoisted(() => ({
  app: {
    exit: vi.fn(),
    getLocale: vi.fn(() => 'en-GB'),
    getPath: vi.fn(() => '/tmp/argo-test-user-data'),
    on: vi.fn(),
    quit: vi.fn(),
    requestSingleInstanceLock: vi.fn(),
    whenReady: vi.fn(() => Promise.resolve()),
  },
}))

vi.mock('electron', () => electron)
vi.mock('../appearance', () => ({
  applyStoredAppearance: vi.fn(),
  readAppearance: vi.fn(async () => 'system'),
}))
vi.mock('../i18n', () => ({ setPlatformLanguage: vi.fn(), platformText: (key: string) => key }))

const { startDesktopApplication } = await import('./start')

afterEach(() => {
  vi.clearAllMocks()
})

const unreachable = async () => ({ ok: false as const, failure: 'github-unreachable' as const })

function prepared() {
  return {
    // The Session sync supervisor reads each Harness's saved scan status at start.
    database: migratedDatabase(),
    sessionListChanges: new SessionListChanges(),
    ticketSync: {
      database: {} as never,
      readPage: unreachable,
      readTicket: unreachable,
      changed: () => {},
      timing: TICKET_SYNC_TIMING,
    },
    ticketOperations: {
      database: {} as never,
      write: async () => ({ ok: false as const, failure: 'github-unreachable' as const }),
      changed: () => {},
    },
    registry: {} as HarnessRegistry,
  }
}

test('does not start a second Argo application instance', async () => {
  electron.app.requestSingleInstanceLock.mockReturnValue(false)
  const ready = vi.fn()

  startDesktopApplication({
    prepare: vi.fn(async () => prepared()),
    ready,
    focusExistingWindow: vi.fn(),
    willQuit: vi.fn(),
  })
  await new Promise<void>((resolve) => setImmediate(resolve))

  expect(electron.app.quit).toHaveBeenCalledOnce()
  expect(ready).not.toHaveBeenCalled()
  expect(electron.app.whenReady).not.toHaveBeenCalled()
})

test('focuses the existing window when a second instance is launched', async () => {
  electron.app.requestSingleInstanceLock.mockReturnValue(true)
  const focusExistingWindow = vi.fn()
  const ready = vi.fn()

  startDesktopApplication({
    prepare: vi.fn(async () => prepared()),
    ready,
    focusExistingWindow,
    willQuit: vi.fn(),
  })
  await new Promise<void>((resolve) => setImmediate(resolve))

  expect(ready).toHaveBeenCalledOnce()
  const secondInstance = electron.app.on.mock.calls.find(([event]) => event === 'second-instance')
  expect(secondInstance).toBeDefined()
  secondInstance?.[1]()
  expect(focusExistingWindow).toHaveBeenCalledOnce()
})
