import { expect, spyOn, test } from 'bun:test'
import { recordedThread, recordedThreadRequest } from '@/mocks/cli/codex/recorded-codex-threads'
import {
  recordedCodexExternalThreads as externalThreads,
  recordedCodexSubagents,
  recordedCodexSessionSync as recordedResponses,
} from '@/mocks/recordings/codex-app-server'
import {
  CODEX_SESSION_SOURCE_KINDS,
  type CodexRequest,
  CodexUnavailableError,
  type Thread,
  type ThreadListResponse,
} from '../app-server'
import {
  createCodexSessionSummaryList,
  createCodexSessionSummaryReader,
} from './codex-session-discovery'

const FIRST_ID = 'thread-first'
const KNOWN_ID = 'thread-known'
const SAVED_ID = 'thread-previously-saved'
const RECORDED_PROMPT = 'Run Codex check'
const RECORDED_ENVELOPE =
  '<task-notification><task-id>corpus-task</task-id><status>completed</status><summary>Task finished</summary></task-notification>'
type RecordedThread = Pick<Thread, 'id' | 'updatedAt' | 'name'> &
  Partial<Pick<Thread, 'parentThreadId' | 'preview' | 'cwd'>>
const recorded: {
  pages: (Pick<ThreadListResponse, 'nextCursor'> & { data: RecordedThread[] })[]
  read: { thread: RecordedThread }
} = recordedResponses

function requestFor(responses: Map<string, unknown>, calls: unknown[]): CodexRequest {
  return (async (method: string, params: unknown, parse: (value: unknown) => unknown) => {
    calls.push({ method, params })
    const key =
      method === 'thread/list'
        ? String((params as { cursor?: string }).cursor ?? '')
        : String((params as { threadId: string }).threadId)
    return parse(responses.get(`${method}:${key}`))
  }) as CodexRequest
}

function expectedCalls(): unknown[] {
  const listParams = {
    limit: 100,
    sortKey: 'updated_at',
    sourceKinds: [...CODEX_SESSION_SOURCE_KINDS],
    archived: false,
    useStateDbOnly: true,
  }
  return [
    { method: 'thread/list', params: listParams },
    {
      method: 'thread/list',
      params: { ...listParams, cursor: recorded.pages[0]?.nextCursor },
    },
    { method: 'thread/read', params: { threadId: SAVED_ID, includeTurns: false } },
  ]
}

function recordedRequest(calls: unknown[]) {
  const { pages, read: readResponse } = structuredClone(recorded)
  const [firstPage, secondPage] = pages
  if (firstPage === undefined || secondPage === undefined)
    throw new Error('Invalid recorded Codex fixture.')
  const firstRecord = firstPage.data[0]
  const duplicateRecord = secondPage.data[0]
  const knownRecord = secondPage.data[1]
  if (firstRecord === undefined || duplicateRecord === undefined || knownRecord === undefined)
    throw new Error('Invalid recorded Codex fixture.')
  firstRecord.id = FIRST_ID
  firstRecord.parentThreadId = null
  firstPage.data = [firstRecord]
  firstPage.data.push({ id: 'bad-record', updatedAt: Number.NaN, name: null })
  duplicateRecord.id = FIRST_ID
  duplicateRecord.parentThreadId = null
  duplicateRecord.name = null
  delete duplicateRecord.preview
  delete duplicateRecord.cwd
  knownRecord.id = KNOWN_ID
  knownRecord.parentThreadId = null
  secondPage.data = [duplicateRecord, knownRecord]
  secondPage.nextCursor = null
  readResponse.thread.id = SAVED_ID
  readResponse.thread.parentThreadId = null
  return {
    request: requestFor(
      new Map<string, unknown>([
        ['thread/list:', firstPage],
        [`thread/list:${firstPage.nextCursor}`, secondPage],
        [`thread/read:${SAVED_ID}`, readResponse],
      ]),
      calls,
    ),
    firstRecord,
    duplicateRecord,
    knownRecord,
    readThread: readResponse.thread,
  }
}

