import type { BrowserWindow } from 'electron'
import { createProjectPort } from '@/domains/projects/main'
import { workspaceSelectionForSessionCwd } from '@/domains/projects/main/resolve-session-workspace'
import type { ProjectStore } from '@/domains/projects/main/sqlite-store'
import { attachManagedSessions } from '@/domains/sessions/next/main/managed-session-composition'
import type { SessionTicketLinkStore } from '@/domains/tickets/main/session-links'
import { createClaudeSdkDriveAdapter } from '@/harnesses/claude/agent-sdk/claude-sdk-drive-adapter'
import type { ClaudeSessionAdapter } from '@/harnesses/claude/agent-sdk/claude-session-adapter'
import { claudeTranscriptsRoot } from '@/harnesses/claude/sessions/discovery/roots'
import { createCodexAppServerDriveAdapter } from '@/harnesses/codex/drive/codex-app-server-drive-adapter'
import type { CodexSessionAdapter } from '@/harnesses/codex/drive/session/codex-session-adapter-contract'
import { sessionHarnesses } from '@/harnesses/composition/registered-harnesses'
import { attachSessions } from '@/harnesses/composition/session-bridges'
import type { DurableDatabase } from '@/platform/main/storage/durable-database'

export function attachManagedSessionHarnesses(
  window: BrowserWindow,
  options: {
    acceptance: boolean
    database: DurableDatabase
    home: string
    projects: ProjectStore
    proofEnabled: boolean
    rendererURL: string
    ticketLinks: SessionTicketLinkStore
    userData: string
  },
) {
  const managedSessions = attachManagedSessions(window, {
    ...options,
    projects: createProjectPort(options.projects),
  })
  const claude = managedSessions.adapterFor('claude')
  if (claude === undefined) throw new Error('Claude Session adapter is unavailable')
  const codex = managedSessions.adapterFor('codex')
  if (codex === undefined) throw new Error('Codex Session adapter is unavailable')
  const codexSource = managedSessions.sourceFor('codex')
  if (codexSource === undefined) throw new Error('Codex Session source is unavailable')
  const claudeSource = managedSessions.sourceFor('claude')
  if (claudeSource === undefined) throw new Error('Claude Session source is unavailable')
  const harnesses = attachSessions(window, {
    ...options,
    driveAdapters: {
      claude: createClaudeSdkDriveAdapter({
        adapter: claude as ClaudeSessionAdapter,
        workspaceForCwd: (cwd) => workspaceSelectionForSessionCwd(cwd, options.projects),
      }),
      codex: createCodexAppServerDriveAdapter({
        adapter: codex as CodexSessionAdapter,
        workspaceForCwd: (cwd) => workspaceSelectionForSessionCwd(cwd, options.projects),
      }),
    },
    managedSessions: { claude: (claude as ClaudeSessionAdapter).roster },
    managedLiveMessages: { claude: (claude as ClaudeSessionAdapter).liveMessages },
    managedRosterChanges: {
      claude: (claude as ClaudeSessionAdapter).onRosterChanged,
      codex: (codex as CodexSessionAdapter).onRosterChanged,
    },
    managedRename: { claude: (claude as ClaudeSessionAdapter).rename },
    watchedRoots: [claudeTranscriptsRoot(options.home)],
    harnesses: sessionHarnesses.filter((harness) => harness.harness !== 'codex'),
    excludedSourceHarnesses: ['claude'],
    polledSources: [codexSource],
    sources: [claudeSource, codexSource],
  })
  return { harnesses, managedSessions }
}
