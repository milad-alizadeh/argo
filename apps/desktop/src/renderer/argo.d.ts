import type { AccountClient } from '../core/accounts/client'
import type { AppearanceClient } from '../core/appearance/appearance'
import type { ProjectClient } from '../core/projects/client'
import type { SessionClient } from '../core/sessions/client'
import type { TicketClient } from '../core/tickets/client'

declare global {
  interface Window {
    argo: ProjectClient &
      SessionClient &
      AccountClient &
      TicketClient &
      AppearanceClient & {
        onCommand(listener: (command: string) => void): () => void
        zoomFactor(): number
        versions: { electron: string; chrome: string }
      }
  }
}
