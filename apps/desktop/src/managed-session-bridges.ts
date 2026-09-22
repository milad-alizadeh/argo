import type { BrowserWindow } from 'electron'
import { createProjectPort } from '@/domains/projects/main'
import { workspaceSelectionForSessionCwd } from '@/domains/projects/main/resolve-session-workspace'
import type { ProjectStore } from '@/domains/projects/main/sqlite-store'
import { attachManagedSessions } from '@/domains/sessions/next/main/managed-session-composition'
import type { SessionTicketLinkStore } from '@/domains/tickets/main/session-links'
import { createClaudeSdkDriveAdapter, type ClaudeSessionAdapter } from '@/harnesses/claude/agent-sdk'
import { createCodexAppServerDriveAdapter, type CodexSessionAdapter } from '@/harnesses/codex/drive'
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
    harnesses: sessionHarnesses.filter((harness) => harness.harness !== 'codex'),
    sources: [codexSource],
  })
  return { harnesses, managedSessions }
}
