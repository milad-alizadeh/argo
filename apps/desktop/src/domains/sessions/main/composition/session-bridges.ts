// Wiring the Sessions room to a window: every registered harness's driver, the roster reader over
// all of them, and the Claude compaction hook. Separate from `bridges.ts` so the composition root
// stays one `attach*` call per domain (ADR-0021). Iterates `sessionHarnesses` (#2488); nothing
// below switches on or names a `cli`. Adding a harness is one entry in `registered-harnesses.ts`.
import { type BrowserWindow, powerMonitor } from 'electron'
import { installCompactionHook } from '@/agents/claude/compaction/compaction-hook'
import { claudeCompactionStartsRoot, claudeSettingsPath } from '@/agents/claude/sessions/roots'
import {
  createSessionArchiveStore,
  sessionArchivePath,
} from '@/domains/sessions/main/archive/archive-store'
import { attachSessionBridge, type SessionReader } from '@/domains/sessions/main/composition/bridge'
import type {
  HarnessDriverDeps,
  HarnessRegistration,
} from '@/domains/sessions/main/composition/harness-registration'
import { sessionHarnesses } from '@/domains/sessions/main/composition/registered-harnesses'
import type { SessionDriveAdapters } from '@/domains/sessions/main/drive/session-drive-adapter'
import {
  startBackfill,
  withReconcile,
} from '@/domains/sessions/main/index/session-background-indexing'
import { sessionIndexPath } from '@/domains/sessions/main/index/session-index/open-index'
import { createWorkerSessionIndex } from '@/domains/sessions/main/index/session-index/worker-index'
import { createSessionReader } from '@/domains/sessions/main/observation/reader'
import { sessionSources } from '@/domains/sessions/main/observation/session-sources'
import type { SessionSource } from '@/domains/sessions/main/observation/session-source'
import {
  createSessionUnreadStore,
  sessionUnreadPath,
} from '@/domains/sessions/main/unread/unread-store'
import type { SessionTicketLinkStore } from '@/domains/tickets/main/port'
import { registerWatching } from '@/platform/main/watch/bridge'
import { watchTrees } from '@/platform/main/watch/watch-paths'
import {
  watchPeriodically,
  watchSystemResume,
  watchWindowFocus,
} from '@/platform/main/watch/watch-signals'
import type { WatchedSource } from '@/platform/main/watch/watch-source'

export type SessionDrivers = Record<string, unknown>

// `harnesses` defaults to the app's registered list; a test hands its own, including a fixture
// harness, to prove this composition generalises without touching that list (#2488).
export function createSessionDrivers(
  userData: string,
  home: string,
  proofEnabled: boolean,
  harnesses: readonly HarnessRegistration<unknown>[] = sessionHarnesses,
): SessionDrivers {
  const deps: HarnessDriverDeps = { userData, home, proofEnabled }
  const drivers: SessionDrivers = {}
  for (const harness of harnesses) drivers[harness.cli] = harness.createDriver(deps)
  return drivers
}

export async function closeSessionDrivers(
  drivers: SessionDrivers,
  harnesses: readonly HarnessRegistration<unknown>[] = sessionHarnesses,
): Promise<void> {
  await Promise.all(harnesses.map((harness) => harness.closeDriver(drivers[harness.cli])))
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

// Only Claude raises a Permission off its own local hook; only Codex reports its roster off a
// channel notification, already reconciled inside its own driver, so it reaches `registerWatching`
// raw rather than through the tree watch's `withReconcile`. A harness declaring neither relies on
// the tree watch alone. Exported so a test can prove a fixture harness's callback reaches
// `registerWatching` without the rest of `attachSessions` (#2488).
export function harnessWatchedSources(
  drivers: SessionDrivers,
  _sources: readonly SessionSource[],
  _reader: SessionReader,
  harnesses: readonly HarnessRegistration<unknown>[] = sessionHarnesses,
): { permissions: WatchedSource[]; sessions: WatchedSource[] } {
  return {
    permissions: harnesses.flatMap((harness) => {
      const onChanged = harness.onPermissionsChanged?.(drivers[harness.cli])
      return onChanged === undefined ? [] : [onChanged]
    }),
    sessions: harnesses.flatMap((harness) => {
      const onChanged = harness.onRosterChanged?.(drivers[harness.cli])
      return onChanged === undefined ? [] : [onChanged]
    }),
  }
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
    drivers: SessionDrivers
    ticketLinks: SessionTicketLinkStore
    compactionStarts?: string
    // Defaults to the app's registered list; a test hands its own, including a fixture harness,
    // to prove this composition generalises without touching that list (#2488).
    harnesses?: readonly HarnessRegistration<unknown>[]
  },
) {
  const {
    rendererURL,
    home,
    userData,
    drivers,
    ticketLinks,
    compactionStarts,
    harnesses = sessionHarnesses,
  } = request
  // Argo's own archive flag, for every harness at once (#2315).
  const archive = createSessionArchiveStore(sessionArchivePath(userData))
  const unread = createSessionUnreadStore(sessionUnreadPath(userData))
  // Both adapters read their bounded window through one index, so a warm Roster reopens no
  // transcript the last pass already projected (#2372).
  const index = indexForWindow(window, userData)
  const sources = sessionSources({ home, drivers, compactionStarts, index, harnesses })
  const reader = createSessionReader(sources, ticketLinks, { ...archive, unread })
  const adapters: SessionDriveAdapters = Object.fromEntries(
    harnesses.map((harness) => [harness.cli, harness.createDriveAdapter(drivers[harness.cli])]),
  )
  attachSessionBridge(window, { reader, adapters, rendererURL })
  // A Session written by a CLI outside Argo reaches the roster because the trees the CLIs write to
  // are watched, not because the roster re-reads them on a timer. A Permission is the same idea off
  // disk: the gate that holds the CLI's hook open is what tells the screen (#2299). The archive
  // store stands beside the transcripts: the roster and the Archived list are both read out of it.
  // Focus and resume stand beside the trees because FSEvents can lose events with no error and no
  // closed handle (#2303). None of the three fires for a Session left running while the window sits
  // untouched in the background, so the periodic backstop bounds how long that loss can hide one
  // (#2414).
  const transcriptRoots = harnesses.flatMap((harness) => harness.watchedTranscriptRoots(home))
  const harnessSources = harnessWatchedSources(drivers, sources, reader, harnesses)
  registerWatching(window, {
    permissions: harnessSources.permissions,
    sessions: [
      ...harnessSources.sessions,
      withReconcile(
        watchTrees([...transcriptRoots, sessionArchivePath(userData)]),
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
