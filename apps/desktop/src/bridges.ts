// Wiring every renderer bridge to a fresh window, split out of `main.ts` to stay under the
// per-function line cap: one driver setup, then one `attach*` call per domain.
import path from 'node:path'
import { app, type BrowserWindow, powerMonitor, shell } from 'electron'
import { installCompactionHook } from './agents/claude/compaction/compaction-hook'
import { renameClaudeSession } from './agents/claude/drive/rename-session'
import { claudeSessionSource } from './agents/claude/sessions/read-sessions'
import {
  claudeArchiveRoot,
  claudeCompactionStartsRoot,
  claudeProcessesRoot,
  claudeSettingsPath,
  claudeTranscriptsRoot,
} from './agents/claude/sessions/roots'
import { attachCodexCompactionBridge } from './agents/codex/compaction/bridge'
import { renameCodexSession } from './agents/codex/drive/rename-session'
import { codexSessionSource } from './agents/codex/sessions/read-sessions'
import { codexStatePath, codexTranscriptsRoot } from './agents/codex/sessions/roots'
import { codexThreadNames } from './agents/codex/sessions/state-store'
import { createAccountAccess } from './core/accounts/access'
import { attachAccountBridge } from './core/accounts/bridge'
import { safeStorageCipher } from './core/accounts/safe-storage'
import { attachAppearanceBridge } from './core/appearance/bridge'
import { attachProjectBridge } from './core/projects/bridge'
import { attachWindowNavigation } from './core/security/window-navigation'
import { attachSessionBridge } from './core/sessions/bridge'
import { createSessionReader } from './core/sessions/reader'
import type { SessionDriveAdapters } from './core/sessions/session-drive-adapter'
import { attachTicketBridge } from './core/tickets/bridge'
import { createSessionTicketLinkStore } from './core/tickets/session-links'
import { registerWatching } from './core/watch/bridge'
import { watchTrees } from './core/watch/watch-paths'
import { watchSystemResume, watchWindowFocus } from './core/watch/watch-signals'
import { providerEndpoints } from './providers/endpoints'
import { createSessionAdapters, createSessionDrivers, type SessionDrivers } from './session-drivers'

// ADR-0041: adds the `PreCompact` hook to the user's Claude settings, and names where it writes.
function watchClaudeCompactions(home: string) {
  const starts = claudeCompactionStartsRoot(home)
  installCompactionHook(claudeSettingsPath(home), starts)
    .then((install) => {
      if (install === 'refused')
        console.warn('Claude settings could not be read, so compactions stay hidden until they end')
    })
    .catch((error) => console.error('Claude compaction hook failed to install', error))
  return starts
}

function attachSessions(
  window: BrowserWindow,
  request: {
    rendererURL: string
    home: string
    userData: string
    drivers: SessionDrivers
    adapters: SessionDriveAdapters
    compactionStarts?: string
  },
) {
  const { rendererURL, home, userData, drivers, adapters, compactionStarts } = request
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
          processes: claudeProcessesRoot(home),
          managedSessions: claude.roster,
          compactionStarts,
          beginCompaction: claude.beginCompaction,
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
          threadNames: codexThreadNames(codexStatePath(codexTranscriptsRoot(home))),
        }),
      ],
      ticketLinks,
    ),
    adapters,
    rendererURL,
  })
}

export function attachBridges(
  window: BrowserWindow,
  request: { userData: string; rendererURL: string; proofEnabled: boolean; acceptance: boolean },
) {
  const { userData, rendererURL, proofEnabled } = request
  const home = app.getPath('home')
  const drivers = createSessionDrivers(userData, home, proofEnabled)
  const adapters = createSessionAdapters(drivers)
  // A proof or acceptance run leaves the person's hooks and compaction starts alone.
  const compactionStarts =
    proofEnabled || request.acceptance ? undefined : watchClaudeCompactions(home)
  attachWindowNavigation(window)
  attachProjectBridge(window, { userData, rendererURL })
  attachSessions(window, { rendererURL, home, userData, drivers, adapters, compactionStarts })
  attachAppearanceBridge(window, { userData, rendererURL })
  // A Session written by a CLI outside Argo reaches the roster because the trees the CLIs write to
  // are watched, not because the roster re-reads them on a timer. The archive store stands beside
  // them: the roster and the Archived list are both read out of it, and a write to it does not
  // always come from this window. Focus and resume stand beside the trees because FSEvents can lose
  // events with no error and no closed handle (#2303).
  registerWatching(window, {
    sessions: [
      watchTrees([
        claudeTranscriptsRoot(home),
        codexTranscriptsRoot(home),
        claudeArchiveRoot(home),
      ]),
      watchWindowFocus(window),
      watchSystemResume(powerMonitor),
    ],
    permissions: Object.values(adapters).map((adapter) => adapter.watchPermissions),
  })
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
