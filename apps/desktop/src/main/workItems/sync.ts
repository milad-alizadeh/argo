import { readRemoteRepository } from '../git'
import type { Hub } from '../hub'
import { projectFolder } from '../projects'
import { createGitHubWorkItems } from './github/adapter'
import { type Http, sleep } from './http'
import { createWorkItemPoller, type WorkItemPoller } from './poller'
import type { TokenStore } from './tokenStore'

// Which Project's backlog is being polled, kept in step with which Project the window is
// showing. One poller at a time: a background Project's tickets are not on screen, and polling
// every registered repository would spend a rate limit on answers nobody is reading.

export interface WorkItemSyncOptions {
  hub: Hub
  tokenStore: TokenStore
  http: Http
}

export interface WorkItemSync {
  /** Read the keychain and report what it says about the grant, then follow the active
   * Project. Called once at launch, before any Project may exist. */
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
  // Building a poller reads the keychain and git, so two quick Project switches overlap. The
  // generation is what tells the slower one it has been superseded: without it both pollers
  // start and only the later-resolving one is reachable to stop.
  let generation = 0

  async function retarget(): Promise<void> {
    const projectId = options.hub.getState().activeProjectId
    if (projectId === targeted) return
    targeted = projectId
    generation += 1
    const mine = generation
    poller?.stop()
    poller = null

    const next = await pollerFor(options, projectId)
    if (mine !== generation) return
    poller = next
    poller?.start()
  }

  return {
    start() {
      // Every delta is a chance the active Project moved; `retarget` decides in one comparison
      // whether it actually did, which is cheaper than a second subscription of its own.
      unsubscribe = options.hub.subscribe(() => void retarget())
      // A first launch with nothing registered produces no delta at all, and the grant would
      // then go unread until something else moved — so the first pass is taken here.
      void retarget()
    },
    refresh() {
      targeted = undefined
      void retarget()
    },
    stop() {
      unsubscribe?.()
      unsubscribe = null
      // Bumped so a retarget still resolving cannot start a poller after the app quit.
      generation += 1
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
  // The keychain is read even with no Project to poll, because the connect panel's rows
  // complete in any order (#165): signing in before choosing a folder must still light the
  // Connections row.
  const token = await options.tokenStore.read()
  reportGrant(options.hub, token)
  if (projectId === null || token === null) return null

  const folder = projectFolder(options.hub.getState(), projectId)
  if (folder === null) return null

  const repository = await readRemoteRepository(folder)
  if (repository === null) return null

  return createWorkItemPoller({
    provider: createGitHubWorkItems({ ...repository, projectId, http: options.http, token }),
    projectId,
    emit: (event) => options.hub.apply(event),
    wait: sleep,
  })
}

// What the keychain alone can say about the grant, which is whether a token is HELD — the
// launch answer, before any poll has happened. It never overwrites `needs-reconnect`: the
// provider has already refused that exact token, and holding it is not evidence against a
// refusal Argo watched arrive.
function reportGrant(hub: Hub, token: string | null): void {
  if (hub.getState().grant === 'needs-reconnect') return
  hub.apply({ type: 'grant-changed', grant: token === null ? 'none' : 'connected' })
}
