import { expect, test } from 'bun:test'
import externalThreads from '../../../../mocks/cli/codex/fixtures/external-threads-codex-0.157.0.json' with {
  type: 'json',
}
import recordedResponses from '../../../../mocks/cli/codex/fixtures/session-sync-codex-0.157.0.json' with {
  type: 'json',
}
import {
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
// The recording keeps only the Thread fields discovery reads.
type RecordedThread = Pick<Thread, 'id' | 'updatedAt' | 'name'> &
  Partial<Pick<Thread, 'preview' | 'cwd'>>
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
  const sources = ['cli', 'vscode', 'appServer']
  const listParams = {
    limit: 100,
    sortKey: 'updated_at',
    sourceKinds: sources,
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
  firstPage.data = [firstRecord]
  firstPage.data.push({ id: 'bad-record', updatedAt: Number.NaN, name: null })
  duplicateRecord.id = FIRST_ID
  duplicateRecord.name = null
  delete duplicateRecord.preview
  delete duplicateRecord.cwd
  knownRecord.id = KNOWN_ID
  secondPage.data = [duplicateRecord, knownRecord]
  secondPage.nextCursor = null
  readResponse.thread.id = SAVED_ID
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
      data: [{ id: FIRST_ID, updatedAt: 1, laterVendorField: true }],
      nextCursor: null,
      backwardsCursor: null,
      laterVendorField: true,
    })) as CodexRequest)({ knownNativeIds: [] })
  expect(result).toEqual({ records: [{ nativeId: FIRST_ID, activityAt: 1000 }], skipped: 0 })
})

test('fails a Codex scan when the page envelope is malformed', async () => {
  await expect(
    createCodexSessionSummaryList((async (_method, _params, parse) =>
      parse({ data: [], nextCursor: 7 })) as CodexRequest)({ knownNativeIds: [] }),
  ).rejects.toThrow()
})

test('lists no Sessions, rather than failing the scan, on a machine without Codex', async () => {
  const result = await createCodexSessionSummaryList((async () => {
    throw new CodexUnavailableError()
  }) as CodexRequest)({ knownNativeIds: ['previously-saved'] })
  expect(result).toEqual({ records: [], skipped: 0 })
})

test('propagates a failed read for a known Session so Session sync can retry', async () => {
  await expect(
    createCodexSessionSummaryList((async (method: string, _params, _parse) => {
      if (method === 'thread/list') return { data: [], nextCursor: null }
      throw new Error('app-server read failed')
    }) as CodexRequest)({ knownNativeIds: ['previously-saved'] }),
  ).rejects.toThrow('app-server read failed')
})

test('skips a previously saved thread that Codex has removed', async () => {
  const calls: unknown[] = []
  const result = await createCodexSessionSummaryList((async (method: string, _params, parse) => {
    calls.push(method)
    if (method === 'thread/list') return parse({ data: [], nextCursor: null })
    throw new Error('Thread not found')
  }) as CodexRequest)({ knownNativeIds: ['removed-thread'] })

  expect(result).toEqual({ records: [], skipped: 0 })
  expect(calls).toEqual(['thread/list', 'thread/read'])
})

test('gets one thread summary without listing, and null for a thread Codex does not know', async () => {
  const calls: unknown[] = []
  const getSummary = createCodexSessionSummaryReader((async (method: string, params, parse) => {
    calls.push(method)
    if ((params as { threadId: string }).threadId === 'missing') throw new Error('Thread not found')
    return parse({ thread: { id: 'new-thread', updatedAt: 4, cwd: '/repo' } })
  }) as CodexRequest)

  expect(await getSummary('new-thread')).toEqual({
    nativeId: 'new-thread',
    activityAt: 4000,
    cwd: '/repo',
  })
  expect(await getSummary('missing')).toBeNull()
  expect(calls).toEqual(['thread/read', 'thread/read'])
})

test('counts a thread whose preview or cwd breaks the generated Thread type', async () => {
  const result = await createCodexSessionSummaryList((async (_method, _params, parse) =>
    parse({
      data: [
        { id: 'null-preview', updatedAt: 1, preview: null },
        { id: 'null-cwd', updatedAt: 1, cwd: null },
      ],
      nextCursor: null,
    })) as CodexRequest)({ knownNativeIds: [] })
  expect(result).toEqual({ records: [], skipped: 2 })
})

// The error Codex 0.157.0 answers thread/read with for an id that is not a UUID.
const INVALID_THREAD_ID_MESSAGE =
  'invalid thread id: invalid character: expected an optional prefix of `urn:uuid:` followed by [0-9a-fA-F-], found `p` at 1'

test('skips a previously saved Session whose id Codex cannot parse, and syncs the rest', async () => {
  const result = await createCodexSessionSummaryList((async (method: string, params, parse) => {
    if (method === 'thread/list') return parse({ data: [], nextCursor: null })
    if ((params as { threadId: string }).threadId === 'proof-codex')
      throw new Error(INVALID_THREAD_ID_MESSAGE)
    return parse({ thread: { id: SAVED_ID, updatedAt: 2 } })
  }) as CodexRequest)({ knownNativeIds: ['proof-codex', SAVED_ID] })
  expect(result).toEqual({ records: [{ nativeId: SAVED_ID, activityAt: 2000 }], skipped: 0 })
})

test('gets null for a locked thread Codex has not stored yet, so discovery asks again', async () => {
  const getSummary = createCodexSessionSummaryReader((async () => {
    throw new Error(externalThreads.readNotLoaded.message)
  }) as CodexRequest)
  expect(await getSummary('01a0f5af-03d4-7891-87e5-bbbfd9058beb')).toBeNull()
})
