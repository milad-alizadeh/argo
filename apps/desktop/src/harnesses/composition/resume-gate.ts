export function createResumeGate<Outcome>() {
  const pending = new Map<string, Promise<Outcome>>()
  return (sessionKey: string, resume: () => Promise<Outcome>): Promise<Outcome> => {
    const existing = pending.get(sessionKey)
    if (existing !== undefined) return existing
    const request = Promise.resolve()
      .then(resume)
      .finally(() => {
        if (pending.get(sessionKey) === request) pending.delete(sessionKey)
      })
    pending.set(sessionKey, request)
    return request
  }
}
