import { type SessionRosterRow, sessionRosterRowSchema } from '@/domains/sessions/contract/models'

// A malformed cache projection is never partial: the transcript pass will recreate it on the
// next bounded discovery, while this index read treats it as absent.
export function storedRosterRow(rowJson: string | null): SessionRosterRow | null {
  try {
    const raw = JSON.parse(rowJson ?? 'null') as unknown
    const stored =
      typeof raw === 'object' && raw !== null && 'cli' in raw
        ? (() => {
            const { cli, ...withoutCli } = raw
            return { ...withoutCli, harness: cli }
          })()
        : raw
    const parsed = sessionRosterRowSchema.safeParse(stored)
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
