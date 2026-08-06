import type { HubEvent } from '../../shared'
import type { WorkItemProvider } from './port'

// Polling, because a desktop app receives no webhooks (ADR-0018). One poll re-reads the
// Project's whole backlog and emits it; the reducer is the change detector, so a quiet backlog
// costs no re-render and this loop needs no memory of what it last saw.

const INTERVAL_MS = 60_000
/** How far a failing poll backs off before it stops doubling. Long enough that a rate limit or
 * an outage is waited out rather than hammered, short enough that a recovered connection is
 * noticed within a coffee break. */
const MAX_INTERVAL_MS = 15 * 60_000

export interface WorkItemPollerOptions {
  provider: WorkItemProvider
  projectId: string
  emit: (event: HubEvent) => void
  /** Injected so a suite runs the real loop without spending its interval. */
  wait: (ms: number) => Promise<void>
  intervalMs?: number
}

export interface WorkItemPoller {
  start(): void
  stop(): void
}

export function createWorkItemPoller(options: WorkItemPollerOptions): WorkItemPoller {
  const base = options.intervalMs ?? INTERVAL_MS
  let running = false

  async function loop(): Promise<void> {
    let delay = base
    while (running) {
      const read = await options.provider.read()
      if (read.ok) {
        options.emit({ type: 'work-items-synced', projectId: options.projectId, items: read.items })
        delay = base
      } else {
        // A failed poll emits NO BACKLOG: whatever the projection already holds stays rendered
        // at full fidelity, because a dropped packet must not erase a backlog. It does emit the
        // one failure a user can act on — a grant the provider refused — which re-enters the
        // connect panel (#165). Everything else is waiting, and says nothing.
        //
        // Only the refusal travels, never a recovery: a token GitHub has rejected does not heal
        // itself, so standing the grant back up belongs to the sign-in that replaced it.
        if (read.reason === 'rejected') {
          options.emit({ type: 'grant-changed', grant: 'needs-reconnect' })
        }
        delay = Math.min(delay * 2, MAX_INTERVAL_MS)
      }
      await options.wait(delay)
    }
  }

  return {
    start() {
      if (running) return
      running = true
      void loop()
    },
    stop() {
      running = false
    },
  }
}
