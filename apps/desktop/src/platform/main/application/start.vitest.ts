import { afterEach, expect, test, vi } from 'vitest'
import { SessionSyncStatusStore } from '@/domains/sessions/main/sync/session-sync-status'

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

test('does not start a second Argo application instance', async () => {
  electron.app.requestSingleInstanceLock.mockReturnValue(false)
  const ready = vi.fn()

  startDesktopApplication({
    prepare: vi.fn(async () => ({
      database: {} as never,
      databasePath: '',
      sessionSyncStatus: new SessionSyncStatusStore(),
    })),
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
    prepare: vi.fn(async () => ({
      database: {} as never,
      databasePath: '',
      sessionSyncStatus: new SessionSyncStatusStore(),
    })),
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
