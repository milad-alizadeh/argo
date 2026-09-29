// In-process probes for one measured step, each drained between steps so a row reports only its own
// long tasks, main-thread stalls, Feed IPC and Feed row DOM changes.
import type { ElectronApplication, Page } from 'playwright-core'

const TRPC_CHANNEL = 'argo:trpc'
// The Feed routes before and after the move to main: a history query and a live event stream, or
// one reading subscription.
const FEED_PATHS = ['sessionFeedRead', 'sessionLiveEvents', 'sessionFeed']

type ProbeWindow = { __longTasks: PerformanceEntry[]; __rowUpdates: number }

export async function instrumentPage(page: Page) {
  await page.evaluate(() => {
    const state = window as unknown as ProbeWindow
    state.__longTasks = []
    state.__rowUpdates = 0
    new PerformanceObserver((list) => state.__longTasks.push(...list.getEntries())).observe({
      type: 'longtask',
      buffered: true,
    })
    // A row counts once per mutation batch however many of its nodes changed.
    const rowsOf = (record: MutationRecord): Element[] => {
      const node = record.target instanceof Element ? record.target : record.target.parentElement
      const changed = node?.closest('[data-feed-row]')
      const added = [...record.addedNodes].filter((one) => one instanceof Element)
      return [
        ...(changed ? [changed] : []),
        ...added.filter((one) => one.matches('[data-feed-row]')),
        ...added.flatMap((one) => [...one.querySelectorAll('[data-feed-row]')]),
      ]
    }
    new MutationObserver((records) => {
      state.__rowUpdates += new Set(records.flatMap(rowsOf)).size
    }).observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    })
  })
}

export async function drainRendererProbes(page: Page) {
  const { durations, rowUpdates } = await page.evaluate(() => {
    const state = window as unknown as ProbeWindow
    const held = state.__longTasks
    const updates = state.__rowUpdates
    state.__longTasks = []
    state.__rowUpdates = 0
    return { durations: held.map((entry) => entry.duration), rowUpdates: updates }
  })
  return {
    longTasks: {
      count: durations.length,
      totalMs: Number(durations.reduce((total, one) => total + one, 0).toFixed(1)),
      maxMs: Number((durations.length ? Math.max(...durations) : 0).toFixed(1)),
    },
    rowUpdates,
  }
}

export async function rendererHeapMb(page: Page) {
  return page.evaluate(() => {
    const memory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
    return memory ? Math.round(memory.usedJSHeapSize / (1024 * 1024)) : null
  })
}

// How late a 20 ms main-process timer fires is the main thread's stall.
export async function armDriftProbe(application: ElectronApplication) {
  await application.evaluate(() => {
    const state = globalThis as unknown as { __argoDrift: number[] }
    state.__argoDrift = []
    let last = Date.now()
    setInterval(() => {
      const now = Date.now()
      state.__argoDrift.push(now - last - 20)
      last = now
    }, 20)
  })
}

export async function drainDrift(application: ElectronApplication) {
  const samples = await application.evaluate(() => {
    const state = globalThis as unknown as { __argoDrift: number[] }
    const held = state.__argoDrift
    state.__argoDrift = []
    return held
  })
  return {
    maxMs: samples.length ? Math.max(...samples) : 0,
    overMs: samples.filter((sample) => sample > 16).length,
  }
}

type FeedIpc = { bytes: number; messages: number; subscriptions: Set<number> }
type InvokeHandler = (event: unknown, ...args: unknown[]) => unknown

// Counts the serialized bytes of every Feed query reply and Feed subscription message main sends.
// Electron keeps `ipcMain.handle` handlers in `_invokeHandlers` and replies with what one returns;
// the probe throws when that map is missing, rather than reporting zero bytes.
export async function armFeedIpcProbe(application: ElectronApplication) {
  const armed = await application.evaluate(
    ({ ipcMain, BrowserWindow }, { channel, paths }) => {
      const probe: FeedIpc = { bytes: 0, messages: 0, subscriptions: new Set() }
      ;(globalThis as unknown as { __argoFeedIpc: FeedIpc }).__argoFeedIpc = probe
      const count = (value: unknown) => {
        probe.bytes += Buffer.byteLength(JSON.stringify(value) ?? '', 'utf8')
        probe.messages += 1
      }
      const handlers = (ipcMain as unknown as { _invokeHandlers?: Map<string, InvokeHandler> })
        ._invokeHandlers
      const original = handlers?.get(channel)
      const window = BrowserWindow.getAllWindows()[0]
      if (handlers === undefined || original === undefined || window === undefined) return false
      const webContents = window.webContents
      const send = webContents.send.bind(webContents)
      webContents.send = (sent: string, ...args: unknown[]) => {
        const message = args[0] as { id?: number } | undefined
        if (sent === channel && probe.subscriptions.has(message?.id ?? -1)) count(message)
        send(sent, ...args)
      }
      handlers.set(channel, (event, ...args) => {
        const input = args[0] as { id?: number; path?: string; type?: string } | undefined
        const feed = input?.path !== undefined && paths.includes(input.path)
        if (feed && input?.type === 'subscription') probe.subscriptions.add(input.id ?? -1)
        const reply = original(event, ...args)
        if (feed) void Promise.resolve(reply).then(count)
        return reply
      })
      return true
    },
    { channel: TRPC_CHANNEL, paths: FEED_PATHS },
  )
  if (!armed) throw new Error('Electron no longer exposes the ipcMain handler the probe wraps.')
}

export async function drainFeedIpc(application: ElectronApplication) {
  return application.evaluate(() => {
    const probe = (globalThis as unknown as { __argoFeedIpc: FeedIpc }).__argoFeedIpc
    const drained = { bytes: probe.bytes, messages: probe.messages }
    probe.bytes = 0
    probe.messages = 0
    return drained
  })
}
