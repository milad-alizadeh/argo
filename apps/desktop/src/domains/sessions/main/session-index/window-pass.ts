// One indexing pass over the bounded recent window: what it must parse, and what it writes back.
// Split from `indexed-window.ts` so the pass's arithmetic can be read without the index calls
// around it.
import type { SessionChain } from '@/domains/sessions/contract/chains'
import type { SessionRosterRow } from '@/domains/sessions/contract/models'
import type { TranscriptFile } from '@/domains/sessions/contract/transcript'
import { projectFeed } from '@/domains/sessions/main/feed-incremental'
import {
  type IndexedSessionChain,
  type IndexedTranscriptFile,
  NO_CHAIN,
  type TranscriptFileIdentity,
} from '@/domains/sessions/main/session-index/contract'

export type FileIdentities = ReadonlyMap<string, { writtenAt: number; size: number }>

export function holdsMessage(file: TranscriptFile): boolean {
  return file.records.some((record) => record.kind === 'message')
}

export function isUnchanged(
  held: IndexedTranscriptFile | undefined,
  found: TranscriptFileIdentity,
): boolean {
  return held !== undefined && held.writtenAt === found.writtenAt && held.size === found.size
}

// An indexed file addressed the way a parser wants it. The adapter supplied its Session id when
// it discovered the file, so shared code needs no knowledge of the CLI's file name shape.
export function pathOfIndexed(file: IndexedTranscriptFile) {
  return { path: file.path, sessionId: file.sessionId }
}

export function chainIdByPath(chains: readonly SessionChain[]): Map<string, string> {
  const owners = new Map<string, string>()
  for (const chain of chains) for (const file of chain.files) owners.set(file.path, chain.id)
  return owners
}

export function identitiesOf(listing: readonly TranscriptFileIdentity[]): FileIdentities {
  return new Map(listing.map((file) => [file.path, { writtenAt: file.writtenAt, size: file.size }]))
}

export function indexedFiles(
  parsed: readonly TranscriptFile[],
  identities: FileIdentities,
  owners: ReadonlyMap<string, string>,
): IndexedTranscriptFile[] {
  return parsed.flatMap((file) => {
    const identity = identities.get(file.path)
    if (identity === undefined) return []
    return [
      {
        path: file.path,
        sessionId: file.sessionId,
        writtenAt: identity.writtenAt,
        size: identity.size,
        chainId: owners.get(file.path) ?? NO_CHAIN,
      },
    ]
  })
}

export function indexedChains(
  chains: readonly SessionChain[],
  project: (chain: SessionChain) => SessionRosterRow,
): IndexedSessionChain[] {
  return chains.map((chain) => {
    const row = project(chain)
    const searchText = projectFeed(chain, undefined)
      .rows.flatMap((feedRow) => {
        switch (feedRow.shape) {
          case 'prose':
          case 'thought':
          case 'command-output':
            return [feedRow.text]
          case 'event':
            return feedRow.text === null ? [] : [feedRow.text]
          default:
            return []
        }
      })
      .join('\n')
    return {
      chainId: chain.id,
      updatedAt: row.updatedAt,
      row,
      originUnread: chain.originUnread,
      searchText,
    }
  })
}

// Every chain the window's files belong to, freshly stitched ones included, with the files that
// joined no Session left out.
export function chainsInWindow(
  window: readonly TranscriptFileIdentity[],
  held: ReadonlyMap<string, IndexedTranscriptFile>,
  owners: ReadonlyMap<string, string>,
): string[] {
  const ids = window.map((file) => owners.get(file.path) ?? held.get(file.path)?.chainId)
  return [...new Set(ids.filter((id): id is string => id !== undefined && id !== NO_CHAIN))]
}
