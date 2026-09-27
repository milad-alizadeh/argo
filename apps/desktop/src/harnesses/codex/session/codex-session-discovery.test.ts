import { expect, test } from 'bun:test'
import { z } from 'zod'
import recordedResponses from '../../../../mocks/cli/codex/fixtures/session-sync-codex-0.157.0.json' with {
  type: 'json',
}
import type { CodexRequest } from '../app-server/codex-app-server-client'
import { createCodexSessionDiscovery, readCodexSessions } from './codex-session-discovery'

const FIRST_ID = 'thread-first'
const KNOWN_ID = 'thread-known'
const SAVED_ID = 'thread-previously-saved'
const recordedPageSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      updatedAt: z.number(),
      name: z.string().nullable().optional(),
      preview: z.string().nullable().optional(),
      cwd: z.string().nullable().optional(),
    }),
  ),
  nextCursor: z.string().nullable(),
})
const recordedReadSchema = z.object({
  thread: recordedPageSchema.shape.data.element,
})

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
      params: { ...listParams, cursor: recordedResponses.pages[0]?.nextCursor },
    },
    { method: 'thread/read', params: { threadId: SAVED_ID, includeTurns: false } },
  ]
}

function recordedRequest(calls: unknown[]) {
  const firstPage = recordedPageSchema.parse(recordedResponses.pages[0])
  const secondPage = recordedPageSchema.parse(recordedResponses.pages[1])
  const firstRecord = firstPage.data[0]
  const duplicateRecord = secondPage.data[0]
  const knownRecord = secondPage.data[1]
  if (firstRecord === undefined || duplicateRecord === undefined || knownRecord === undefined)
    throw new Error('Invalid recorded Codex fixture.')
  firstRecord.id = FIRST_ID
  firstPage.data = [firstRecord]
  firstPage.data.push({ id: 'bad-record', updatedAt: Number.NaN })
  duplicateRecord.id = FIRST_ID
  duplicateRecord.name = null
  delete duplicateRecord.preview
  delete duplicateRecord.cwd
  knownRecord.id = KNOWN_ID
  secondPage.data = [duplicateRecord, knownRecord]
  secondPage.nextCursor = null
  const readResponse = recordedReadSchema.parse(recordedResponses.read)
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
  const result = await createCodexSessionDiscovery(fixture.request)({
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

test('fails a Codex scan when the page envelope is malformed', async () => {
  await expect(
    readCodexSessions({
      request: (async (_method, _params, parse) =>
        parse({ data: [], nextCursor: 7 })) as CodexRequest,
      knownNativeIds: [],
      reportMalformed: () => {},
    }),
  ).rejects.toThrow()
})

test('propagates a failed read for a known Session so Session sync can retry', async () => {
  await expect(
    readCodexSessions({
      request: (async (method: string, _params, _parse) => {
        if (method === 'thread/list') return { data: [], nextCursor: null }
        throw new Error('app-server read failed')
      }) as CodexRequest,
      knownNativeIds: ['previously-saved'],
      reportMalformed: () => {},
    }),
  ).rejects.toThrow('app-server read failed')
})

test('skips a previously saved thread that Codex has removed', async () => {
  const calls: unknown[] = []
  const result = await readCodexSessions({
    request: (async (method: string, _params, parse) => {
      calls.push(method)
      if (method === 'thread/list') return parse({ data: [], nextCursor: null })
      throw new Error('Thread not found')
    }) as CodexRequest,
    knownNativeIds: ['removed-thread'],
    reportMalformed: () => {},
  })

  expect(result).toEqual([])
  expect(calls).toEqual(['thread/list', 'thread/read'])
})