test('pages interactive Codex threads, deduplicates IDs, and reads known missing IDs', async () => {
  const calls: unknown[] = []
  const fixture = recordedRequest(calls)
  const result = await createCodexSessionSummaryList(fixture.request)({
    knownNativeIds: [KNOWN_ID, SAVED_ID],
    knownSubagentNativeIds: [],
  })
  expect(result).toEqual({
    records: [
      {
        nativeId: FIRST_ID,
        activityAt: fixture.duplicateRecord.updatedAt * 1000,
        customTitle: null,
        preview: fixture.firstRecord.preview,
        cwd: fixture.firstRecord.cwd,
      },
      {
        nativeId: KNOWN_ID,
        activityAt: fixture.knownRecord.updatedAt * 1000,
        customTitle: fixture.knownRecord.name,
        preview: fixture.knownRecord.preview,
        cwd: fixture.knownRecord.cwd,
      },
      {
        nativeId: SAVED_ID,
        activityAt: fixture.readThread.updatedAt * 1000,
        customTitle: fixture.readThread.name,
        preview: fixture.readThread.preview,
        cwd: fixture.readThread.cwd,
      },
    ],
    skipped: 1,
  })
  expect(calls).toEqual(expectedCalls())
})

test('lists a page that carries fields discovery does not read', async () => {
  const result = await createCodexSessionSummaryList((async (_method, _params, parse) =>
    parse({
      data: [{ id: FIRST_ID, updatedAt: 1, parentThreadId: null, laterVendorField: true }],
      nextCursor: null,
      backwardsCursor: null,
      laterVendorField: true,
    })) as CodexRequest)({ knownNativeIds: [], knownSubagentNativeIds: [] })
  expect(result).toEqual({ records: [{ nativeId: FIRST_ID, activityAt: 1000 }], skipped: 0 })
})

test('fails a Codex scan when the page envelope is malformed', async () => {
  await expect(
    createCodexSessionSummaryList((async (_method, _params, parse) =>
      parse({ data: [], nextCursor: 7 })) as CodexRequest)({
      knownNativeIds: [],
      knownSubagentNativeIds: [],
    }),
  ).rejects.toThrow()
})

test('lists no Sessions, rather than failing the scan, on a machine without Codex', async () => {
  const result = await createCodexSessionSummaryList((async () => {
    throw new CodexUnavailableError()
  }) as CodexRequest)({ knownNativeIds: ['previously-saved'], knownSubagentNativeIds: [] })
  expect(result).toEqual({ records: [], skipped: 0 })
})

test('propagates a failed read for a known Session so Session sync can retry', async () => {
  await expect(
    createCodexSessionSummaryList((async (method: string, _params, _parse) => {
      if (method === 'thread/list') return { data: [], nextCursor: null }
      throw new Error('app-server read failed')
    }) as CodexRequest)({ knownNativeIds: ['previously-saved'], knownSubagentNativeIds: [] }),
  ).rejects.toThrow('app-server read failed')
})

test('skips a previously saved thread that Codex has removed', async () => {
  const calls: unknown[] = []
  const result = await createCodexSessionSummaryList((async (method: string, _params, parse) => {
    calls.push(method)
    if (method === 'thread/list') return parse({ data: [], nextCursor: null })
    throw new Error('Thread not found')
  }) as CodexRequest)({ knownNativeIds: ['removed-thread'], knownSubagentNativeIds: [] })

  expect(result).toEqual({ records: [], skipped: 0 })
  expect(calls).toEqual(['thread/list', 'thread/read'])
})

test('gets one thread summary without listing, and null for a thread Codex does not know', async () => {
  const calls: unknown[] = []
  const getSummary = createCodexSessionSummaryReader((async (method: string, params, parse) => {
    calls.push(method)
    if ((params as { threadId: string }).threadId === 'missing') throw new Error('Thread not found')
    return parse({ thread: { id: 'new-thread', updatedAt: 4, parentThreadId: null, cwd: '/repo' } })
  }) as CodexRequest)

  expect(await getSummary('new-thread')).toEqual({
    nativeId: 'new-thread',
    activityAt: 4000,
    cwd: '/repo',
  })
  expect(await getSummary('missing')).toBeNull()
  expect(calls).toEqual(['thread/read', 'thread/read'])
})

