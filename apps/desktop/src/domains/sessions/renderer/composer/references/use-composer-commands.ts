import { useEffect, useState } from 'react'
import {
  type ComposerCommandListing,
  composerCommandListingSchema,
} from '@/domains/sessions/api/composer-commands'
import type { Harness } from '@/harnesses/harness'
import { trpcClient } from '@/platform/renderer/trpc-client'
import { replaceComposerCommands } from './composer-command-registry'

const PENDING: ComposerCommandListing = { availability: 'pending', commands: [] }

export function useComposerCommands(input: {
  enabled: boolean
  harness: Harness | null
  cwd: string | null
  sessionId: string | null
}): ComposerCommandListing {
  const requestKey = `${input.enabled}:${input.harness ?? ''}:${input.sessionId ?? ''}:${input.cwd ?? ''}`
  const [state, setState] = useState({ requestKey, listing: PENDING })
  if (state.requestKey !== requestKey) setState({ requestKey, listing: PENDING })
  const { listing } = state

  useEffect(() => {
    if (!input.enabled || input.harness === null) return
    const harness = input.harness
    let cancelled = false
    const publish = (next: ComposerCommandListing) => {
      if (cancelled) return
      const parsed = composerCommandListingSchema.safeParse(next)
      const listing = parsed.success ? parsed.data : PENDING
      setState({ requestKey, listing })
      if (listing.availability === 'listed') replaceComposerCommands(harness, listing.commands)
    }
    if (input.sessionId === null) {
      void trpcClient.composerCommands
        .query({ harness, cwd: input.cwd })
        .then(publish, () => publish(PENDING))
      return () => {
        cancelled = true
      }
    }
    const subscription = trpcClient.sessionComposerCommands.subscribe(
      { sessionId: input.sessionId },
      { onData: publish, onError: () => publish(PENDING) },
    )
    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [input.cwd, input.enabled, input.harness, input.sessionId, requestKey])

  return input.enabled ? listing : PENDING
}
