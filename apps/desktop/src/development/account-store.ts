// Development apps share Account records and grants across worktrees (#2304).
import path from 'node:path'
import { absolute, type DevelopmentInstance } from './instance'

export const DEVELOPMENT_APPLICATION_NAME = 'Argo Development'
export const DEVELOPMENT_SHARED_STORE = DEVELOPMENT_APPLICATION_NAME

export type DevelopmentStorePlacement = {
  userData: string
  appData: string
  instance: DevelopmentInstance | null
}

function sharedStoreDirectory(placement: DevelopmentStorePlacement): string {
  const { userData, appData, instance } = placement
  return instance ? path.join(absolute(appData, 'appData'), DEVELOPMENT_SHARED_STORE) : userData
}

export function developmentStoreDirectories(placement: DevelopmentStorePlacement) {
  const sharedData = sharedStoreDirectory(placement)
  return {
    accountData: sharedData,
    projectData: sharedData,
  }
}
