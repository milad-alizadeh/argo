import { DatabaseSync } from 'node:sqlite'
import {
  type OpenStateStore,
  readThreadNames,
  type ThreadNames,
} from '@/agents/codex/sessions/thread-names'

// Electron's Node ships `node:sqlite`; Bun, which runs the tests, does not, so only main imports this.
// No busy wait (`timeout` 0): 23,811 reads of the live store while Codex committed 67 times never
// met a lock, since a WAL reader does not wait on the writer, and a refused read is asked again.
const openReadOnly: OpenStateStore = (file) =>
  new DatabaseSync(file, { readOnly: true, timeout: 0 })

export function codexThreadNames(file: string): ThreadNames {
  return readThreadNames(file, openReadOnly)
}
