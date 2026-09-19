import { type SessionRosterRow, sessionRosterRowSchema } from '@/domains/sessions/contract/models'

// A malformed cache projection is never partial: the transcript pass will recreate it on the
// next bounded discovery, while this index read treats it as absent.
export function storedRosterRow(rowJson: string | null): SessionRosterRow | null {
  try {
    const parsed = sessionRosterRowSchema.safeParse(JSON.parse(rowJson ?? 'null'))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
