import type { BrowserWindow } from 'electron'
import type { ProjectPort } from '@/domains/projects/main/port'
import { SESSION_CODEX_EXECUTABLE_ENV } from '@/domains/sessions/contract/proof-protocol'
import { claudeSessionAdapterRegistration } from '@/harnesses/claude/agent-sdk/claude-session-adapter-registration'
import { createCodexSessionAdapterRegistration } from '@/harnesses/codex/drive/codex-session-adapter-registration'
import { findExecutableOnLoginShellPath } from '@/harnesses/executable-path'
import type { DurableDatabase } from '@/platform/main/storage/durable-database'
import { attachManagedSessionBridge } from './managed-session-bridge'
import { createSessionAdapterRegistry } from './session-adapter-registry'
import { createSessionService } from './session-service'

export function attachManagedSessions(
  window: BrowserWindow,
  options: {
    database: DurableDatabase
    projects: ProjectPort
    proofEnabled: boolean
    rendererURL: string
  },
) {
  const adapters = createSessionAdapterRegistry(
    {
      sessionService: createSessionService({
        database: options.database,
        windowId: String(window.id),
        now: () => Date.now(),
        leaseDurationMs: 30_000,
      }),
      // Workspace resolution returns only a reconciled, materialised checkout. This boundary
      // remains explicit so adapter startup cannot race future asynchronous preparation.
      waitForWorkspaceReady: async () => {},
      resolveWorkspace: (selection) => options.projects.resolveWorkspace(selection),
      now: () => new Date(),
    },
    [
      claudeSessionAdapterRegistration,
      createCodexSessionAdapterRegistration({
        findExecutable: () =>
          options.proofEnabled
            ? (process.env[SESSION_CODEX_EXECUTABLE_ENV] ?? null)
            : findExecutableOnLoginShellPath('codex'),
      }),
    ],
  )
  attachManagedSessionBridge(window, { adapters, rendererURL: options.rendererURL })
  return adapters
}
