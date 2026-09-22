import type { BrowserWindow } from 'electron'
import { resolveSessionWorkspace } from '@/domains/projects/main/resolve-session-workspace'
import type { ProjectStore } from '@/domains/projects/main/sqlite-store'
import { claudeSessionAdapterRegistration } from '@/harnesses/claude/agent-sdk/claude-session-adapter-registration'
import { createCodexSessionAdapterRegistration } from '@/harnesses/codex/drive/codex-session-adapter-registration'
import { findExecutableOnLoginShellPath } from '@/harnesses/executable-path'
import type { DurableDatabase } from '@/platform/main/storage/durable-database'
import { attachManagedSessionBridge } from './managed-session-bridge'
import { createSessionAdapterRegistry } from './session-adapter-registry'
import { createSessionService } from './session-service'

export function attachManagedSessions(
  window: BrowserWindow,
  options: { database: DurableDatabase; projects: ProjectStore; rendererURL: string },
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
      resolveWorkspace: (selection) => resolveSessionWorkspace(selection, options.projects),
      now: () => new Date(),
    },
    [
      claudeSessionAdapterRegistration,
      createCodexSessionAdapterRegistration({
        findExecutable: () => findExecutableOnLoginShellPath('codex'),
      }),
    ],
  )
  attachManagedSessionBridge(window, { adapters, rendererURL: options.rendererURL })
  return adapters
}
