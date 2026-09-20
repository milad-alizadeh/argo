// Every registered harness's `SessionSource`, wired to its own driver and the app's shared Session
// index. Split from `session-bridges.ts` to keep that composition root short. Iterates
// `sessionHarnesses` (#2488) rather than naming a `cli`.
import type { HarnessRegistration } from '@/domains/sessions/main/composition/harness-registration'
import { sessionHarnesses } from '@/domains/sessions/main/composition/registered-harnesses'
import type { SessionDrivers } from '@/domains/sessions/main/composition/session-bridges'
import type { SessionIndex } from '@/domains/sessions/main/index/session-index/contract'
import type { SessionSource } from '@/domains/sessions/main/observation/session-source'

type SessionSourcesOptions = {
  home: string
  drivers: SessionDrivers
  compactionStarts: string | undefined
  index: SessionIndex
  // Defaults to the app's registered list; a test hands its own, including a fixture harness
  // (#2488).
  harnesses?: readonly HarnessRegistration<unknown>[]
}

export function sessionSources({
  home,
  drivers,
  compactionStarts,
  index,
  harnesses = sessionHarnesses,
}: SessionSourcesOptions): SessionSource[] {
  return harnesses.map((harness) =>
    harness.createSource(drivers[harness.cli], { home, compactionStarts, index }),
  )
}
