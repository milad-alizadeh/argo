// One indexing pass over the bounded recent window: what it must parse, and what it writes back.
// Split from `indexed-window.ts` so the pass's arithmetic can be read without the index calls
// around it.
import type { SessionChain } from '@/domains/sessions/contract/chains'
import type { SessionRosterRow } from '@/domains/sessions/contract/models'
import type { TranscriptFile } from '@/domains/sessions/contract/transcript'
import type { IndexedSessionChain, IndexedTranscriptFile, TranscriptFileIdentity } from './contract'

// A transcript file with no Message record belongs to no Session yet (CONTEXT.md L2 · Transcript
// file). Its identity is still recorded, so the pass stops re-reading it until the CLI writes
// that first Message and its size changes.
export const NO_CHAIN = ''

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

// An indexed file addressed the way a parser wants it. `sessionIdOfFile` reads a file's name for
// its Session id alone, so the id the index holds spells the same name back, whatever shape the
// CLI's own basename has.
export function pathOfIndexed(file: IndexedTranscriptFile) {
  return { path: file.path, name: `${file.sessionId}.jsonl` }
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
    return { chainId: chain.id, updatedAt: row.updatedAt, row, originUnread: chain.originUnread }
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
