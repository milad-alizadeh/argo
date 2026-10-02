import type { FeedContent } from './feed-content'

export type SessionHistoryTarget = {
  nativeId: string
  subagentId: string | null
  cwd: string | null
}

// The newest part of a Session's history. `complete` says nothing older remains to read.
export type SessionHistoryTail = { content: FeedContent[]; complete: boolean }

// How far back a history read reaches: 0 is the Harness's smallest tail, and each step widens it
// until the read is complete.
export type SessionHistoryRead = (
  target: SessionHistoryTarget,
  extent: number,
) => Promise<SessionHistoryTail>

// Past every step a whole history needs: Claude's 32nd step is 5^32 MiB, Codex's 4^32 pages. A read
// that never completes is a Harness bug, not a long read.
export const MAX_HISTORY_EXTENT = 32

export async function readWholeHistory(
  read: (extent: number) => Promise<SessionHistoryTail>,
): Promise<FeedContent[]> {
  for (let extent = 0; extent < MAX_HISTORY_EXTENT; extent += 1) {
    const tail = await read(extent)
    if (tail.complete) return tail.content
  }
  throw new Error(`A Session history read past ${MAX_HISTORY_EXTENT} steps never completed.`)
}
