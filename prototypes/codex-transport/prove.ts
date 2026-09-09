import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Channel } from './channel.ts'
import { openChannel } from './channel.ts'
import type { HistoryTurn, Input, TextInput, ThreadConfiguration } from './protocol.ts'
import {
  readCompletedTurn,
  readInitialize,
  readInterrupt,
  readStartedTurn,
  readThread,
} from './protocol.ts'

// Protocol shapes: codex 0.147.0 app-server generate-ts, read before this probe was written.
const executable = process.argv[2]
assert(executable, 'Pass the absolute path of the Codex executable')
const model = process.argv[3]
assert(model, 'Pass a model advertised by this Codex executable')
const directory = mkdtempSync(join(tmpdir(), 'argo-codex-transport-'))
const transcript = join(directory, 'wire.jsonl')
const version = execFileSync(executable, ['--version'], { encoding: 'utf8', timeout: 5_000 }).trim()
console.log(JSON.stringify({ version, directory }))

async function initialize(channel: Channel) {
  const result = await channel.request(
    'initialize',
    {
      clientInfo: { name: 'argo_transport_probe', title: 'Argo transport proof', version: '1' },
      capabilities: { experimentalApi: false, requestAttestation: false },
    },
    readInitialize,
  )
  assert.equal(typeof result.userAgent, 'string')
  console.log(JSON.stringify({ initializeKeys: Object.keys(result) }))
  channel.notify('initialized')
}

async function completion(channel: Channel, threadId: string, turnId: string) {
  return channel.waitFor((message) => {
    const completed = readCompletedTurn(message)
    return completed?.threadId === threadId && completed.turn.id === turnId
      ? completed.turn
      : undefined
  })
}

async function complete(channel: Channel, threadId: string, input: Input[]) {
  const turn = await channel.request('turn/start', { threadId, input }, readStartedTurn)
  const finished = await completion(channel, threadId, turn.id)
  assert.equal(finished.status, 'completed', JSON.stringify(finished.error))
  return turn.id
}

function textInput(text: string): TextInput {
  return { type: 'text', text, text_elements: [] }
}

function historyTurn(turns: HistoryTurn[], id: string): HistoryTurn {
  const turn = turns.find((candidate) => candidate.id === id)
  assert(turn, `Missing history for Turn ${id}`)
  return turn
}

const draft =
  '  Transport proof: café 🧭\nLiteral spans: $example @example /example\nRemember the token: amber-1826. Reply with OK only.  '
const imagePath = join(directory, 'pixel.png')
writeFileSync(
  imagePath,
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1kAAAAASUVORK5CYII=',
    'base64',
  ),
)
const configuration: ThreadConfiguration = {
  model,
  cwd: directory,
  sandbox: 'read-only',
  approvalPolicy: 'untrusted',
  baseInstructions:
    'This is a protocol test. Follow the user instructions. Do not use tools, files, network, or other agents. Reply in plain text.',
}
let channel = openChannel(executable, transcript)
try {
  await initialize(channel)
  const opened = await channel.request('thread/start', configuration, readThread)
  const threadId = opened.id
  assert.equal(typeof threadId, 'string')
  const firstTurn = await complete(channel, threadId, [
    textInput(draft),
    { type: 'localImage', path: imagePath },
  ])
  const history = await channel.request('thread/read', { threadId, includeTurns: true }, readThread)
  const first = historyTurn(history.turns, firstTurn)
  const userMessage = first.items.find((item) => item.type === 'userMessage')
  assert(userMessage, 'Missing submitted message')
  const content = userMessage.content
  const text = content.find((item) => item.type === 'text')
  assert(text, 'Missing submitted text')
  assert.equal(text.text, draft)
  assert(content.some((item) => item.type === 'localImage' || item.type === 'image'))
  console.log('PASS: exact Unicode, whitespace, sigils, and image input survive in server history')

  const running = await channel.request(
    'turn/start',
    {
      threadId,
      input: [
        textInput(
          'Write a very long essay about the sea, at least ten thousand words. Use no tools.',
        ),
      ],
    },
    readStartedTurn,
  )
  await channel.request('turn/interrupt', { threadId, turnId: running.id }, readInterrupt)
  const stopped = await completion(channel, threadId, running.id)
  assert.equal(stopped.status, 'interrupted')
  console.log('PASS: interrupt completes the addressed Turn as interrupted')

  await channel.close()
  channel = openChannel(executable, transcript)
  await initialize(channel)
  const resumed = await channel.request('thread/resume', { ...configuration, threadId }, readThread)
  assert.equal(resumed.id, threadId)
  assert(resumed.turns.some((turn) => turn.id === firstTurn))
  const resumedTurn = await complete(channel, threadId, [
    textInput('Reply with the token I asked you to remember. Nothing else. Use no tools.'),
  ])
  const continued = await channel.request(
    'thread/read',
    { threadId, includeTurns: true },
    readThread,
  )
  const answer = historyTurn(continued.turns, resumedTurn)
    .items.filter((item) => item.type === 'agentMessage')
    .map((item) => item.text)
    .join('\n')
  assert.match(answer, /amber-1826/)
  console.log('PASS: a fresh process resumes the same thread and answers from its prior context')
} finally {
  await channel.close()
  console.log(`Private raw transcript: ${transcript}`)
}
