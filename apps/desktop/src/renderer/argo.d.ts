import type { AppearanceClient } from '../core/appearance/appearance'
import type { ProjectClient } from '../core/projects/client'
import type { SessionClient } from '../core/sessions/client'

declare global {
  interface Window {
    argo: ProjectClient &
      SessionClient &
      AppearanceClient & {
        onCommand(listener: (command: string) => void): () => void
        zoomFactor(): number
        versions: { electron: string; chrome: string }
      }
  }
}
