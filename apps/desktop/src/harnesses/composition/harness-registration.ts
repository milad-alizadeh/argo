// A Harness exposes one deep startup seam: it binds its driver before shared composition sees it.
import type { BrowserWindow } from 'electron'
import type { SessionRosterRow } from '@/domains/sessions/contract/model/models'
import type { SessionDriveAdapter } from '@/domains/sessions/contract/session-drive-adapter'
import type { SessionIndex } from '@/domains/sessions/main/indexing/session-index/contract'
import type { SessionSource } from '@/domains/sessions/main/observation/reader/session-source'
import type { WatchedSource } from '@/platform/main/watch/watch-source'

export type ManagedSessionBridges = {
  managedSessions?: Readonly<Record<string, () => SessionRosterRow[]>>
  managedLiveMessages?: Readonly<
    Record<string, (sessionId: string) => { id: string; text: string }[]>
  >
  managedRosterChanges?: Readonly<Record<string, WatchedSource>>
  managedRename?: Readonly<Record<string, (sessionId: string, title: string) => Promise<void>>>
}

export type HarnessStartDeps = ManagedSessionBridges & {
  userData: string
  home: string
  proofEnabled: boolean
  acceptance: boolean
  index: SessionIndex
}

export type HarnessRuntime = {
  readonly harness: string
  readonly source: SessionSource
  readonly driveAdapter: SessionDriveAdapter
  readonly watchedTranscriptRoots: readonly string[]
  readonly onboardingDriver?: unknown
  close(): Promise<void>
  onPermissionsChanged?: WatchedSource
  onRosterChanged?: WatchedSource
  attachSettingsBridge?(window: BrowserWindow, request: { home: string; rendererURL: string }): void
}

export type HarnessRegistration = {
  readonly harness: string
  start(deps: HarnessStartDeps): HarnessRuntime
}
