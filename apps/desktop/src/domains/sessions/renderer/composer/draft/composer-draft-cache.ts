import type { QueryClient } from '@tanstack/react-query'
import { type RouterOutputs, trpc } from '@/platform/renderer/trpc-client'

type DraftValue = RouterOutputs['composerDraftCreate']

// A read keys by target, and a new-Session target changes with its worktree choice, so the last
// draft value is also kept by owner. It sits under the read's path, so clearing the reads clears it.
const OWNER_QUERY_KEY = [...trpc.composerDraftRead.pathKey(), { type: 'owner' }]

function ownerQueryKey(owner: string) {
  return [...trpc.composerDraftRead.pathKey(), { owner, type: 'owner' }]
}

export function cachedComposerDraft(queryClient: QueryClient, owner: string) {
  return queryClient.getQueryData<DraftValue>(ownerQueryKey(owner))
}

// A value older than the cached revision of the same draft never replaces it.
export function rememberComposerDraft(queryClient: QueryClient, owner: string, draft: DraftValue) {
  const cached = cachedComposerDraft(queryClient, owner)
  if (cached?.id === draft.id && draft.revision < cached.revision) return
  queryClient.setQueryDefaults(OWNER_QUERY_KEY, { gcTime: Number.POSITIVE_INFINITY })
  queryClient.setQueryData(ownerQueryKey(owner), draft)
}

// A Send clears the draft it sent, not one saved after it.
export function forgetComposerDraft(
  queryClient: QueryClient,
  owner: string,
  sent: { id: string; revision: number },
) {
  const cached = cachedComposerDraft(queryClient, owner)
  if (cached?.id !== sent.id || cached.revision !== sent.revision) return
  queryClient.removeQueries({ queryKey: ownerQueryKey(owner), exact: true })
}
