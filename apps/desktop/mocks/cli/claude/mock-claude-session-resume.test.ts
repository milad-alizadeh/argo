import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { query, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'
import { claudeSessionMessages } from '../../../e2e/sessions/real-harness/claude-vendor-reader.ts'
import { recordedClaudeCompactionChain } from '../../recordings/claude-cli.ts'
import { writeMockClaude } from './mock-claude-cli.ts'
import { claudeProjectFolder } from './mock-claude-transcripts.ts'

const ESCAPE = String.fromCharCode(27)
const SESSION_ID = '00000000-0000-4000-8000-00000000be01'

function earlierRecord(type: 'user' | 'assistant', uuid: string, parentUuid: string | null) {
  const text = `earlier ${uuid}`
  const message =
    type === 'user'
      ? { role: 'user', content: text }
      : { role: 'assistant', content: [{ type: 'text', text }] }
  return JSON.stringify({ type, sessionId: SESSION_ID, uuid, parentUuid, message })
}

test('a resumed mock Claude chains its first new record to the newest earlier one', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-claude-resume-'))
  const configDirectory = path.join(root, 'claude-config')
  const transcripts = path.join(configDirectory, 'projects')
  try {
    const executable = await writeMockClaude(root, transcripts)
    const folder = claudeProjectFolder(transcripts, process.cwd())
    await mkdir(folder, { recursive: true })
    await writeFile(
      path.join(folder, `${SESSION_ID}.jsonl`),
      [
        earlierRecord('user', 'earlier-1', null),
        earlierRecord('assistant', 'earlier-2', 'earlier-1'),
        JSON.stringify({ type: 'custom-title', customTitle: 'Titled' }),
      ].join('\n') + '\n',
    )
    const child = spawn(executable, ['--resume', SESSION_ID], { env: process.env })
    try {
      await once(child.stdout, 'data')
      child.stdin.write(`${ESCAPE}[200~Go on please${ESCAPE}[201~\r`)
      const deadline = Date.now() + 5_000
      let texts: string[] = []
      while (Date.now() < deadline && !texts.some((text) => text.includes('Mock Claude read'))) {
        await new Promise((resolve) => setTimeout(resolve, 10))
        const messages = await claudeSessionMessages(configDirectory, SESSION_ID).catch(() => [])
        texts = messages.map((message) => JSON.stringify(message.message))
      }
      assert.deepEqual(
        texts.map(
          (text) => /earlier-\d|Mock Claude read: Go on please|Go on please/.exec(text)?.[0],
        ),
        ['earlier-1', 'earlier-2', 'Go on please', 'Mock Claude read: Go on please'],
      )
    } finally {
      child.kill()
      await once(child, 'exit')
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

type ChainRecord = {
  type: string
  subtype?: string
  uuid: string
  parentUuid: string | null
  message?: { content?: unknown }
}

// Each uuid from a record back to the first one whose parent is null, as the Agent SDK walks it.
function ancestry(records: ChainRecord[], uuid: string): string[] {
  const byUuid = new Map(records.map((record) => [record.uuid, record]))
  const walked: string[] = []
  for (let record = byUuid.get(uuid); record !== undefined; ) {
    walked.push(record.uuid)
    record = record.parentUuid === null ? undefined : byUuid.get(record.parentUuid)
  }
  return walked
}

function boundaryOf(records: ChainRecord[]) {
  const boundary = records.find((record) => record.subtype === 'compact_boundary')
  assert.ok(boundary, 'No compact_boundary record.')
  return boundary as ChainRecord & Record<string, unknown>
}

function promptUuid(records: ChainRecord[], prompt: string) {
  const record = records.find((entry) => entry.type === 'user' && entry.message?.content === prompt)
  assert.ok(record, `No user record for ${prompt}.`)
  return record.uuid
}

// One SDK `query` against the mock, each prompt sent once the previous Turn has its result.
async function converse(executable: string, prompts: string[], resume?: string) {
  let answered = () => {}
  async function* messages(): AsyncGenerator<SDKUserMessage> {
    for (const prompt of prompts) {
      const result = new Promise<void>((resolve) => {
        answered = resolve
      })
      yield { type: 'user', message: { role: 'user', content: prompt }, parent_tool_use_id: null }
      await result
    }
  }
  const session = query({
    prompt: messages(),
    options: {
      cwd: process.cwd(),
      pathToClaudeCodeExecutable: executable,
      ...(resume ? { resume } : {}),
    },
  })
  let sessionId: string | null = null
  let results = 0
  for await (const message of session) {
    if (message.type === 'system' && message.subtype === 'init') sessionId = message.session_id
    if (message.type !== 'result') continue
    results += 1
    answered()
    if (results === prompts.length) break
  }
  session.close()
  assert.ok(sessionId, 'The mock named no Session.')
  return sessionId
}

const RECORDED = recordedClaudeCompactionChain as ChainRecord[]
const RECORDED_LIVE_PROMPT = 'Reply with exactly the word BRAVO-TWO-OK and nothing else.'
const RECORDED_RESUMED_PROMPT = 'Reply with exactly the word CHARLIE-THREE-OK and nothing else.'

test('the recorded Claude chains the prompts after a compaction to its boundary, live and resumed', () => {
  const boundary = boundaryOf(RECORDED)
  assert.equal(boundary.parentUuid, null)
  for (const prompt of [RECORDED_LIVE_PROMPT, RECORDED_RESUMED_PROMPT])
    assert.equal(ancestry(RECORDED, promptUuid(RECORDED, prompt)).at(-1), boundary.uuid)
})

test('a mock Claude compaction chains like the recording, live and after a resume', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-claude-compaction-'))
  const configDirectory = path.join(root, 'claude-config')
  const transcripts = path.join(configDirectory, 'projects')
  try {
    const executable = await writeMockClaude(root, transcripts)
    const sessionId = await converse(executable, [
      'Before compaction',
      '/compact',
      'After compaction',
    ])
    const texts = async () =>
      (await claudeSessionMessages(configDirectory, sessionId)).map(
        (message) =>
          /(Mock Claude read: )?(Before|After) \w+|continued/.exec(
            JSON.stringify(message.message),
          )?.[0],
      )
    assert.deepEqual(await texts(), [
      'continued',
      'After compaction',
      'Mock Claude read: After compaction',
    ])
    await converse(executable, ['After resume'], sessionId)
    assert.deepEqual(await texts(), [
      'continued',
      'After compaction',
      'Mock Claude read: After compaction',
      'After resume',
      'Mock Claude read: After resume',
    ])
    const file = path.join(claudeProjectFolder(transcripts, process.cwd()), `${sessionId}.jsonl`)
    const records = (await readFile(file, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as ChainRecord)
      .filter((record) => typeof record.uuid === 'string')
    const boundary = boundaryOf(records)
    assert.deepEqual(Object.keys(boundary).sort(), Object.keys(boundaryOf(RECORDED)).sort())
    assert.equal(boundary.parentUuid, null)
    assert.equal(boundary.logicalParentUuid, records[records.indexOf(boundary) - 1]?.uuid)
    for (const prompt of ['After compaction', 'After resume'])
      assert.equal(ancestry(records, promptUuid(records, prompt)).at(-1), boundary.uuid)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
