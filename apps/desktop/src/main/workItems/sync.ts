import { readRemoteRepo } from '../git'
import type { Hub } from '../hub'
import { projectFolder } from '../projects'
import { createGitHubWorkItems } from './github/adapter'
import type { Http } from './http'
import { createWorkItemPoller, type WorkItemPoller } from './poller'
import type { TokenStore } from './tokenStore'

// Which Project's backlog is being polled, kept in step with which Project the window is
// showing. One poller at a time: a background Project's tickets are not on screen, and polling
// every registered repo would spend a rate limit on answers nobody is reading.

export interface WorkItemSyncOptions {
  hub: Hub
  tokenStore: TokenStore
  http: Http
}

export interface WorkItemSync {
  start(): void
  /** Re-target now rather than on the next projection delta — what a completed sign-in needs,
   * since connecting changes nothing about which Project is active. */
  refresh(): void
  stop(): void
}

export function createWorkItemSync(options: WorkItemSyncOptions): WorkItemSync {
  let poller: WorkItemPoller | null = null
  let unsubscribe: (() => void) | null = null
  // `undefined` is "never targeted", which `null` (no active Project) must not collapse into,
  // or the first pass would mistake the empty launch state for one it had already handled.
  let targeted: string | null | undefined

  async function retarget(): Promise<void> {
    const projectId = options.hub.getState().activeProjectId
    if (projectId === targeted) return
    targeted = projectId
    poller?.stop()
    poller = await pollerFor(options, projectId)
    poller?.start()
  }

  return {
    start() {
      // Every delta is a chance the active Project moved; `retarget` decides in one comparison
      // whether it actually did, which is cheaper than a second subscription of its own.
      unsubscribe = options.hub.subscribe(() => void retarget())
    },
    refresh() {
      targeted = undefined
      void retarget()
    },
    stop() {
      unsubscribe?.()
      unsubscribe = null
      poller?.stop()
      poller = null
    },
  }
}

// Three ways there is honestly nothing to poll — no active Project, no token, or a checkout
// that is not a GitHub repository. All three are "not connected", none is an error, and none
// of them is worth a fabricated empty backlog.
async function pollerFor(
  options: WorkItemSyncOptions,
  projectId: string | null,
): Promise<WorkItemPoller | null> {
  if (projectId === null) return null
  const folder = projectFolder(options.hub.getState(), projectId)
  const token = await options.tokenStore.read()
  if (folder === null || token === null) return null

  const repo = await readRemoteRepo(folder)
  if (repo === null) return null

  return createWorkItemPoller({
    provider: createGitHubWorkItems({ ...repo, projectId, http: options.http, token }),
    projectId,
    emit: (event) => options.hub.apply(event),
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  })
}
