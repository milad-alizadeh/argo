const KEPT_SESSIONS_KEY = 'argo.keptSessions'
const DEFAULT_KEPT_SESSIONS = 6

// ADR-0033 rule 4 keeps this unexposed setting with the browser profile. An invalid hand-edited
// value falls back to the default rather than letting one malformed preference discard every deck.
export function readKeptSessionLimit(storage: Storage): number {
  const value = Number.parseInt(storage.getItem(KEPT_SESSIONS_KEY) ?? '', 10)
  if (Number.isSafeInteger(value) && value > 0) return value
  storage.setItem(KEPT_SESSIONS_KEY, `${DEFAULT_KEPT_SESSIONS}`)
  return DEFAULT_KEPT_SESSIONS
}
