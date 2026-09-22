import { rootOf, type SessionChain } from '@/domains/sessions/contract/model'
import { createFullRecordTracker } from '../indexing'
import { freshIdentityOf } from '../indexing'
import { SessionIndex, TranscriptFileIdentity } from '../indexing'
import { createIndexedWindow } from '../indexing'
import { reindexCandidates } from '../indexing'

// The indexed fast path: a Session the Session index has already stitched, at any depth, is
// resolved from its stored chain rather than by growing a window over the whole tree (#2507).
// `undefined` says the index cannot answer (not yet backfilled, or no index at all), which sends
// the caller to the paging walk instead of a false "not found".
export async function readIndexedChain(options: {
  tracker: ReturnType<typeof createFullRecordTracker>
  indexedWindowFor: (index: SessionIndex) => ReturnType<typeof createIndexedWindow>
  index: SessionIndex
  sessionId: string
}): Promise<SessionChain | null | undefined> {
  const { tracker, indexedWindowFor, index, sessionId } = options
  const bound = indexedWindowFor(index)
  await bound.ensureHydrated()
  const { history, harness } = bound.pass.source
  if (!history.knownIds.has(sessionId)) return undefined
  const chainId = rootOf(sessionId, history.parents)
  const indexed = await index.filesOfChains(harness, [chainId])
  if (indexed.length === 0) return undefined
  // The chain this call is about to answer for may be the one its Harness is actively writing, so
  // its files are revalidated against disk and reindexed before being trusted, exactly as an
  // already-known id is revalidated in `resolve-indexed-ids.ts`. The index is re-queried
  // unconditionally afterwards: a member deleted since `indexed` was read must not fall back to
  // that stale array, which would still hand the tracker a dead path and miss whatever the
  // reindex just wrote for the chain's surviving members.
  const identities = (await Promise.all(indexed.map(freshIdentityOf))).filter(
    (identity): identity is TranscriptFileIdentity => identity !== null,
  )
  const reindexed = await reindexCandidates(bound.pass, identities, identities)
  const refreshed = await index.filesOfChains(harness, [chainId])
  if (refreshed.length === 0) return undefined
  const parsedByPath = new Map(reindexed.files.map((file) => [file.path, file]))
  const parsed = refreshed.map((file) => parsedByPath.get(file.path))
  const files = parsed.every((file) => file !== undefined)
    ? parsed
    : await tracker.readChainFiles({
        id: chainId,
        files: refreshed.map((file) => ({ path: file.path, sessionId: file.sessionId })),
      })
  files.sort((left, right) => left.openedAt.localeCompare(right.openedAt))
  const retiredIds = [...new Set(refreshed.map((file) => file.sessionId))].filter(
    (id) => id !== chainId,
  )
  return {
    id: chainId,
    retiredIds,
    files,
    originUnread: !refreshed.some((file) => file.sessionId === chainId),
  }
}
