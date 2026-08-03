import type { Hub } from './hub'
import { startObservation } from './observe'

// A spawned agent only becomes observable once it has written its first transcript line, so
// the launch sweep that already ran cannot see it. This re-runs that sweep a few times over a
// bounded window — long enough for the CLI to write, short enough to stay a consequence of one
// keystroke rather than a poll. The sweep is idempotent at the hub, so a re-run costs nothing
// but the read, and it stops the moment a Session the roster did not have appears.

const RESWEEP_DELAYS_MS = [800, 2000, 5000] as const

export async function observeAfterSpawn(hub: Hub, known: Set<string>): Promise<void> {
  for (const delay of RESWEEP_DELAYS_MS) {
    await new Promise((resolve) => setTimeout(resolve, delay))
    await startObservation(hub)
    if (hub.getState().sessions.some((session) => !known.has(session.id))) return
  }
}
