import { z } from 'zod'
import { sessionRosterRowSchema } from '@/domains/sessions/contract/model/models'
import type { UnifiedRosterCursor } from './unified-roster-page'

const sourceCursorSchema = z.strictObject({
  buffer: z.array(sessionRosterRowSchema),
  cursor: z.string().nullable(),
  known: z.array(z.string()),
})

const unifiedRosterCursorSchema = z.strictObject({
  sources: z.record(z.string(), sourceCursorSchema),
})

export type UnifiedRosterCursorState = z.infer<typeof unifiedRosterCursorSchema>

export function decodeUnifiedRosterCursor(cursor: string | null | undefined) {
  if (cursor === null || cursor === undefined) return { sources: {} }
  try {
    const parsed = unifiedRosterCursorSchema.safeParse(JSON.parse(cursor))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export function encodeUnifiedRosterCursor(cursor: UnifiedRosterCursorState): string | null {
  const exhausted = Object.values(cursor.sources).every(
    (source) => source.cursor === null && source.buffer.length === 0,
  )
  return exhausted ? null : JSON.stringify(cursor)
}

export function cursorWithKnown(
  cursor: UnifiedRosterCursor,
  known: Record<string, string[]>,
): UnifiedRosterCursorState {
  return {
    sources: Object.fromEntries(
      Object.entries(cursor.sources).map(([harness, source]) => [
        harness,
        { ...source, known: known[harness] ?? [] },
      ]),
    ),
  }
}
