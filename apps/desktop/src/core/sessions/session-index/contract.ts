// What the Session index answers, and what one indexing pass writes back. Shared Session code and
// the CLI adapters speak only this; the SQL that serves it lives behind one worker (#2372).
import type { SessionRosterRow } from '../models'

// A transcript file addressed for parsing: where it is, and the name its Session id is read off.
export type TranscriptPath = { path: string; name: string }

// A transcript file as the index knows it: the identity that says whether it changed, and the
// Session and chain it belongs to.
export type IndexedTranscriptFile = {
  path: string
  sessionId: string
  writtenAt: number
  size: number
  chainId: string
}

// What a file on disk looks like before anything opens it: enumeration plus one `stat`.
export type TranscriptFileIdentity = TranscriptPath & { writtenAt: number; size: number }

// One indexed Session: the chain's id, the timestamp the Roster orders by, and the validated
// Roster projection its transcripts produced.
export type IndexedSessionChain = {
  chainId: string
  updatedAt: string | null
  row: SessionRosterRow
  // The chain stands under a retired id because its origin was not in the set stitched. Recorded
  // because the origin can arrive later, and only a re-stitch that reads both joins them.
  originUnread: boolean
}

// One indexing pass, applied in a single transaction. `chains` replaces every file and link of
// the chains it names, so a re-stitch that moved a file between chains leaves nothing behind.
export type SessionIndexWrite = {
  files: IndexedTranscriptFile[]
  chains: IndexedSessionChain[]
  links: { sessionId: string; parentSessionId: string | null }[]
  // Paths the pass found gone from disk.
  removedPaths: string[]
  // Chains the re-stitch dissolved, because every file they held joined another chain.
  retiredChainIds: string[]
}

// How far background backfill has walked into a CLI's older history: the newest file it has not
// yet reached, in the same newest-first order the recent window reads (written time, then path to
// break a tie). `null` means backfill has not started. `complete` once no file on disk is older
// than the boundary (#2373).
export type BackfillProgress = {
  boundary: { writtenAt: number; path: string } | null
  complete: boolean
}

// The asynchronous port shared Session code reads the index through. One CLI's rows are addressed
// by `cli` throughout, so shared code stays free of CLI branches (ADR-0024).
export type SessionIndex = {
  filesAt: (cli: string, paths: readonly string[]) => Promise<IndexedTranscriptFile[]>
  filesOfChains: (cli: string, chainIds: readonly string[]) => Promise<IndexedTranscriptFile[]>
  rowsOfChains: (cli: string, chainIds: readonly string[]) => Promise<SessionRosterRow[]>
  // Every chain a title, current id, or retired id matches, newest first (#2375).
  searchChains: (cli: string, query: string) => Promise<SessionRosterRow[]>
  chainLinks: (cli: string) => Promise<{ sessionId: string; parentSessionId: string | null }[]>
  // Every chain standing under a retired id for want of its origin.
  strandedChains: (cli: string) => Promise<string[]>
  write: (cli: string, pass: SessionIndexWrite) => Promise<void>
  backfillProgress: (cli: string) => Promise<BackfillProgress>
  setBackfillProgress: (cli: string, progress: BackfillProgress) => Promise<void>
  close: () => Promise<void>
}
