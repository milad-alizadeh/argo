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
// quiet chain is bounded. Past the bound the last read is kept and stamped as of BEFORE it: those
// stamps are older than the file, so the next poll's fresh `stableChain` call reads it as stale
// and reads again, rather than this one re-parsing a growing transcript until the heap is gone
// (#2095).
const SETTLING_READS = 4

export async function stableChain(
  source: { readSessionFiles: (sessionId: string) => Promise<SessionChain | null> },
  sessionId: string,
  startingPaths: readonly string[],
): Promise<{ chain: SessionChain; stamps: string } | null> {
  let paths = startingPaths
  let racing: { chain: SessionChain; stamps: string } | null = null
  for (let read = 0; read < SETTLING_READS; read += 1) {
    const before = await chainStamps(paths)
    const chain = await source.readSessionFiles(sessionId)
    if (chain === null) return null
    paths = chain.files.map((file) => file.path)
    const stamps = await chainStamps(paths)
    if (before === stamps) return { chain, stamps }
    racing = { chain, stamps: before }
  }
  return racing
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
