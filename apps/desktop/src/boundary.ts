// The predicates every contract in this app parses its outside data with. They live here rather
// than in one domain's contract because two now share them, and a copy would be a second place
// for "what counts as an identifier" to drift.

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

export function hasKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
}
