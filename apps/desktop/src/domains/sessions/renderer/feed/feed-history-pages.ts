import type { Dispatch, SetStateAction } from 'react'
import type { SessionFeedPage, SessionId } from '../types'

type OlderPages = {
  pages: SessionFeedPage[]
  cursor: string | null
  loading: boolean
  failed: boolean
}

export type OlderPagesByChain = Record<string, OlderPages>

const MAX_RETAINED_FEED_CHAINS = 5

export function feedChainKey(sessionId: SessionId | null, subagentId: string | null) {
  return JSON.stringify([sessionId, subagentId])
}

function updateOlderPages(
  previous: OlderPagesByChain,
  chainKey: string,
  update: (current: OlderPages | undefined) => OlderPages | undefined,
): OlderPagesByChain {
  const current = previous[chainKey]
  const next = update(current)
  if (next === current) return previous
  if (next === undefined) {
    const { [chainKey]: _removed, ...remaining } = previous
    return remaining
  }
  return withRecentChain(previous, chainKey, next)
}

function withRecentChain(
  previous: OlderPagesByChain,
  chainKey: string,
  pages: OlderPages,
): OlderPagesByChain {
  const { [chainKey]: _previous, ...remaining } = previous
  const next = { ...remaining, [chainKey]: pages }
  const keys = Object.keys(next)
  if (keys.length <= MAX_RETAINED_FEED_CHAINS) return next
  const retained: OlderPagesByChain = {}
  for (const key of keys.slice(-MAX_RETAINED_FEED_CHAINS)) {
    const olderPages = next[key]
    if (olderPages !== undefined) retained[key] = olderPages
  }
  return retained
}

export function touchOlderFeedChain(
  previous: OlderPagesByChain,
  chainKey: string,
): OlderPagesByChain {
  const current = previous[chainKey]
  return current === undefined ? previous : withRecentChain(previous, chainKey, current)
}

async function refreshExpiredFeedCursor(
  chainKey: string,
  refreshLatest: () => Promise<SessionFeedPage | null>,
  setOlderByChain: Dispatch<SetStateAction<OlderPagesByChain>>,
) {
  setOlderByChain((previous) =>
    updateOlderPages(previous, chainKey, (current) =>
      current === undefined ? current : { ...current, pages: [] },
    ),
  )
  try {
    const refreshed = await refreshLatest()
    setOlderByChain((previous) =>
      updateOlderPages(previous, chainKey, (current) =>
        current === undefined
          ? current
          : {
              ...current,
              pages: [],
              cursor: refreshed?.olderCursor ?? null,
              loading: false,
              failed: false,
            },
      ),
    )
  } catch {
    setOlderByChain((previous) =>
      updateOlderPages(previous, chainKey, (current) =>
        current === undefined ? current : { ...current, loading: false, failed: true },
      ),
    )
  }
}

export async function loadOlderFeedPage({
  sessionId,
  subagentId,
  cursor,
  loadingKeys,
  refreshLatest,
  readPage,
  setOlderByChain,
}: {
  sessionId: SessionId | null
  subagentId: string | null
  cursor: string | null
  loadingKeys: Set<string>
  refreshLatest: () => Promise<SessionFeedPage | null>
  readPage: (
    sessionId: SessionId,
    subagentId: string | null,
    cursor: string,
  ) => Promise<SessionFeedPage>
  setOlderByChain: Dispatch<SetStateAction<OlderPagesByChain>>
}) {
  if (sessionId === null || cursor === null) return
  const chainKey = feedChainKey(sessionId, subagentId)
  if (loadingKeys.has(chainKey)) return
  loadingKeys.add(chainKey)
  setOlderByChain((previous) =>
    updateOlderPages(previous, chainKey, (current) => ({
      pages: current?.pages ?? [],
      cursor,
      loading: true,
      failed: false,
    })),
  )
  try {
    const page = await readPage(sessionId, subagentId, cursor)
    setOlderByChain((previous) =>
      updateOlderPages(previous, chainKey, (current) =>
        current === undefined
          ? current
          : {
              pages: [page, ...current.pages],
              cursor: page.olderCursor ?? null,
              loading: false,
              failed: false,
            },
      ),
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'expired-feed-cursor') {
      await refreshExpiredFeedCursor(chainKey, refreshLatest, setOlderByChain)
    } else {
      setOlderByChain((previous) =>
        updateOlderPages(previous, chainKey, (current) =>
          current === undefined ? current : { ...current, loading: false, failed: true },
        ),
      )
    }
  } finally {
    loadingKeys.delete(chainKey)
  }
}
