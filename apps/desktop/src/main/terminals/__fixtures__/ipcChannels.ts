import type { CommandResult } from '../../../shared'
import type { DockWindow } from '../bridge'

/** The channel registry a test's `vi.mock('electron', …)` writes into, standing in for `ipcMain`.
 *
 * A module of its own, with only a TYPE import (erased at runtime): the mock factory reaches it by
 * dynamic import — the factory is hoisted above the file's own imports — and a fixture that pulled
 * in the code under test would deadlock, because that code imports the very `electron` mock being
 * defined. */
export type IpcListener = (event: { sender: DockWindow }, message: unknown) => void

export const channels = new Map<string, IpcListener>()

/** The same registry for the invoke channels (`ipcMain.handle`), where an act reports back whether
 * it happened. Kept apart from `channels` because the two halves are different shapes, not because
 * a name collides. */
export const handlers = new Map<string, () => CommandResult>()
