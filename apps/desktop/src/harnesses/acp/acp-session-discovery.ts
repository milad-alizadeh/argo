import path from 'node:path'
import { z } from 'zod'
import type {
  SessionSummary,
  SessionSummaryListResult,
} from '@/domains/sessions/api/session-discovery'
import { type AcpAgentCommand, connectAcpAgent } from './acp-client'

const summarySchema = z.object({
  sessionId: z.string().min(1),
  cwd: z.string().refine(path.isAbsolute),
  title: z.string().nullish(),
  updatedAt: z.iso.datetime({ offset: true }).nullish(),
})

function summaryOf(value: unknown): SessionSummary | null {
  const parsed = summarySchema.safeParse(value)
  if (!parsed.success) return null
  const session = parsed.data
  return {
    nativeId: session.sessionId,
    cwd: session.cwd,
    ...(session.title === undefined ? {} : { preview: session.title }),
    ...(session.updatedAt === undefined
      ? {}
      : {
          activityAt: session.updatedAt === null ? null : Date.parse(session.updatedAt),
        }),
  }
}

function collectSummaries(
  values: readonly unknown[],
  known: ReadonlySet<string>,
  records: Map<string, SessionSummary>,
): number {
  let skipped = 0
  for (const value of values) {
    const summary = summaryOf(value)
    if (summary === null) skipped += 1
    else if (known.has(summary.nativeId)) records.set(summary.nativeId, summary)
  }
  return skipped
}

export async function listAcpSessions(
  command: AcpAgentCommand | null,
  knownNativeIds: readonly string[],
): Promise<SessionSummaryListResult> {
  if (command === null || knownNativeIds.length === 0) return { records: [], skipped: 0 }
  const known = new Set(knownNativeIds)
  const client = await connectAcpAgent(command, {
    update: () => {},
    requestPermission: async () => ({ outcome: { outcome: 'cancelled' } }),
  })
  try {
    if (!client.capabilities.listSessions) return { records: [], skipped: 0 }
    const records = new Map<string, SessionSummary>()
    const cursors = new Set<string>()
    let cursor: string | undefined
    let skipped = 0
    do {
      const page = await client.listSessions(cursor)
      skipped += collectSummaries(page.sessions, known, records)
      cursor = page.nextCursor ?? undefined
      if (cursor !== undefined) {
        if (cursors.has(cursor)) throw new Error('The ACP Session list repeated a cursor.')
        cursors.add(cursor)
      }
    } while (cursor !== undefined)
    return { records: [...records.values()], skipped }
  } finally {
    client.close()
  }
}
