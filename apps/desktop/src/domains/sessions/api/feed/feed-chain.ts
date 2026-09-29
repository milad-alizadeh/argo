// One Feed a reader serves: a Session's own, or one Subagent's inside it.
export type FeedChain = { sessionId: string; subagentId: string | null }

export function feedChainKey({ sessionId, subagentId }: FeedChain): string {
  return `${sessionId}\u0000${subagentId ?? ''}`
}
