// Resolving ids a caller already holds — archived, or asked for by restore — straight against the
// Session index's persisted resume graph (#2374). No discovery window to grow: an id this CLI's
// index has never named for want of backfill (#2373) comes back unresolved rather than falling
// through to a directory scan.
//
// The bounded window's own read (`indexed-window.ts`) revalidates every file it returns against a
// fresh `stat` on every call, which is what keeps an *active* Session's row live while its CLI
// writes to it. Background reconcile does the same for the rest of the tree, but pauses while a
// Feed is open (`session-background-indexing.ts`) so it never races the file that Feed is reading.
// An id resolved here can name exactly that open Session, so this resolution stats the chains it
// is about to answer for and reindexes any whose identity moved, rather than serving whatever
// reconcile last wrote.
import { stat } from 'node:fs/promises'
import { rootOf } from '@/domains/sessions/contract/chains'
import type { SessionRosterRow } from '@/domains/sessions/contract/models'
import type {
  IndexedTranscriptFile,
  SessionIndex,
  TranscriptFileIdentity,
} from './session-index/contract'
import type { createIndexedWindow } from './session-index/indexed-window'
import { reindexCandidates } from './session-index/reindex-pass'
import { pathOfIndexed } from './session-index/window-pass'

export type ResolvedIndexedIds = { rows: SessionRosterRow[]; unresolvedIds: string[] }

async function freshIdentityOf(
  file: IndexedTranscriptFile,
): Promise<TranscriptFileIdentity | null> {
  const found = await stat(file.path).catch(() => null)
  if (found === null) return null
  return { ...pathOfIndexed(file), writtenAt: found.mtimeMs, size: found.size }
}

export async function resolveIndexedIds(
  bound: ReturnType<typeof createIndexedWindow>,
  index: SessionIndex,
  ids: readonly string[],
): Promise<ResolvedIndexedIds> {
  await bound.ensureHydrated()
  const { history, cli } = bound.pass.source
  const chainIds = new Set<string>()
  const unresolvedIds: string[] = []
  for (const id of ids) {
    if (history.knownIds.has(id)) chainIds.add(rootOf(id, history.parents))
    else unresolvedIds.push(id)
  }
  if (chainIds.size > 0) {
    const known = await index.filesOfChains(cli, [...chainIds])
    const identities = (await Promise.all(known.map(freshIdentityOf))).filter(
      (identity): identity is TranscriptFileIdentity => identity !== null,
    )
    await reindexCandidates(bound.pass, identities, identities)
  }
  const rows = chainIds.size === 0 ? [] : await index.rowsOfChains(cli, [...chainIds])
  return { rows, unresolvedIds }
}
