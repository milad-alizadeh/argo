import { type SessionRosterRow, sessionRosterRowSchema } from '@/domains/sessions/contract/model'

// A malformed cache projection is never partial: the transcript pass will recreate it on the
// next bounded discovery, while this index read treats it as absent.
export function storedRosterRow(rowJson: string | null): SessionRosterRow | null {
  try {
    const value = JSON.parse(rowJson ?? 'null')
    const migrated =
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      'cli' in value &&
      !('harness' in value)
        ? (() => {
            const { cli, ...row } = value as { cli: unknown }
            return { ...row, harness: cli }
          })()
        : value
    const parsed = sessionRosterRowSchema.safeParse(migrated)
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
