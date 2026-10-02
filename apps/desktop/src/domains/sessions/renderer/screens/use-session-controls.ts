import { useMutation } from '@tanstack/react-query'
import { HARNESS_PRESENTATIONS } from '@/harnesses/presentation-registry'
import { trpc } from '@/platform/renderer/trpc-client'
import type { HarnessControl } from '../harness'
import type { Session } from '../types'

// A control resolves true once the live Session's Harness has done it.
function succeeded(control: Promise<unknown>) {
  return control.then(
    () => true,
    () => false,
  )
}

// Interrupt and Compact act on the Session's live channel, so neither is offered without one.
export function useSessionControls(input: {
  sessionId: string | null
  session: Session | null
  harness: HarnessControl | null
  isRunning: boolean
}) {
  const { mutateAsync: interrupt } = useMutation(trpc.sessionInterrupt.mutationOptions())
  const compaction = useMutation(trpc.sessionCompact.mutationOptions())
  const { sessionId, session, harness, isRunning } = input
  if (sessionId === null) return { isCompacting: false }
  const compacts =
    harness !== null &&
    HARNESS_PRESENTATIONS[harness.harness].compactsContext &&
    session?.posture === 'live' &&
    !isRunning
  return {
    onInterrupt: () => succeeded(interrupt({ sessionId })),
    onCompact: compacts ? () => succeeded(compaction.mutateAsync({ sessionId })) : undefined,
    isCompacting: compaction.isPending,
  }
}
