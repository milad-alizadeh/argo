import type { ProjectClient } from '../projects/client'

declare global {
  interface Window {
    argo: ProjectClient & { versions: { electron: string; chrome: string } }
  }
}
