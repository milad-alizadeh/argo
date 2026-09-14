// Wiring every renderer bridge to a fresh window, split out of `main.ts` to stay under the
// per-function line cap: one driver setup, then one `attach*` call per domain.
import path from 'node:path'
import { app, type BrowserWindow, shell } from 'electron'
import { renameClaudeSession } from './agents/claude/drive/rename-session'
import { createClaudeDriveAdapter } from './agents/claude/drive/session-drive-adapter'
import { createSystemClaudeSessionDriver } from './agents/claude/drive/system-claude-session-driver'
import { claudeSessionSource } from './agents/claude/sessions/read-sessions'
import { claudeArchiveRoot, claudeTranscriptsRoot } from './agents/claude/sessions/roots'
import { attachCodexCompactionBridge } from './agents/codex/compaction/bridge'
import { renameCodexSession } from './agents/codex/drive/rename-session'
import { createCodexDriveAdapter } from './agents/codex/drive/session-drive-adapter'
import { createSystemCodexSessionDriver } from './agents/codex/drive/system-codex-session-driver'
import { codexSessionSource } from './agents/codex/sessions/read-sessions'
import { codexTranscriptsRoot } from './agents/codex/sessions/roots'
import { createAccountAccess } from './core/accounts/access'
import { attachAccountBridge } from './core/accounts/bridge'
import { safeStorageCipher } from './core/accounts/safe-storage'
import { attachAppearanceBridge } from './core/appearance/bridge'
import { attachProjectBridge } from './core/projects/bridge'
import { attachWindowNavigation } from './core/security/window-navigation'
import { attachSessionBridge } from './core/sessions/bridge'
import {
  SESSION_CLAUDE_EXECUTABLE_ENV,
  SESSION_CODEX_EXECUTABLE_ENV,
} from './core/sessions/proof-protocol'
import { createSessionReader } from './core/sessions/reader'
import { attachTicketBridge } from './core/tickets/bridge'
import { createSessionTicketLinkStore } from './core/tickets/session-links'
import { providerEndpoints } from './providers/endpoints'

function createSessionDrivers(userData: string, home: string, proofEnabled: boolean) {
  const claude = createSystemClaudeSessionDriver({
    permissions: path.join(userData, 'claude-permission-plugins'),
    ledger: path.join(userData, 'claude-session-ownership.json'),
    transcripts: claudeTranscriptsRoot(home),
    handoffBriefs: path.join(userData, 'claude-session-handoffs'),
    handoffLedger: path.join(userData, 'claude-session-handoffs.json'),
    executable: proofEnabled ? process.env[SESSION_CLAUDE_EXECUTABLE_ENV] : undefined,
  })
  const codex = createSystemCodexSessionDriver({
    executable: proofEnabled ? process.env[SESSION_CODEX_EXECUTABLE_ENV] : undefined,
    ownership: path.join(userData, 'codex-session-ownership.json'),
    transcripts: codexTranscriptsRoot(home),
  })
  return { claude, codex }
}

function attachSessions(
  window: BrowserWindow,
  request: {
    rendererURL: string
    home: string
    userData: string
    drivers: ReturnType<typeof createSessionDrivers>
  },
) {
  const { rendererURL, home, userData, drivers } = request
  const { claude, codex } = drivers
  const ticketLinks = createSessionTicketLinkStore(
    path.join(userData, 'portable-v1', 'session-tickets.json'),
  )
  attachSessionBridge(window, {
    reader: createSessionReader(
      [
        claudeSessionSource({
          transcripts: claudeTranscriptsRoot(home),
          archive: claudeArchiveRoot(home),
          managedSessions: claude.roster,
          completeCompaction: claude.completeCompaction,
          completeHandoffs: claude.completeHandoffs,
          handoffEdges: claude.handoffEdges,
          liveMessages: claude.liveMessages,
          rename: (request) => renameClaudeSession(request, claude),
          isLockedElsewhere: claude.isLockedElsewhere,
        }),
        codexSessionSource(codexTranscriptsRoot(home), {
          roster: codex.roster,
          liveMessages: codex.liveMessages,
          pendingQuestion: codex.pendingQuestion,
          rename: (request) => renameCodexSession(request, codex),
          isLockedElsewhere: codex.isLockedElsewhere,
        }),
      ],
      ticketLinks,
    ),
    adapters: {
      claude: createClaudeDriveAdapter(claude),
      codex: createCodexDriveAdapter(codex),
    },
    rendererURL,
  })
}

export function attachBridges(
  window: BrowserWindow,
  request: { userData: string; rendererURL: string; proofEnabled: boolean },
) {
  const { userData, rendererURL, proofEnabled } = request
  const home = app.getPath('home')
  const drivers = createSessionDrivers(userData, home, proofEnabled)
  attachWindowNavigation(window)
  attachProjectBridge(window, { userData, rendererURL })
  attachSessions(window, { rendererURL, home, userData, drivers })
  attachAppearanceBridge(window, { userData, rendererURL })
  attachCodexCompactionBridge(window, { home, rendererURL })
  const access = createAccountAccess({
    userData,
    endpoints: providerEndpoints(proofEnabled),
    cipher: safeStorageCipher,
    openExternal: (url) => shell.openExternal(url),
  })
  attachAccountBridge(window, { access, rendererURL })
  attachTicketBridge(window, { access, rendererURL })
  app.once('before-quit', () => {
    drivers.claude.close()
    drivers.codex.close()
  })
}
