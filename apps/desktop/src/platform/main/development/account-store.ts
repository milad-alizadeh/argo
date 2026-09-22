// Development apps share the Project, Account, and Ticket connection state across worktrees.
import path from 'node:path'
import { absolute, type DevelopmentInstance } from './instance'

export const DEVELOPMENT_APPLICATION_NAME = 'Argo Development'
const DEVELOPMENT_SHARED_STORE = DEVELOPMENT_APPLICATION_NAME

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
    connectionData: sharedData,
    projectData: sharedData,
  }
}
