// Wiring the Sessions room to a window. Every Harness starts itself and exposes only its bound runtime.
import { type BrowserWindow, powerMonitor } from 'electron'
import type { SessionDriveAdapters } from '@/domains/sessions/contract/session-drive-adapter'
import {
  type SessionArchiveStore,
  sessionArchivePath,
} from '@/domains/sessions/main/archive/store/archive-store'
import { attachSessionBridge } from '@/domains/sessions/main/composition/bridge'
import {
  startBackfill,
  withReconcile,
} from '@/domains/sessions/main/indexing/session-background-indexing'
import { sessionIndexPath } from '@/domains/sessions/main/indexing/session-index/open-index'
import { createWorkerSessionIndex } from '@/domains/sessions/main/indexing/session-index/worker-index'
import { createSessionReader } from '@/domains/sessions/main/observation/reader/reader'
import type { SessionSource } from '@/domains/sessions/main/observation/reader/session-source'
import {
  createSessionUnreadStore,
  sessionUnreadPath,
} from '@/domains/sessions/main/unread/unread-store'
import type { SessionTicketLinkStore } from '@/domains/tickets/main/session-links'
import { registerWatching } from '@/platform/main/watch/bridge'
import { watchTrees } from '@/platform/main/watch/watch-paths'
import {
  watchPeriodically,
  watchSystemResume,
  watchWindowFocus,
} from '@/platform/main/watch/watch-signals'
import type { WatchedSource } from '@/platform/main/watch/watch-source'
import type {
  HarnessRegistration,
  HarnessRuntime,
  ManagedSessionBridges,
} from './harness-registration'
import { sessionHarnesses } from './registered-harnesses'

// A Harness callback reaches `registerWatching` raw when its own runtime already reconciles it.
export function harnessWatchedSources(harnesses: readonly HarnessRuntime[]): {
  permissions: WatchedSource[]
  sessions: WatchedSource[]
} {
  return {
    permissions: harnesses.flatMap((harness) =>
      harness.onPermissionsChanged === undefined ? [] : [harness.onPermissionsChanged],
    ),
    sessions: harnesses.flatMap((harness) =>
      harness.onRosterChanged === undefined ? [] : [harness.onRosterChanged],
    ),
  }
}

// The connection is this window's, so it is handed back when the window goes rather than held
// until the process exits: a relaunch against the same `userData` then finds nothing open.
function indexForWindow(window: BrowserWindow, userData: string) {
  const index = createWorkerSessionIndex(sessionIndexPath(userData))
  window.on('closed', () => void index.close())
  return index
}

type AttachSessionsRequest = ManagedSessionBridges & {
  rendererURL: string
  home: string
  userData: string
  archive: SessionArchiveStore
  ticketLinks: SessionTicketLinkStore
  proofEnabled: boolean
  acceptance: boolean
  driveAdapters?: Partial<SessionDriveAdapters>
  harnesses?: readonly HarnessRegistration[]
  sources?: readonly SessionSource[]
  excludedSourceHarnesses?: readonly string[]
  polledSources?: readonly SessionSource[]
  watchedRoots?: readonly string[]
}

function attachWatching(options: {
  window: BrowserWindow
  runtimes: HarnessRuntime[]
  sources: SessionSource[]
  reader: ReturnType<typeof createSessionReader>
  userData: string
  managedRosterChanges?: Readonly<Record<string, WatchedSource>>
  polledSources?: readonly SessionSource[]
  watchedRoots?: readonly string[]
}) {
  const {
    window,
    runtimes,
    sources,
    reader,
    userData,
    managedRosterChanges = {},
    polledSources = sources,
    watchedRoots = [],
  } = options
  const transcriptRoots = runtimes.flatMap((runtime) => runtime.watchedTranscriptRoots)
  const harnessSources = harnessWatchedSources(runtimes)
  registerWatching(window, {
    permissions: harnessSources.permissions,
    sessions: [
      ...harnessSources.sessions,
      ...Object.values(managedRosterChanges),
      withReconcile(
        watchTrees([...transcriptRoots, ...watchedRoots, sessionArchivePath(userData)]),
        sources,
        reader,
      ),
      withReconcile(watchWindowFocus(window), sources, reader),
      withReconcile(watchSystemResume(powerMonitor), sources, reader),
      withReconcile(watchPeriodically(), polledSources, reader),
    ],
  })
}

function sourcesFor(
  runtimes: readonly HarnessRuntime[],
  additionalSources: readonly SessionSource[],
  excludedHarnesses: readonly string[],
) {
  return [
    ...runtimes
      .filter((runtime) => !excludedHarnesses.includes(runtime.harness))
      .map((runtime) => runtime.source),
    ...additionalSources,
  ]
}

export function attachSessions(window: BrowserWindow, request: AttachSessionsRequest) {
  const {
    rendererURL,
    home,
    userData,
    archive,
    ticketLinks,
    proofEnabled,
    acceptance,
    driveAdapters = {},
    managedSessions,
    managedLiveMessages,
    managedRosterChanges,
    managedRename,
    watchedRoots,
    sources: additionalSources = [],
    excludedSourceHarnesses = [],
    polledSources,
    harnesses = sessionHarnesses,
  } = request
  // Argo's own archive flag, for every harness at once (#2315).
  const unread = createSessionUnreadStore(sessionUnreadPath(userData))
  // Both adapters read their bounded window through one index, so a warm Roster reopens no
  // transcript the last pass already projected (#2372).
  const index = indexForWindow(window, userData)
  const runtimes = harnesses.map((harness) =>
    harness.start({
      userData,
      home,
      proofEnabled,
      acceptance,
      index,
      managedSessions,
      managedLiveMessages,
      managedRosterChanges,
      managedRename,
    }),
  )
  const sources = sourcesFor(runtimes, additionalSources, excludedSourceHarnesses)
  const reader = createSessionReader(sources, ticketLinks, { ...archive, unread })
  const adapters: SessionDriveAdapters = {}
  for (const runtime of runtimes) adapters[runtime.harness] = runtime.driveAdapter
  for (const [harness, adapter] of Object.entries(driveAdapters)) {
    if (adapter !== undefined) adapters[harness] = adapter
  }
  attachSessionBridge(window, { reader, adapters, rendererURL })
  attachWatching({
    window,
    runtimes,
    sources,
    reader,
    userData,
    managedRosterChanges,
    polledSources,
    watchedRoots,
  })
  // Backfill starts on attach; its first completed pass reconciles launch changes (#2373).
  startBackfill(window, sources, reader)
  return runtimes
}
