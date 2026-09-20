// One declared shape per harness (#2488): everything shared Session composition needs to add a
// CLI, so the composition root iterates entries instead of naming `claude` or `codex`. The
// channel a Driver owns stays the adapter's (ADR-0024): this shape only says how to build one, not
// what it does.
import type { SessionDriveAdapter } from '@/domains/sessions/main/drive/session-drive-adapter'
import type { SessionIndex } from '@/domains/sessions/main/index/session-index/contract'
import type { SessionSource } from '@/domains/sessions/main/observation/session-source'
import type { WatchedSource } from '@/platform/main/watch/watch-source'

export type HarnessDriverDeps = {
  userData: string
  home: string
  proofEnabled: boolean
}

export type HarnessSourceDeps = {
  home: string
  compactionStarts: string | undefined
  index: SessionIndex
}

// `Driver` is this harness's own type and never appears outside its registration: shared code
// only ever calls back into the same entry that produced the value, so the driver never needs a
// name shared code could recognise.
export type HarnessRegistration<Driver> = {
  readonly cli: string
  createDriver(deps: HarnessDriverDeps): Driver
  createSource(driver: Driver, deps: HarnessSourceDeps): SessionSource
  createDriveAdapter(driver: Driver): SessionDriveAdapter
  // Trees the shared `sessions` watch recurses. A harness with no filesystem transcript root
  // (a future in-memory or remote one) returns none.
  watchedTranscriptRoots(home: string): readonly string[]
  closeDriver(driver: Driver): Promise<void>
  // Only Claude raises a Permission off its own local hook; only Codex reports its roster off a
  // channel notification rather than a tree write. Both are optional because most harnesses need
  // neither: the tree watch above already covers a Session written to disk.
  onPermissionsChanged?(driver: Driver): WatchedSource
  onRosterChanged?(driver: Driver): WatchedSource
}
