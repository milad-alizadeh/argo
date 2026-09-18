// One in-flight read per Session, tracked so a switch away from it (#2102) can abort the settle
// loop instead of letting it run to its bound with nothing left to draw the answer.
export function createFeedReads() {
  const reads = new Map<string, AbortController>()
  return {
    // A later read for the same Session (a fresh poll, a retry) supersedes an earlier one.
    start(sessionId: string): AbortController {
      reads.get(sessionId)?.abort()
      const controller = new AbortController()
      reads.set(sessionId, controller)
      return controller
    },
    finish(sessionId: string, controller: AbortController) {
      if (reads.get(sessionId) === controller) reads.delete(sessionId)
    },
    cancel(sessionId: string) {
      reads.get(sessionId)?.abort()
    },
    // A selected Feed still in flight, so background indexing (#2373) can pause rather than race a
    // read for the files it is reindexing.
    isActive: () => reads.size > 0,
  }
}

export function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError'
}
