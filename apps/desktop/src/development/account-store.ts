// Development apps share Account records and grants across worktrees (#2304).
import path from 'node:path'
import { absolute, type DevelopmentInstance } from './instance'

export const DEVELOPMENT_ACCOUNT_STORE = 'Argo Development'

// Per-process write queues can race between development apps.
export function accountStoreDirectory(placement: {
  userData: string
  appData: string
  instance: DevelopmentInstance | null
}): string {
  const { userData, appData, instance } = placement
  return instance ? path.join(absolute(appData, 'appData'), DEVELOPMENT_ACCOUNT_STORE) : userData
}
