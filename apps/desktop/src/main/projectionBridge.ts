import { ipcMain, type WebContents } from 'electron'
import { PROJECTION_CHANNEL, PROJECTION_READY_CHANNEL } from '../shared'
import type { Hub } from './hub'

// The Electron-coupled transport: forwards hub deltas to a window's renderer over
// IPC (ADR-0005). A renderer announces itself on PROJECTION_READY; we then subscribe
// it to the hub — the subscribe call hydrates it with a snapshot, and every later
// delta streams through. Exercised end-to-end by the Playwright launch smoke.
export function wireProjection(hub: Hub): void {
  const subscriptions = new WeakMap<WebContents, () => void>()

  ipcMain.on(PROJECTION_READY_CHANNEL, (event) => {
    const target = event.sender

    // A reload (dev HMR) re-announces on the same WebContents; drop the stale
    // subscription before opening a new one so deltas aren't double-sent.
    subscriptions.get(target)?.()

    const unsubscribe = hub.subscribe((delta) => {
      if (!target.isDestroyed()) target.send(PROJECTION_CHANNEL, delta)
    })
    const dispose = (): void => {
      unsubscribe()
      subscriptions.delete(target)
    }
    subscriptions.set(target, dispose)
    target.once('destroyed', dispose)
  })
}
