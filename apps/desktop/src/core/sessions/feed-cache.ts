import { stat } from 'node:fs/promises'
import path from 'node:path'

import type { SessionChain } from './chains'
import type { SessionFeedRequest } from './contract'
import type { SessionFeedRow } from './models'

export type HeldFeed = {
  chainId: string
  paths: string[]
  rows: SessionFeedRow[]
  revision: string
  stamps: string
}

const KEPT_FEED_LIMIT = 6

async function chainStamps(paths: readonly string[]): Promise<string> {
  const watched = [...new Set(paths.flatMap((file) => [file, path.dirname(file)]))]
  const stamps = await Promise.all(
    watched.map(async (file) => {
      const info = await stat(file)
      return `${file}:${info.mtimeMs}:${info.size}`
    }),
  )
  return stamps.sort().join('|')
}

export function feedReply(value: SessionFeedRequest, held: HeldFeed) {
  return {
    version: 1 as const,
    type: 'session.feed.read' as const,
    requestId: value.requestId,
    sessionId: value.sessionId,
    chainId: held.chainId,
    revision: held.revision,
    rows: held.rows,
  }
}

export async function cachedReply(value: SessionFeedRequest, held: HeldFeed | undefined) {
  if (held === undefined || (await chainStamps(held.paths)) !== held.stamps) return null
  if (value.revision !== held.revision) return feedReply(value, held)
  return {
    version: 1 as const,
    type: 'session.feed.unchanged' as const,
    requestId: value.requestId,
    sessionId: value.sessionId,
    chainId: held.chainId,
    revision: held.revision,
  }
}

export async function stableChain(
  source: { readSessionFiles: (sessionId: string) => Promise<SessionChain | null> },
  sessionId: string,
  startingPaths: readonly string[],
): Promise<{ chain: SessionChain; stamps: string } | null> {
  let paths = startingPaths
  let before = await chainStamps(paths)
  for (;;) {
    const chain = await source.readSessionFiles(sessionId)
    if (chain === null) return null
    const nextPaths = chain.files.map((file) => file.path)
    const stamps = await chainStamps(nextPaths)
    if (before === stamps) return { chain, stamps }
    paths = nextPaths
    before = stamps
  }
}

export function keepFeed(feeds: Map<string, HeldFeed>, sessionId: string, feed: HeldFeed) {
  feeds.delete(sessionId)
  feeds.set(sessionId, feed)
  while (feeds.size > KEPT_FEED_LIMIT) {
    const oldest = feeds.keys().next().value
    if (oldest === undefined) return
    feeds.delete(oldest)
  }
}
