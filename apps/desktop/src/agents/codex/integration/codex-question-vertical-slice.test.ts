// #1841's vertical slice, driven end to end over the real transport: a fixture app-server
// (fixtures/mock-codex-app-server.ts) emits a real `item/tool/requestUserInput` request when the
// prompt says "ASK", the same way the real `codex app-server` does behind
// `features.default_mode_request_user_input` (live-verified against codex-cli 0.147.0, #1841).
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { createCodexDriveAdapter } from '@/agents/codex/drive/session-drive-adapter.ts'
import { codexSessionSource } from '@/agents/codex/sessions/read-sessions.ts'
import { decideSessionQuestion, startSession } from '@/domains/sessions/main/drive.ts'
import { createSessionReader } from '@/domains/sessions/main/reader'
import { driverBackedByFixture } from '../../../../mocks/cli/codex/mock-codex-driver.ts'

async function until<Value>(read: () => Value | null, attempts = 50): Promise<Value> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const value = read()
    if (value !== null) return value
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error('Timed out waiting for the pending Codex question.')
}

const ownerCliFor = async () => 'codex' as const

function decideRequest(requestId: string, sessionId: string, questionId: string) {
  return {
    version: 1 as const,
    type: 'session.question.decide' as const,
    requestId,
    sessionId,
    questionId,
    answers: [{ kind: 'options' as const, indices: [2] }],
  }
}

async function askRowFor(driver: ReturnType<typeof driverBackedByFixture>, sessionId: string) {
  const transcripts = mkdtempSync(path.join(os.tmpdir(), 'argo-codex-question-slice-'))
  const reader = createSessionReader([
    codexSessionSource(transcripts, {
      roster: driver.roster,
      pendingQuestion: driver.pendingQuestion,
    }),
  ])
  const feedReply = (await reader.readSessionFeed({
    version: 1,
    type: 'session.feed',
    requestId: 'feed-ask',
    sessionId,
    subagentId: null,
    revision: null,
  })) as { type: string; rows?: Array<{ shape: string; id: string; unsupported: unknown }> }
  assert.equal(feedReply.type, 'session.feed.read')
  const askRow = feedReply.rows?.find((row) => row.shape === 'ask')
  assert.ok(askRow, 'the pending question must reach the Feed as an ask row')
  return askRow
}

test('a real request_user_input reaches the Feed as an ask row, and the chosen answer reaches the transport', async () => {
  const echoDir = mkdtempSync(path.join(os.tmpdir(), 'argo-codex-question-answer-echo-'))
  const echoFile = path.join(echoDir, 'answers.jsonl')
  writeFileSync(echoFile, '')
  const driver = driverBackedByFixture({ env: { ARGO_CODEX_ECHO_FILE: echoFile } })
  const adapters = { codex: createCodexDriveAdapter(driver) }
  try {
    const startReply = await startSession(
      {
        version: 1,
        type: 'session.start',
        requestId: 'start-ask',
        cli: 'codex',
        cwd: process.cwd(),
        prompt: 'ASK the operator which color they prefer.',
      },
      adapters,
    )
    assert.equal(startReply.type, 'session.started')
    const sessionId = startReply.type === 'session.started' ? startReply.sessionId : ''

    const pending = await until(() => driver.pendingQuestion(sessionId))
    assert.equal(pending.questions.length, 1)
    assert.equal(pending.unsupported, null)

    const askRow = await askRowFor(driver, sessionId)
    assert.equal(askRow.unsupported, null)

    // A stale (wrong) questionId must fail without discarding the pending question, so the real
    // answer stays available to retry (#1841's "Failure keeps the answer available for retry").
    const staleDecision = await decideSessionQuestion(
      decideRequest('decide-stale', sessionId, 'not-the-pending-item'),
      { adapters, ownerCliFor },
    )
    assert.equal(staleDecision.type, 'session.error')
    assert.ok(pending === (await until(() => driver.pendingQuestion(sessionId))))

    const decision = await decideSessionQuestion(decideRequest('decide-1', sessionId, askRow.id), {
      adapters,
      ownerCliFor,
    })
    assert.equal(decision.type, 'session.accepted')
    assert.equal(driver.pendingQuestion(sessionId), null)

    const echoedLine = await until(() => {
      const contents = readFileSync(echoFile, 'utf8').trim()
      return contents === '' ? null : contents
    })
    assert.deepEqual(JSON.parse(echoedLine.split('\n')[0] ?? ''), {
      answers: { color: { answers: ['Blue'] } },
    })
  } finally {
    driver.close()
  }
})

test('an isSecret question surfaces as an honest unsupported ask row', async () => {
  const driver = driverBackedByFixture()
  const adapters = { codex: createCodexDriveAdapter(driver) }
  try {
    const startReply = await startSession(
      {
        version: 1,
        type: 'session.start',
        requestId: 'start-secret',
        cli: 'codex',
        cwd: process.cwd(),
        prompt: 'ASK_SECRET the operator for a token.',
      },
      adapters,
    )
    assert.equal(startReply.type, 'session.started')
    const sessionId = startReply.type === 'session.started' ? startReply.sessionId : ''

    const pending = await until(() => driver.pendingQuestion(sessionId))
    assert.ok(pending.unsupported)
  } finally {
    driver.close()
  }
})
