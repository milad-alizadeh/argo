import type { ProjectPort } from '@/domains/projects/main'
import { SESSION_CODEX_EXECUTABLE_ENV } from '@/domains/sessions/contract/proof-protocol'
import { claudeSessionAdapterRegistration } from '@/harnesses/claude/agent-sdk/claude-session-adapter-registration'
import { createCodexSessionAdapterRegistration } from '@/harnesses/codex/drive/session/codex-session-adapter-registration'
import { codexTranscriptsRoot } from '@/harnesses/codex/history/roots'
import { findExecutableOnLoginShellPath } from '@/harnesses/host/executable-path'
import { createSessionAdapterRegistry } from './session-adapter-registry'

export function attachManagedSessions(options: {
  home: string
  projects: ProjectPort
  proofEnabled: boolean
}) {
  const adapters = createSessionAdapterRegistry(
    {
      // Workspace resolution returns only a reconciled, materialised checkout. This boundary
      // remains explicit so adapter startup cannot race future asynchronous preparation.
      waitForWorkspaceReady: async () => {},
      resolveWorkspace: (selection) => options.projects.resolveWorkspace(selection),
      knownWorkspaces: () => options.projects.knownWorkspaces(),
      now: () => new Date(),
    },
    [
      claudeSessionAdapterRegistration,
      createCodexSessionAdapterRegistration({
        transcriptsRoot: codexTranscriptsRoot(options.home),
        knownWorkspaces: () => options.projects.knownWorkspaces(),
        findExecutable: () =>
          options.proofEnabled
            ? (process.env[SESSION_CODEX_EXECUTABLE_ENV] ?? null)
            : findExecutableOnLoginShellPath('codex'),
      }),
    ],
  )
  void adapters.readModelCatalog('codex')
  return adapters
}
