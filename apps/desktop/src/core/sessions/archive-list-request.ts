import { sessionArchiveListReplySchema } from './contract'
import type { createSessionReader } from './reader'

// The one `session.archive.list` request shape both the Bun and Node archive suites build,
// shared so a test-runner split (#2372) does not also duplicate the request itself.
export async function requestArchiveList(
  reader: ReturnType<typeof createSessionReader>,
  options: { cursor?: string | null; restoreId?: string | null; requestId?: string } = {},
) {
  return sessionArchiveListReplySchema.parse(
    await reader.archiveList({
      version: 1,
      type: 'session.archive.list',
      requestId: options.requestId ?? 'archive-list-1',
      cursor: options.cursor ?? null,
      restoreId: options.restoreId ?? null,
    }),
  )
}
