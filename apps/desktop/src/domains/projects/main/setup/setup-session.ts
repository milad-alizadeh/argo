import type { SetupDocument } from '../../contract/setup-document'
import type { SetupCheckpoint } from '../sqlite-store'
import { startSetupSession } from './setup-adapter'
import type { SetupStore } from './setup-context'

export function setupSession({
  store,
  checkpoint,
  worktreePath,
  document,
}: {
  store: SetupStore
  checkpoint: SetupCheckpoint | null
  worktreePath: string
  document: SetupDocument
}) {
  if (checkpoint?.sessionId) return Promise.resolve({ sessionId: checkpoint.sessionId })
  return startSetupSession({
    adapters: store.setupAdapters ?? [],
    adapterId: 'claude',
    worktreePath,
    document,
  })
}
