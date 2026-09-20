// A Harness exposes one deep startup seam: it binds its driver before shared composition sees it.
import type { BrowserWindow } from 'electron'
import type { SessionDriveAdapter } from '@/domains/sessions/contract/session-drive-adapter'
import type { SessionIndex } from '@/domains/sessions/main/index/session-index/contract'
import type { SessionSource } from '@/domains/sessions/main/observation/session-source'
import type { WatchedSource } from '@/platform/main/watch/watch-source'

export type HarnessStartDeps = {
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
  close(): Promise<void>
  onPermissionsChanged?: WatchedSource
  onRosterChanged?: WatchedSource
  attachSettingsBridge?(window: BrowserWindow, request: { home: string; rendererURL: string }): void
}

export type HarnessRegistration = {
  readonly harness: string
  start(deps: HarnessStartDeps): HarnessRuntime
}
