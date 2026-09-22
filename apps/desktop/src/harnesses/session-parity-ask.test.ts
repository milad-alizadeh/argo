// The parity suite's pending-question case (#2449). What each harness lacks, by name: Codex writes
// no question to its transcript, so its ask row and its `asking` status come from the live
// request alone, and neither harness gives an `unsupported` reason for this question.
import assert from 'node:assert/strict'
import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import type { SessionFeedRow } from '@/domains/sessions/contract/model/models'
import { managedRow } from '@/domains/sessions/main/lifecycle/status/managed-row'
import { createSessionReader } from '@/domains/sessions/main/observation/reader/reader'
import {
  fed,
  feedRequest,
  listed,
  rowsOf,
  tempRoot,
} from '@/domains/sessions/main/observation/reader/reader-test-helpers'
import { claudeSessionSource } from './claude/sessions/discovery/read-sessions'
import { createLiveMessages } from './codex/drive/live-messages'
import {
  type HeldSession,
  recordCodexNotification,
} from './codex/drive/protocol/record-notification'
import { readerOverRollout } from './codex/sessions/rollout-reader-test-helper'

const SESSION = 'parityAsk'
const FIXTURES = fileURLToPath(new URL('../../mocks/cli/claude/fixtures/sessions', import.meta.url))
type Context = { after: (cleanup: () => Promise<void>) => void }
type Reader = ReturnType<typeof createSessionReader>

const QUESTION = {
  question: 'Which ink?',
  header: 'Ink',
  multiSelect: false,
  options: [
    { label: 'Black', description: 'The house default.' },
    { label: 'Blue', description: 'The other one.' },
  ],
}

async function claudeReader(context: Context): Promise<Reader> {
  const root = await tempRoot(context)
  await mkdir(path.join(root, 'project-one'), { recursive: true })
  await copyFile(
    path.join(FIXTURES, `${SESSION}.jsonl`),
    path.join(root, 'project-one', `${SESSION}.jsonl`),
  )
  return createSessionReader([claudeSessionSource({ transcripts: root })])
}

// The request Codex's app-server sends while a Turn waits for the person.
function requestUserInput() {
  return {
    id: 0,
    method: 'item/tool/requestUserInput',
    params: {
      threadId: SESSION,
      turnId: 'turn-1',
      itemId: 'ask-1',
      isBlocking: false,
      autoResolutionMs: null,
      questions: [
        {
          id: 'ink',
          header: QUESTION.header,
          question: QUESTION.question,
          isOther: true,
          isSecret: false,
          options: QUESTION.options,
        },
      ],
    },
  }
}

async function codexReader(context: Context): Promise<Reader> {
  const sessions = new Map<string, HeldSession>()
  const held: HeldSession = {
    messages: createLiveMessages(SESSION),
    plan: null,
    status: 'running',
    turnId: null,
    compactionStartedAt: null,
    pendingQuestion: null,
    pendingPermission: null,
  }
  sessions.set(SESSION, held)
  recordCodexNotification({
    acceptTitle: () => {},
    message: requestUserInput(),
    now: () => new Date('2026-09-19T10:00:02.000Z'),
    onPlanUpdated: () => {},
    sessionId: SESSION,
    sessions,
  })
  const row = managedRow(SESSION, {
    harness: 'codex',
    cwd: '/Users/x/tree',
    status: held.status,
    setup: { model: null, effort: null, mode: null },
    prompt: 'Pick the ink',
    startedAt: '2026-09-19T10:00:00.000Z',
  })
  return readerOverRollout(
    context,
    { fixture: `rollout-${SESSION}.jsonl`, session: SESSION },
    { roster: () => [row], pendingQuestion: () => held.pendingQuestion },
  )
}

function asks(rows: SessionFeedRow[]) {
  return rows.flatMap((row) =>
    row.shape === 'ask'
      ? [{ questions: row.questions, answer: row.answer, unsupported: row.unsupported }]
      : [],
  )
}

async function read(reader: Reader) {
  const feed = rowsOf(await fed(reader, feedRequest(SESSION)))
  const roster = (await listed(reader))?.sessions.find((row) => row.id === SESSION)
  return { asks: asks(feed), status: roster?.status }
}

test('a pending question reads the same for Claude and for Codex', async (context) => {
  const expected = {
    asks: [{ questions: [QUESTION], answer: null, unsupported: null }],
    status: 'asking',
  }
  assert.deepEqual(await read(await claudeReader(context)), expected)
  assert.deepEqual(await read(await codexReader(context)), expected)
})

test('a settled Codex question is absent after the Session reopens', async (context) => {
  assert.equal((await read(await codexReader(context))).asks.length, 1)
  const reopened = await readerOverRollout(context, {
    fixture: `rollout-${SESSION}.jsonl`,
    session: SESSION,
  })
  assert.deepEqual(asks(rowsOf(await fed(reopened, feedRequest(SESSION)))), [])
})
