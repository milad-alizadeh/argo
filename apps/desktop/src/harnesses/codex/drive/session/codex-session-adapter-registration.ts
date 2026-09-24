import type { SessionAdapterRegistration } from '@/domains/sessions/next/main/session-adapter-registry'
import { createCodexAppServerSessionSource } from '../../observation/app-server-session-source'
import { createCodexSessionAdapter } from './codex-session-adapter'

export function createCodexSessionAdapterRegistration(options: {
  findExecutable: () => string | null
  transcriptsRoot: string
  knownWorkspaces: () => Promise<readonly { id: string; path: string }[]>
}): SessionAdapterRegistration {
  return {
    harness: 'codex',
    create: (runtime) => {
      const adapter = createCodexSessionAdapter({
        findExecutable: options.findExecutable,
        sessionService: runtime.sessionService,
        waitForWorkspaceReady: runtime.waitForWorkspaceReady,
        now: runtime.now,
        resolveWorkspace: runtime.resolveWorkspace,
        knownWorkspaces: options.knownWorkspaces,
        transcriptsRoot: options.transcriptsRoot,
      })
      return {
        adapter,
        readModelCatalog: adapter.readModelCatalog,
        close: adapter.close,
        source: createCodexAppServerSessionSource({
          adapter,
          projections: adapter.projections,
          watchedProjections: adapter.watchedProjections,
          refreshHistory: adapter.refreshHistory,
          refreshSearchHistory: adapter.refreshSearchHistory,
          readHistoryProjection: adapter.readHistoryProjection,
          checkoutFor: adapter.checkoutFor,
        }),
      }
    },
  }
}
