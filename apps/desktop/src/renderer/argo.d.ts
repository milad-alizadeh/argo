import type { CodexCompactionClient } from '@/agents/codex/compaction/compaction'
import type { AccountClient } from '@/domains/accounts/preload/client'
import type { ProjectClient } from '@/domains/projects/preload/client'
import type { SessionClient } from '@/domains/sessions/preload/client'
import type { TicketClient } from '@/domains/tickets/preload/client'
import type { PlatformClient } from '@/platform/preload/client'
import type { DevelopmentIdentity } from '@/platform/shared/development-identity'

declare global {
  interface Window {
    argo: ProjectClient &
      SessionClient &
      AccountClient &
      TicketClient &
      PlatformClient &
      CodexCompactionClient & {
        development: DevelopmentIdentity | null
      }
  }
}
