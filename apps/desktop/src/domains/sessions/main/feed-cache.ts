import { stat } from 'node:fs/promises'
import path from 'node:path'

import type { SessionChain } from '@/domains/sessions/contract/chains'
import type { SessionFeedRequest } from '@/domains/sessions/contract/contract'
import type { SessionFeedRow } from '@/domains/sessions/contract/models'

export type HeldFeed = {
  chainId: string
  paths: string[]
  rows: SessionFeedRow[]
  revision: string
  stamps: string
}

const KEPT_FEED_LIMIT = 1

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

export function appendedReply(
  value: SessionFeedRequest,
  held: HeldFeed,
  unchangedRowCount: number,
) {
  return {
    version: 1 as const,
    type: 'session.feed.appended' as const,
    requestId: value.requestId,
    sessionId: value.sessionId,
    chainId: held.chainId,
    revision: held.revision,
    unchangedRowCount,
    rows: held.rows.slice(unchangedRowCount),
  }
}

export function unchangedReply(value: SessionFeedRequest, held: HeldFeed) {
  return {
    version: 1 as const,
    type: 'session.feed.unchanged' as const,
    requestId: value.requestId,
    sessionId: value.sessionId,
    chainId: held.chainId,
    revision: held.revision,
  }
}

// A Session its CLI is still writing never gives two stat readings that agree, so the wait for a
// quiet chain is bounded. Past the bound the last read is kept and stamped as of before it: those
// stamps are older than the file, and cover the files the chain held before it, so the next
// poll's fresh `stableChain` call reads it as stale and reads again, rather than this one
// re-parsing a growing transcript until the heap is gone (#2095).
const SETTLING_READS = 4

export async function stableChain(
  source: { readSessionFiles: (sessionId: string) => Promise<SessionChain | null> },
  sessionId: string,
  options: { startingPaths: readonly string[]; signal?: AbortSignal },
): Promise<{ chain: SessionChain; stamps: string } | null> {
  const { startingPaths, signal } = options
  let paths = startingPaths
  let unsettledRead: { chain: SessionChain; stamps: string } | null = null
  for (let read = 0; read < SETTLING_READS; read += 1) {
    signal?.throwIfAborted()
    const before = await chainStamps(paths)
    signal?.throwIfAborted()
    const chain = await source.readSessionFiles(sessionId)
    if (chain === null) return null
    paths = chain.files.map((file) => file.path)
    const stamps = await chainStamps(paths)
    if (before === stamps) return { chain, stamps }
    unsettledRead = { chain, stamps: before }
  }
  return unsettledRead
}

export type FeedCaches = { feeds: Map<string, HeldFeed>; projections: Map<string, unknown> }

// Evicting from `projections` in lockstep keeps the two caches keyed the same: a document whose
// Feed fell out of the kept set carries no incremental state worth resuming from either.
export function keepFeed({ feeds, projections }: FeedCaches, key: string, feed: HeldFeed) {
  feeds.delete(key)
  feeds.set(key, feed)
  while (feeds.size > KEPT_FEED_LIMIT) {
    const oldest = feeds.keys().next().value
    if (oldest === undefined) return
    feeds.delete(oldest)
    projections.delete(oldest)
  }
}

export function disposeFeed({ feeds, projections }: FeedCaches, sessionId: string) {
  for (const key of feeds.keys()) {
    if (key === sessionId || key.startsWith(`${sessionId}#`)) {
      feeds.delete(key)
      projections.delete(key)
    }
  }
}
