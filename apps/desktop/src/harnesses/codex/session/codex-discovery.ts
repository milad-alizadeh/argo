import { z } from 'zod'
import {
  type SessionIngestion,
  sessionIngestionSchema,
} from '@/domains/sessions/contract/session-index'
import type { CodexRequest } from '../app-server/codex-app-server-machine'

const codexThreadSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).nullable(),
  updatedAt: z.number().int().nonnegative(),
  cwd: z.string().min(1).optional(),
})
export const codexThreadPageSchema = z.object({
  data: z.array(z.unknown()),
  nextCursor: z.string().nullable(),
})

export type CodexDiscoveryResult = {
  sessions: SessionIngestion[]
  nextCursor: string | null
  invalidRecordCount: number
}

export function parseCodexSessionPage(
  page: z.infer<typeof codexThreadPageSchema>,
): CodexDiscoveryResult {
  let invalidRecordCount = 0
  const sessions = page.data.flatMap((record) => {
    const thread = codexThreadSchema.safeParse(record)
    if (!thread.success) {
      invalidRecordCount += 1
      return []
    }
    const parsed = sessionIngestionSchema.safeParse({
      harness: 'codex',
      nativeId: thread.data.id,
      vendorTitle: thread.data.name,
      firstPrompt: null,
      updatedAt: thread.data.updatedAt * 1_000,
      workingDirectory: thread.data.cwd ?? null,
    })
    if (!parsed.success) {
      invalidRecordCount += 1
      return []
    }
    return [parsed.data]
  })
  return { sessions, nextCursor: page.nextCursor, invalidRecordCount }
}

export async function readCodexSessionPage(
  request: CodexRequest,
  cursor: string | null,
  limit: number,
): Promise<z.infer<typeof codexThreadPageSchema>> {
  return request(
    'thread/list',
    {
      cursor,
      limit,
      sourceKinds: ['cli', 'vscode', 'appServer'],
      sortKey: 'updated_at',
      sortDirection: 'desc',
      useStateDbOnly: true,
    },
    (value) => codexThreadPageSchema.parse(value),
  )
}

export async function readCodexSessions(
  request: CodexRequest,
  cursor: string | null,
  limit: number,
): Promise<CodexDiscoveryResult> {
  return parseCodexSessionPage(await readCodexSessionPage(request, cursor, limit))
}
