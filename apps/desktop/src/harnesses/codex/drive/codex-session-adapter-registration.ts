import type { SessionAdapterRegistration } from '@/domains/sessions/next/main/session-adapter-registry'
import { createCodexSessionAdapter } from '@/harnesses/codex/drive/codex-session-adapter'
import { createCodexAppServerSessionSource } from '@/harnesses/codex/observation/app-server-session-source'
import { codexSessionSource } from '@/harnesses/codex/sessions/read-sessions'

export function createCodexSessionAdapterRegistration(options: {
  findExecutable: () => string | null
  transcriptsRoot: string
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
      })
      return {
        adapter,
        close: adapter.close,
        source: createCodexAppServerSessionSource({
          adapter,
          fallback: codexSessionSource(options.transcriptsRoot),
          projections: adapter.projections,
        }),
      }
    },
  }
}
