import type { AccountClient } from '@/domains/accounts/preload/client'
import type { HarnessSignInClient } from '@/domains/harness-signin/preload/client'
import type { ProjectClient } from '@/domains/projects/preload/client'
import type { CodexCompactionClient } from '@/domains/sessions/contract/codex-compaction'
import type { ManagedSessionClient } from '@/domains/sessions/next/preload/managed-session-client'
import type { SessionHarnessent } from '@/domains/sessions/preload/client'
import type { TicketClient } from '@/domains/tickets/preload/client'
import type { PlatformClient } from '@/platform/preload/client'
import type { DevelopmentIdentity } from '@/platform/shared/development-identity'

declare global {
  interface Window {
    argo: ProjectClient &
      SessionHarnessent &
      AccountClient &
      HarnessSignInClient &
      TicketClient &
      PlatformClient &
      ManagedSessionClient &
      CodexCompactionClient & {
        development: DevelopmentIdentity | null
      }
  }
}
