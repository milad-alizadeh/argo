// Development apps share Account records and grants across worktrees (#2304).
import path from 'node:path'
import { absolute, type DevelopmentInstance } from './instance'

export const DEVELOPMENT_SHARED_STORE = 'Argo Development'

function sharedStoreDirectory(placement: {
  userData: string
  appData: string
  instance: DevelopmentInstance | null
}): string {
  const { userData, appData, instance } = placement
  return instance ? path.join(absolute(appData, 'appData'), DEVELOPMENT_SHARED_STORE) : userData
}

// Per-process write queues can race between development apps.
export function accountStoreDirectory(placement: {
  userData: string
  appData: string
  instance: DevelopmentInstance | null
}): string {
  return sharedStoreDirectory(placement)
}

export function projectStoreDirectory(placement: {
  userData: string
  appData: string
  instance: DevelopmentInstance | null
}): string {
  return sharedStoreDirectory(placement)
}

export function developmentStoreDirectories(placement: {
  userData: string
  appData: string
  instance: DevelopmentInstance | null
}) {
  return {
    accountData: accountStoreDirectory(placement),
    projectData: projectStoreDirectory(placement),
  }
}
