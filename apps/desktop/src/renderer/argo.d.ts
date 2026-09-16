import type { CodexCompactionClient } from '../agents/codex/compaction/compaction'
import type { AccountClient } from '../core/accounts/client'
import type { AppearanceClient } from '../core/appearance/appearance'
import type { ProjectClient } from '../core/projects/client'
import type { SessionClient } from '../core/sessions/client'
import type { TicketClient } from '../core/tickets/client'
import type { WatchTopic } from '../core/watch/watch-contract'
import type { DevelopmentIdentity } from '../development/instance'

declare global {
  interface Window {
    argo: ProjectClient &
      SessionClient &
      AccountClient &
      TicketClient &
      AppearanceClient &
      CodexCompactionClient & {
        onCommand(listener: (command: string) => void): () => void
        onWatchedChanged(listener: (topic: WatchTopic) => void): () => void
        zoomFactor(): number
        pathForFile(file: File): string
        versions: { electron: string; chrome: string }
        development: DevelopmentIdentity | null
      }
  }
}
