// The taming primitives every reader of a CLI transcript shares. A model wrote the file, so
// nothing is trusted to have the shape it should: a value is a record only when it is one, a
// string only when it is one, and anything else reads as absent rather than as a default.

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

export function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** Read one field off an untrusted value, absent unless it is a string. */
export function stringField(value: unknown, key: string): string | null {
  return isRecord(value) ? asString(value[key]) : null
}

/** The array-valued fields of a message body — content parts, plan entries. */
export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/** Parse one transcript line. A malformed line is skipped, never thrown. */
export function parseLine(line: string): Record<string, unknown> | null {
  if (line.trim() === '') return null
  try {
    const value: unknown = JSON.parse(line)
    return isRecord(value) ? value : null
  } catch {
    return null
  }
}

export function timestampMs(record: Record<string, unknown>): number | null {
  const raw = asString(record.timestamp)
  if (raw === null) return null
  const parsed = Date.parse(raw)
  return Number.isNaN(parsed) ? null : parsed
}
