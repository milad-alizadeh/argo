// Development apps share one Account store; Projects and Connections stay per worktree (#3006).
import path from 'node:path'
import { absolute, type DevelopmentInstance } from './instance'

export const DEVELOPMENT_APPLICATION_NAME = 'Argo Development'
const DEVELOPMENT_SHARED_STORE = DEVELOPMENT_APPLICATION_NAME

export type DevelopmentStorePlacement = {
  userData: string
  appData: string
  instance: DevelopmentInstance | null
}

export function accountDataDirectory(placement: DevelopmentStorePlacement): string {
  const { userData, appData, instance } = placement
  return instance ? path.join(absolute(appData, 'appData'), DEVELOPMENT_SHARED_STORE) : userData
}
