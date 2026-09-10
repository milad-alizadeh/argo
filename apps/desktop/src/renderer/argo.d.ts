import type { SessionClient } from '../core/sessions/client'
import type { ProjectClient } from '../projects/client'

declare global {
  interface Window {
    argo: ProjectClient &
      SessionClient & {
        // ADR-0033 rule 6: zoom is one of the three things that invalidate a cached height, and
        // only the preload can read it.
        zoomFactor(): number
        versions: { electron: string; chrome: string }
      }
  }
}