test('summarizes the recorded Codex parent Thread', async () => {
  const { thread, threadList } = recordedCodexSubagents
  const result = await createCodexSessionSummaryList((async (_method, _params, parse) =>
    parse(structuredClone(threadList))) as CodexRequest)({
    knownNativeIds: [],
    knownSubagentNativeIds: [],
  })

  expect(result.records.map(({ nativeId }) => nativeId)).toEqual([thread.id])
})

test('reconciles a saved child from its recorded Thread parentThreadId', async () => {
  const { childThread } = recordedCodexSubagents
  const parentNativeId = childThread.parentThreadId
  if (parentNativeId === null) throw new Error('Recorded Codex child has no parent Thread.')
  const result = await createCodexSessionSummaryList((async (method: string, params, parse) => {
    if (method === 'thread/list') return parse({ data: [], nextCursor: null })
    expect((params as { threadId: string }).threadId).toBe(childThread.id)
    return parse({ thread: structuredClone(childThread) })
  }) as CodexRequest)({ knownNativeIds: [childThread.id], knownSubagentNativeIds: [] })

  expect(result).toEqual({
    records: [],
    skipped: 0,
    subagents: [{ nativeId: childThread.id, parentNativeId }],
  })
})

test('counts a thread whose preview or cwd breaks the generated Thread type', async () => {
  const result = await createCodexSessionSummaryList((async (_method, _params, parse) =>
    parse({
      data: [
        { id: 'null-preview', updatedAt: 1, parentThreadId: null, preview: null },
        { id: 'null-cwd', updatedAt: 1, parentThreadId: null, cwd: null },
      ],
      nextCursor: null,
    })) as CodexRequest)({ knownNativeIds: [], knownSubagentNativeIds: [] })
  expect(result).toEqual({ records: [], skipped: 2 })
})

test('reads the Model and Effort a thread records, and leaves out what it records as none', async () => {
  const result = await createCodexSessionSummaryList((async (_method, _params, parse) =>
    parse({
      data: [
        {
          id: 'configured',
          updatedAt: 1,
          parentThreadId: null,
          model: 'gpt-5.5',
          reasoningEffort: 'high',
        },
        {
          id: 'unconfigured',
          updatedAt: 1,
          parentThreadId: null,
          model: null,
          reasoningEffort: null,
        },
      ],
      nextCursor: null,
    })) as CodexRequest)({ knownNativeIds: [], knownSubagentNativeIds: [] })
  expect(result.records).toEqual([
    {
      nativeId: 'configured',
      activityAt: 1000,
      turnConfiguration: { model: 'gpt-5.5', effort: 'high', mode: null },
    },
    { nativeId: 'unconfigured', activityAt: 1000 },
  ])
})

// The error Codex 0.157.0 answers thread/read with for an id that is not a UUID.
const INVALID_THREAD_ID_MESSAGE =
  'invalid thread id: invalid character: expected an optional prefix of `urn:uuid:` followed by [0-9a-fA-F-], found `p` at 1'

test('skips a previously saved Session whose id Codex cannot parse, and syncs the rest', async () => {
  const result = await createCodexSessionSummaryList((async (method: string, params, parse) => {
    if (method === 'thread/list') return parse({ data: [], nextCursor: null })
    if ((params as { threadId: string }).threadId === 'proof-codex')
      throw new Error(INVALID_THREAD_ID_MESSAGE)
    return parse({ thread: { id: SAVED_ID, updatedAt: 2, parentThreadId: null } })
  }) as CodexRequest)({ knownNativeIds: ['proof-codex', SAVED_ID], knownSubagentNativeIds: [] })
  expect(result).toEqual({ records: [{ nativeId: SAVED_ID, activityAt: 2000 }], skipped: 0 })
})

test('gets null for a locked thread Codex has not stored yet, so discovery asks again', async () => {
  const getSummary = createCodexSessionSummaryReader((async () => {
    throw new Error(externalThreads.readNotLoaded.message)
  }) as CodexRequest)
  expect(await getSummary('01a0f5af-03d4-7891-87e5-bbbfd9058beb')).toBeNull()
})

// thread/list answers every subAgent thread with a null parentThreadId; thread/read fills it.
const { guardian, threadSpawn } = externalThreads.subagents

