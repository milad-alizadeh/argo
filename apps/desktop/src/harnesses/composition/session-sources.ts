// Every registered harness's `SessionSource`, wired to its own driver and the app's shared Session
// index. Split from `session-bridges.ts` to keep that composition root short. Iterates
// `sessionHarnesses` (#2488) rather than naming a `harness`.

import type { SessionIndex } from '@/domains/sessions/main/index/session-index/contract'
import type { SessionSource } from '@/domains/sessions/main/observation/session-source'
import type { HarnessRegistration } from '@/harnesses/composition/harness-registration'
import { sessionHarnesses } from '@/harnesses/composition/registered-harnesses'
import type { SessionDrivers } from '@/harnesses/composition/session-bridges'

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
    harness.createSource(drivers[harness.harness], { home, compactionStarts, index }),
  )
}
