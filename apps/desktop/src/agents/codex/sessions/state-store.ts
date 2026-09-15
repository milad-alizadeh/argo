import { DatabaseSync } from 'node:sqlite'
import { type OpenStateStore, readThreadNames, type ThreadNames } from './thread-names'

// How long a read waits on Codex's own write lock before it names nothing for this sweep.
const LOCK_WAIT_MS = 100

// Electron's Node ships `node:sqlite`; Bun, which runs the tests, does not, so only main imports this.
const openReadOnly: OpenStateStore = (file) =>
  new DatabaseSync(file, { readOnly: true, timeout: LOCK_WAIT_MS })

export function codexThreadNames(file: string): ThreadNames {
  return readThreadNames(file, openReadOnly)
}