function subagentRequest(listed: unknown, read: unknown, calls: unknown[] = []): CodexRequest {
  return (async (method: string, params, parse) => {
    calls.push({ method, params })
    if (method === 'thread/list')
      return parse({ data: [structuredClone(listed)], nextCursor: null })
    return parse(structuredClone(read))
  }) as CodexRequest
}

const guardianUnderItsParent = {
  records: [],
  skipped: 0,
  subagents: [
    { nativeId: guardian.listed.id, parentNativeId: guardian.read.thread.parentThreadId },
  ],
}
const guardianListAndRead = [
  expect.objectContaining({ method: 'thread/list' }),
  { method: 'thread/read', params: { threadId: guardian.listed.id, includeTurns: false } },
]

test('keeps a listed guardian review thread out of the Sessions, under the parent its read names', async () => {
  const calls: unknown[] = []
  const result = await createCodexSessionSummaryList(
    subagentRequest(guardian.listed, guardian.read, calls),
  )({ knownNativeIds: [guardian.listed.id], knownSubagentNativeIds: [] })

  expect(result).toEqual(guardianUnderItsParent)
  expect(calls).toEqual(guardianListAndRead)
})

test('reads no parent for a listed guardian thread already stored under a parent', async () => {
  const calls: unknown[] = []
  const result = await createCodexSessionSummaryList(
    subagentRequest(guardian.listed, guardian.read, calls),
  )({ knownNativeIds: [guardian.listed.id], knownSubagentNativeIds: [guardian.listed.id] })

  expect(result).toEqual({ records: [], skipped: 0 })
  expect(calls).toEqual([expect.objectContaining({ method: 'thread/list' })])
})

test('keeps a listed spawned thread out of the Sessions, under the parent its source names', async () => {
  const calls: unknown[] = []
  const result = await createCodexSessionSummaryList(
    subagentRequest(threadSpawn.listed, null, calls),
  )({ knownNativeIds: [], knownSubagentNativeIds: [] })

  expect(result).toEqual({
    records: [],
    skipped: 0,
    subagents: [
      {
        nativeId: threadSpawn.listed.id,
        parentNativeId: threadSpawn.listed.source.subAgent.thread_spawn.parent_thread_id,
      },
    ],
  })
  expect(calls).toEqual([expect.objectContaining({ method: 'thread/list' })])
})

test('reports a Subagent thread that names no parent, lists it as no Session, and reads it again until a read names one (#3084)', async () => {
  const warn = spyOn(console, 'warn').mockImplementation(() => {})
  try {
    const parentless = {
      thread: { ...structuredClone(guardian.read.thread), parentThreadId: null },
    }
    const list = createCodexSessionSummaryList(subagentRequest(guardian.listed, parentless))
    const first = await list({ knownNativeIds: [], knownSubagentNativeIds: [] })
    expect(first).toEqual({
      records: [],
      skipped: 0,
      subagents: [{ nativeId: guardian.listed.id, parentNativeId: null }],
    })
    expect(warn).toHaveBeenCalledWith(
      'Kept 1 Codex subagent thread(s) that name no parent out of the Sessions.',
    )

    // Saved with no parent, it is not a known Subagent, so the next sync reads it again.
    const calls: unknown[] = []
    const second = await createCodexSessionSummaryList(
      subagentRequest(guardian.listed, guardian.read, calls),
    )({ knownNativeIds: [], knownSubagentNativeIds: [] })
    expect(second).toEqual(guardianUnderItsParent)
    expect(calls).toEqual(guardianListAndRead)
    expect(
      await createCodexSessionSummaryReader(subagentRequest(guardian.listed, parentless))(
        guardian.listed.id,
      ),
    ).toBeNull()
  } finally {
    warn.mockRestore()
  }
})

test('counts a listed Subagent thread whose parent read is unrecognised as unrecognised', async () => {
  const result = await createCodexSessionSummaryList(
    subagentRequest(guardian.listed, { thread: { id: guardian.listed.id } }),
  )({ knownNativeIds: [], knownSubagentNativeIds: [] })
  expect(result).toEqual({ records: [], skipped: 1 })
})

test('counts a thread with an unrecognised Subagent source as unrecognised', async () => {
  const listed = { ...structuredClone(guardian.listed), source: { subAgent: { future: {} } } }
  const result = await createCodexSessionSummaryList(subagentRequest(listed, null))({
    knownNativeIds: [],
    knownSubagentNativeIds: [],
  })
  expect(result).toEqual({ records: [], skipped: 1 })
})

