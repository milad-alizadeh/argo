import type { DockWindow } from '../terminalBridge'

/** The channel registry a test's `vi.mock('electron', …)` writes into, standing in for `ipcMain`.
 *
 * A module of its own, with only a TYPE import (erased at runtime): the mock factory reaches it by
 * dynamic import — the factory is hoisted above the file's own imports — and a fixture that pulled
 * in the code under test would deadlock, because that code imports the very `electron` mock being
 * defined. */
export type IpcListener = (event: { sender: DockWindow }, message: unknown) => void

export const channels = new Map<string, IpcListener>()
