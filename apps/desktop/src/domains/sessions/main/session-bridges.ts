// Wiring the Sessions room to a window: the two CLI drivers, the roster reader over both, and the
// Claude compaction hook. Separate from `bridges.ts` so the composition root stays one `attach*`
// call per domain (ADR-0021).
import path from 'node:path'
import { type BrowserWindow, powerMonitor } from 'electron'
import { installCompactionHook } from '@/agents/claude/compaction/compaction-hook'
import { createClaudeDriveAdapter } from '@/agents/claude/drive/session-drive-adapter'
import { createSystemClaudeSessionDriver } from '@/agents/claude/drive/system-claude-session-driver'
import {
  claudeCompactionStartsRoot,
  claudeSettingsPath,
  claudeTranscriptsRoot,
} from '@/agents/claude/sessions/roots'
import { createCodexDriveAdapter } from '@/agents/codex/drive/session-drive-adapter'
import { createSystemCodexSessionDriver } from '@/agents/codex/drive/system-codex-session-driver'
import { codexTranscriptsRoot } from '@/agents/codex/sessions/roots'
import {
  createSessionArchiveStore,
  sessionArchivePath,
} from '@/domains/sessions/main/archive-store'
import { attachSessionBridge } from '@/domains/sessions/main/bridge'
import {
  SESSION_CLAUDE_EXECUTABLE_ENV,
  SESSION_CODEX_EXECUTABLE_ENV,
} from '@/domains/sessions/main/proof-protocol'
import { createSessionReader } from '@/domains/sessions/main/reader'
import { startBackfill, withReconcile } from '@/domains/sessions/main/session-background-indexing'
import { sessionIndexPath } from '@/domains/sessions/main/session-index/open-index'
import { createWorkerSessionIndex } from '@/domains/sessions/main/session-index/worker-index'
import { sessionSources } from '@/domains/sessions/main/session-sources'
import { createSessionTicketLinkStore } from '@/domains/tickets/main/session-links'
import { registerWatching } from '@/platform/main/watch/bridge'
import { watchTrees } from '@/platform/main/watch/watch-paths'
import {
  watchPeriodically,
  watchSystemResume,
  watchWindowFocus,
} from '@/platform/main/watch/watch-signals'

export function createSessionDrivers(userData: string, home: string, proofEnabled: boolean) {
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

// ADR-0041: adds the `PreCompact` hook to the user's Claude settings, and names where it writes.
export function watchClaudeCompactions(home: string) {
  const starts = claudeCompactionStartsRoot(home)
  installCompactionHook(claudeSettingsPath(home), starts)
    .then((install) => {
      if (install === 'refused')
        console.warn('Claude settings could not be read, so compactions stay hidden until they end')
    })
    .catch((error) => console.error('Claude compaction hook failed to install', error))
  return starts
}

// The connection is this window's, so it is handed back when the window goes rather than held
// until the process exits: a relaunch against the same `userData` then finds nothing open.
function indexForWindow(window: BrowserWindow, userData: string) {
  const index = createWorkerSessionIndex(sessionIndexPath(userData))
  window.on('closed', () => void index.close())
  return index
}

export function attachSessions(
  window: BrowserWindow,
  request: {
    rendererURL: string
    home: string
    userData: string
    drivers: ReturnType<typeof createSessionDrivers>
    compactionStarts?: string
  },
) {
  const { rendererURL, home, userData, drivers, compactionStarts } = request
  const { claude, codex } = drivers
  const ticketLinks = createSessionTicketLinkStore(
    path.join(userData, 'portable-v1', 'session-tickets.json'),
  )
  // Argo's own archive flag, for every harness at once (#2315).
  const archive = createSessionArchiveStore(sessionArchivePath(userData))
  // Both adapters read their bounded window through one index, so a warm Roster reopens no
  // transcript the last pass already projected (#2372).
  const index = indexForWindow(window, userData)
  const sources = sessionSources({ home, drivers, compactionStarts, index })
  const reader = createSessionReader(sources, ticketLinks, archive)
  attachSessionBridge(window, {
    reader,
    adapters: {
      claude: createClaudeDriveAdapter(claude),
      codex: createCodexDriveAdapter(codex),
    },
    rendererURL,
  })
  // A Session written by a CLI outside Argo reaches the roster because the trees the CLIs write to
  // are watched, not because the roster re-reads them on a timer. A Permission is the same idea off
  // disk: the gate that holds the CLI's hook open is what tells the screen (#2299). The archive
  // store stands beside the transcripts: the roster and the Archived list are both read out of it.
  // Focus and resume stand beside the trees because FSEvents can lose events with no error and no
  // closed handle (#2303). None of the three fires for a Session left running while the window sits
  // untouched in the background, so the periodic backstop bounds how long that loss can hide one
  // (#2414).
  registerWatching(window, {
    permissions: [claude.onPermissionsChanged],
    sessions: [
      codex.onRosterChanged,
      withReconcile(
        watchTrees([
          claudeTranscriptsRoot(home),
          codexTranscriptsRoot(home),
          sessionArchivePath(userData),
        ]),
        sources,
        reader,
      ),
      withReconcile(watchWindowFocus(window), sources, reader),
      withReconcile(watchSystemResume(powerMonitor), sources, reader),
      withReconcile(watchPeriodically(), sources, reader),
    ],
  })
  // Backfill starts on attach; its first completed pass reconciles launch changes (#2373).
  startBackfill(window, sources, reader)
}
