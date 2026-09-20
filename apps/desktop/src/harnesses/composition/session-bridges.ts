// Wiring the Sessions room to a window. Every Harness starts itself and exposes only its bound runtime.
import { type BrowserWindow, powerMonitor } from 'electron'
import type { SessionDriveAdapters } from '@/domains/sessions/contract/session-drive-adapter'
import {
  createSessionArchiveStore,
  sessionArchivePath,
} from '@/domains/sessions/main/archive/archive-store'
import { attachSessionBridge } from '@/domains/sessions/main/composition/bridge'
import {
  startBackfill,
  withReconcile,
} from '@/domains/sessions/main/index/session-background-indexing'
import { sessionIndexPath } from '@/domains/sessions/main/index/session-index/open-index'
import { createWorkerSessionIndex } from '@/domains/sessions/main/index/session-index/worker-index'
import { createSessionReader } from '@/domains/sessions/main/observation/reader'
import {
  createSessionUnreadStore,
  sessionUnreadPath,
} from '@/domains/sessions/main/unread/unread-store'
import type { SessionTicketLinkStore } from '@/domains/tickets/main/port'
import type {
  HarnessRegistration,
  HarnessRuntime,
} from '@/harnesses/composition/harness-registration'
import { sessionHarnesses } from '@/harnesses/composition/registered-harnesses'
import { registerWatching } from '@/platform/main/watch/bridge'
import { watchTrees } from '@/platform/main/watch/watch-paths'
import {
  watchPeriodically,
  watchSystemResume,
  watchWindowFocus,
} from '@/platform/main/watch/watch-signals'
import type { WatchedSource } from '@/platform/main/watch/watch-source'

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

export function attachSessions(
  window: BrowserWindow,
  request: {
    rendererURL: string
    home: string
    userData: string
    ticketLinks: SessionTicketLinkStore
    proofEnabled: boolean
    acceptance: boolean
    // Defaults to the app's registered list; a test hands its own, including a fixture harness,
    // to prove this composition generalises without touching that list (#2488).
    harnesses?: readonly HarnessRegistration[]
  },
) {
  const {
    rendererURL,
    home,
    userData,
    ticketLinks,
    proofEnabled,
    acceptance,
    harnesses = sessionHarnesses,
  } = request
  // Argo's own archive flag, for every harness at once (#2315).
  const archive = createSessionArchiveStore(sessionArchivePath(userData))
  const unread = createSessionUnreadStore(sessionUnreadPath(userData))
  // Both adapters read their bounded window through one index, so a warm Roster reopens no
  // transcript the last pass already projected (#2372).
  const index = indexForWindow(window, userData)
  const runtimes = harnesses.map((harness) =>
    harness.start({ userData, home, proofEnabled, acceptance, index }),
  )
  const sources = runtimes.map((runtime) => runtime.source)
  const reader = createSessionReader(sources, ticketLinks, { ...archive, unread })
  const adapters: SessionDriveAdapters = Object.fromEntries(
    runtimes.map((runtime) => [runtime.harness, runtime.driveAdapter]),
  )
  attachSessionBridge(window, { reader, adapters, rendererURL })
  // A Session written by a Harness outside Argo reaches the roster because the trees the CLIs write to
  // are watched, not because the roster re-reads them on a timer. A Permission is the same idea off
  // disk: the gate that holds the Harness's hook open is what tells the screen (#2299). The archive
  // store stands beside the transcripts: the roster and the Archived list are both read out of it.
  // Focus and resume stand beside the trees because FSEvents can lose events with no error and no
  // closed handle (#2303). None of the three fires for a Session left running while the window sits
  // untouched in the background, so the periodic backstop bounds how long that loss can hide one
  // (#2414).
  const transcriptRoots = runtimes.flatMap((runtime) => runtime.watchedTranscriptRoots)
  const harnessSources = harnessWatchedSources(runtimes)
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
  return runtimes
}
