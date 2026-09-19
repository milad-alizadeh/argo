import { sessionSearchReplySchema } from '@/domains/sessions/contract/contract'
import type { RosterStatus } from '@/domains/sessions/contract/search-contract'
import type { createSessionReader } from '@/domains/sessions/main/reader'

// The one `session.search` request shape both the Bun and Node search suites build, shared so a
// test-runner split (#2372) does not also duplicate the request itself.
export async function requestSearch(
  reader: ReturnType<typeof createSessionReader>,
  query: string,
  options: {
    status?: RosterStatus
    projectRoot?: string | null
    cursor?: string | null
    requestId?: string
  } = {},
) {
  return sessionSearchReplySchema.parse(
    await reader.search({
      version: 1,
      type: 'session.search',
      requestId: options.requestId ?? 'search-1',
      projectRoot: options.projectRoot ?? null,
      status: options.status ?? 'active',
      query,
      cursor: options.cursor ?? null,
    }),
  )
}