test('keeps a thread with an unknown non-Subagent source as a Session, and reports it', async () => {
  const warn = spyOn(console, 'warn').mockImplementation(() => {})
  try {
    const [parent] = recordedCodexSubagents.threadList.data
    if (parent === undefined) throw new Error('The recorded Codex list has no thread.')
    const listed = { ...structuredClone(parent), source: 'futureSource' }
    const result = await createCodexSessionSummaryList(subagentRequest(listed, null))({
      knownNativeIds: [],
      knownSubagentNativeIds: [],
    })
    expect(result.records.map(({ nativeId }) => nativeId)).toEqual([parent.id])
    expect(result.skipped).toBe(0)
    expect(warn).toHaveBeenCalledWith(
      'Kept 1 Codex thread(s) with an unrecognised source as Sessions.',
    )
  } finally {
    warn.mockRestore()
  }
})

test('leaves out an empty preview, so the first prompt can name the row (#3077)', async () => {
  const result = await createCodexSessionSummaryList((async (_method, _params, parse) =>
    parse({
      data: [{ id: FIRST_ID, updatedAt: 1, parentThreadId: null, name: 'Named', preview: '' }],
      nextCursor: null,
    })) as CodexRequest)({ knownNativeIds: [], knownSubagentNativeIds: [] })
  expect(result.records).toEqual([{ nativeId: FIRST_ID, activityAt: 1000, customTitle: 'Named' }])
})

// The recorded thread, as Codex lists a thread it has neither named nor previewed.
function unnamedThread(preview: string) {
  return { ...recordedThread(preview), name: null, preview: '' }
}

test('reads the first prompt of a recorded thread with no name and no preview', async () => {
  const thread = unnamedThread(RECORDED_PROMPT)
  const getSummary = createCodexSessionSummaryReader(recordedThreadRequest(thread))
  expect(await getSummary(thread.id)).toMatchObject({ firstPrompt: RECORDED_PROMPT })
  expect(await getSummary(thread.id)).not.toHaveProperty('preview')

  const listed = await createCodexSessionSummaryList((async (method, params, parse) =>
    method === 'thread/list'
      ? parse({ data: [{ ...thread, turns: [] }], nextCursor: null })
      : recordedThreadRequest(thread)(method, params, parse)) as CodexRequest)({
    knownNativeIds: [],
    knownSubagentNativeIds: [],
  })
  expect(listed.records).toEqual([expect.objectContaining({ firstPrompt: RECORDED_PROMPT })])
})

test('skips an envelope Turn and takes the real prompt after it as the first prompt', async () => {
  const envelope = recordedThread(RECORDED_ENVELOPE)
  const prompted = recordedThread(RECORDED_PROMPT)
  const thread = {
    ...unnamedThread(RECORDED_PROMPT),
    turns: [...envelope.turns, ...prompted.turns],
  }
  const summary = await createCodexSessionSummaryReader(recordedThreadRequest(thread))(thread.id)
  expect(summary).toMatchObject({ firstPrompt: RECORDED_PROMPT })
})

test('lists a thread whose first prompt cannot be read, and the rest of the scan', async () => {
  const unnamed = unnamedThread(RECORDED_PROMPT)
  const warn = spyOn(console, 'warn').mockImplementation(() => {})
  try {
    const result = await createCodexSessionSummaryList((async (method, _params, parse) => {
      if (method === 'thread/list')
        return parse({
          data: [
            { ...unnamed, turns: [] },
            { id: KNOWN_ID, updatedAt: 1, parentThreadId: null, name: 'Named', preview: '' },
          ],
          nextCursor: null,
        })
      throw new Error('app-server timed out')
    }) as CodexRequest)({ knownNativeIds: [], knownSubagentNativeIds: [] })
    expect(result.records.map(({ nativeId }) => nativeId)).toEqual([unnamed.id, KNOWN_ID])
    expect(result.records[0]).not.toHaveProperty('firstPrompt')
    expect(warn).toHaveBeenCalledTimes(1)
  } finally {
    warn.mockRestore()
  }
})
