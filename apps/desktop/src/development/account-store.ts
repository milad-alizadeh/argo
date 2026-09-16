// Where an app keeps its Account records and their grants. Every development app reads and writes
// one store, so an Account signed in from one worktree serves them all (#2304).
import path from 'node:path'
import { absolute, type DevelopmentInstance } from './instance'

// A sibling of the packaged app's own folder under the per-user application data directory, rather
// than a folder in the instance directory: the instance directory is per worktree and sits under
// `/tmp`, which macOS empties at reboot.
export const DEVELOPMENT_ACCOUNT_STORE = 'Argo Development'

// Two development apps writing at the same moment can still lose one change, because the write
// queue is per process. That is the cost of one store, and no development sign-in is worth a lock.
export function accountStoreDirectory(placement: {
  userData: string
  appData: string
  instance: DevelopmentInstance | null
}): string {
  const { userData, appData, instance } = placement
  return instance ? path.join(absolute(appData, 'appData'), DEVELOPMENT_ACCOUNT_STORE) : userData
}
