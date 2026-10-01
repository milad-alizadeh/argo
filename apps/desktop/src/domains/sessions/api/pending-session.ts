// A new Session goes by this id from Enter until its Harness names it: the draft revision it sent.
const PENDING_SESSION = /^optimistic:(.+):(\d+)$/

export function pendingSessionId(draft: { id: string; revision: number }): string {
  return `optimistic:${draft.id}:${draft.revision}`
}

// The draft revision a pending Session id names; null for any other id.
export function pendingSessionDraft(
  sessionId: string,
): { draftId: string; revision: number } | null {
  const match = PENDING_SESSION.exec(sessionId)
  if (match?.[1] === undefined || match[2] === undefined) return null
  return { draftId: match[1], revision: Number(match[2]) }
}
