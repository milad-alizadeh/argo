// The predicates every boundary in this app parses outside data with, the IPC schemas included
// (src/core/contract/messages.ts), so "what counts as an identifier" has one place to drift.

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isIdentifier(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 256 &&
    !/[\s\p{Cc}]/u.test(value)
  )
}

export function requestIdentifier(value: unknown): string | null {
  return isRecord(value) && isIdentifier(value.requestId) ? value.requestId : null
}
