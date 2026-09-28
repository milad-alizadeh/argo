import type { FeedContent } from './feed-content'

export type SessionHistoryTarget = {
  nativeId: string
  subagentId: string | null
  cwd: string | null
}

export type SessionHistoryReader = (target: SessionHistoryTarget) => Promise<FeedContent[]>
