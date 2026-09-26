import { fromPromise } from 'xstate'
import { z } from 'zod'
import type { SyncResult } from '@/domains/sessions/main/sync/session-sync-machine'
import type { CodexWorkerReadRequest } from './session-sync-codex-bridge'

const threadSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().nullable().optional(),
    preview: z.string().nullable().optional(),
    cwd: z.string().nullable().optional(),
    updatedAt: z.number().int().nonnegative(),
  })
  .passthrough()

const pageSchema = z.strictObject({
  data: z.array(z.unknown()),
  nextCursor: z.string().nullable(),
  backwardsCursor: z.string().nullable().optional(),
})
const readSchema = z.strictObject({ thread: z.unknown() })
type CodexSessionRecord = SyncResult['records'][number]

function rememberRecord(records: Map<string, CodexSessionRecord>, record: CodexSessionRecord) {
  records.set(record.nativeId, { ...records.get(record.nativeId), ...record })
}

function parseThread(raw: unknown): CodexSessionRecord | null {
  const parsed = threadSchema.safeParse(raw)
  if (!parsed.success) return null
  const thread = parsed.data
  return {
    nativeId: thread.id,
    activityAt: thread.updatedAt * 1000,
    ...(thread.name === undefined ? {} : { customTitle: thread.name }),
    ...(thread.preview === undefined ? {} : { preview: thread.preview }),
    ...(thread.cwd === undefined ? {} : { cwd: thread.cwd }),
  }
}

async function readListedCodexSessions(
  request: CodexWorkerReadRequest,
  reportMalformed: () => void,
): Promise<Map<string, CodexSessionRecord>> {
  const records = new Map<string, CodexSessionRecord>()
  let cursor: string | undefined
  do {
    const result = await request(
      'thread/list',
      {
        ...(cursor === undefined ? {} : { cursor }),
        limit: 100,
        sortKey: 'updated_at',
        sourceKinds: ['cli', 'vscode', 'appServer'],
        archived: false,
      },
      (value) => pageSchema.parse(value),
    )
    for (const raw of result.data) {
      const record = parseThread(raw)
      if (record === null) reportMalformed()
      else rememberRecord(records, record)
    }
    cursor = result.nextCursor ?? undefined
  } while (cursor !== undefined)
  return records
}

async function readKnownCodexSessions(input: {
  request: CodexWorkerReadRequest
  knownNativeIds: readonly string[]
  records: Map<string, CodexSessionRecord>
  reportMalformed: () => void
}): Promise<void> {
  for (const nativeId of input.knownNativeIds) {
    if (input.records.has(nativeId)) continue
    const result = await input.request(
      'thread/read',
      { threadId: nativeId, includeTurns: false },
      (value) => readSchema.parse(value),
    )
    const record = parseThread(result.thread)
    if (record === null) input.reportMalformed()
    else rememberRecord(input.records, record)
  }
}

export async function readCodexSessions(input: {
  request: CodexWorkerReadRequest
  knownNativeIds: readonly string[]
  reportMalformed: () => void
}): Promise<CodexSessionRecord[]> {
  const records = await readListedCodexSessions(input.request, input.reportMalformed)
  await readKnownCodexSessions({ ...input, records })
  return [...records.values()]
}

export function createCodexSessionSyncActor(request: CodexWorkerReadRequest) {
  return fromPromise<SyncResult, { knownNativeIds: string[] }>(async ({ input }) => {
    let skipped = 0
    const records = await readCodexSessions({
      request,
      knownNativeIds: input.knownNativeIds,
      reportMalformed: () => {
        skipped += 1
      },
    })
    return { records, skipped }
  })
}
