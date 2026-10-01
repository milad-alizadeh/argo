import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { APPEARANCE_READY_CHANNEL, type AppearanceState } from '@/platform/contract/appearance'
import nativeThemeBackgrounds from '@/platform/contract/native-theme-backgrounds.json'

const harness = vi.hoisted(() => {
  const handlers = new Map<string, (event: unknown, value?: unknown) => unknown>()
  const listeners = new Set<(state: AppearanceState) => void>()
  return {
    handlers,
    listeners,
    state: { theme: 'neutral', appearance: 'system', dark: false, revision: 0 } as AppearanceState,
    coordinator: {
      read: () => harness.state,
      subscribe: (listener: (state: AppearanceState) => void) => {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      },
    },
  }
})
vi.mock('electron', () => ({
  nativeTheme: {},
  BrowserWindow: { fromWebContents: () => undefined },
  ipcMain: {
    handle: (channel: string, handler: (event: unknown, value?: unknown) => unknown) => {
      harness.handlers.set(channel, handler)
    },
  },
}))
vi.mock('./theme-coordinator', () => ({ createThemeCoordinator: async () => harness.coordinator }))
vi.mock('./security/is-trusted-renderer-frame', () => ({
  isTrustedRendererFrame: (event: { sender: unknown }, window: { webContents: unknown }) =>
    event.sender === window.webContents,
}))

const { initializeAppearance, attachAppearanceWatch, focusAppearanceWindow } = await import(
  './appearance'
)
const closers: Array<() => void> = []
beforeEach(async () => {
  harness.state = { theme: 'neutral', appearance: 'system', dark: false, revision: 0 }
  await initializeAppearance('/unused-fixture')
})
afterEach(() => {
  for (const close of closers.splice(0)) close()
})

function fixture(show = true, minimized = false) {
  let appliedRevision = -1
  let background = ''
  const window = {
    webContents: { send: vi.fn() },
    setBackgroundColor: (color: string) => {
      background = color
    },
    show: vi.fn(() => {
      expect(appliedRevision).toBe(harness.state.revision)
      expect(background).toBe(
        nativeThemeBackgrounds[harness.state.theme][harness.state.dark ? 'dark' : 'light'],
      )
    }),
    focus: vi.fn(),
    restore: vi.fn(() => {
      minimized = false
    }),
    isMinimized: () => minimized,
    isDestroyed: () => false,
    once: (_event: string, close: () => void) => {
      closers.push(close)
    },
  }
  attachAppearanceWatch(window as never, 'file:///fixture/index.html', show)
  return {
    window,
    apply: (revision: number) => {
      appliedRevision = revision
    },
    acknowledge: (revision: unknown) => {
      const handle = harness.handlers.get(APPEARANCE_READY_CHANNEL)
      if (!handle) throw new Error('Missing ready handler')
      return handle({ sender: window.webContents }, revision)
    },
  }
}

function update(revision = 1, dark = true) {
  harness.state = { theme: 'graphite', appearance: 'system', dark, revision }
  for (const listener of harness.listeners) listener(harness.state)
}

test('a stale ready acknowledgement returns current state without exposing the window', () => {
  const { window, apply, acknowledge } = fixture()
  apply(0)
  update()
  expect(acknowledge(0)).toEqual({ ready: false, state: harness.state })
  expect(window.show).not.toHaveBeenCalled()
  apply(1)
  expect(acknowledge(1)).toEqual({ ready: true, state: harness.state })
  expect(window.show).toHaveBeenCalledOnce()
})

test('focus waits for an acknowledgement of current DOM and native state', () => {
  const { window, apply, acknowledge } = fixture(false)
  focusAppearanceWindow(window as never)
  expect(window.show).not.toHaveBeenCalled()
  expect(window.focus).not.toHaveBeenCalled()
  update()
  apply(0)
  acknowledge(0)
  expect(window.show).not.toHaveBeenCalled()
  apply(1)
  acknowledge(1)
  expect(window.show).toHaveBeenCalledOnce()
  expect(window.focus).toHaveBeenCalledOnce()
})

test.each([false, true])(
  'reactivation waits for current acknowledgement when minimized=%s',
  (minimized) => {
    const { window, apply, acknowledge } = fixture(false, minimized)
    apply(0)
    acknowledge(0)
    update()
    focusAppearanceWindow(window as never)
    expect(window.restore).not.toHaveBeenCalled()
    expect(window.show).not.toHaveBeenCalled()
    expect(window.focus).not.toHaveBeenCalled()
    expect(acknowledge(0)).toEqual({ ready: false, state: harness.state })
    expect(window.show).not.toHaveBeenCalled()
    apply(1)
    acknowledge(1)
    expect(window.restore).toHaveBeenCalledTimes(minimized ? 1 : 0)
    expect(window.show).toHaveBeenCalledOnce()
    expect(window.focus).toHaveBeenCalledOnce()
    acknowledge(1)
    expect(window.show).toHaveBeenCalledOnce()
    expect(window.focus).toHaveBeenCalledOnce()
    update(2, false)
    apply(2)
    acknowledge(2)
    expect(window.show).toHaveBeenCalledOnce()
    expect(window.focus).toHaveBeenCalledOnce()
  },
)

test('initial visibility is consumed and later acknowledged updates do not reveal or focus', () => {
  const { window, apply, acknowledge } = fixture()
  apply(0)
  acknowledge(0)
  expect(window.show).toHaveBeenCalledOnce()
  update()
  apply(1)
  acknowledge(1)
  expect(window.show).toHaveBeenCalledOnce()
  expect(window.focus).not.toHaveBeenCalled()
})

test('invalid ready revisions are rejected and counted without showing a window', () => {
  const { window, acknowledge } = fixture()
  const report = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    expect(() => acknowledge({ revision: 0 })).toThrow('Appearance ready revision is invalid.')
    expect(() => acknowledge(-1)).toThrow('Appearance ready revision is invalid.')
    expect(report.mock.calls[0]?.[0]).toContain('#1')
    expect(report.mock.calls[1]?.[0]).toContain('#2')
    expect(window.show).not.toHaveBeenCalled()
  } finally {
    report.mockRestore()
  }
})
