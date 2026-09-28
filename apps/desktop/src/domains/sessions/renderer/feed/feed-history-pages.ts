import type { Dispatch, SetStateAction } from 'react'
import type { SessionFeedPage, SessionId } from '../types'

type OlderPages = {
  pages: SessionFeedPage[]
  cursor: string | null
  loading: boolean
  failed: boolean
}

export type OlderPagesByChain = Record<string, OlderPages>

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
  return { ...previous, [chainKey]: next }
}

async function refreshExpiredFeedCursor(
  chainKey: string,
  refreshLatest: () => Promise<SessionFeedPage | null>,
  setOlderByChain: Dispatch<SetStateAction<OlderPagesByChain>>,
) {
  try {
    const refreshed = await refreshLatest()
    setOlderByChain((previous) =>
      updateOlderPages(previous, chainKey, (current) =>
        current === undefined
          ? current
          : {
              ...current,
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
