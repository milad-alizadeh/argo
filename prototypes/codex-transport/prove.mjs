import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openChannel } from './channel.mjs'

// Protocol shapes: codex 0.147.0 app-server generate-ts, read before this probe was written.
const executable = process.argv[2]
assert(executable, 'Pass the absolute path of the Codex executable')
const model = process.argv[3]
assert(model, 'Pass a model advertised by this Codex executable')
const directory = mkdtempSync(join(tmpdir(), 'argo-codex-transport-'))
const transcript = join(directory, 'wire.jsonl')
const version = execFileSync(executable, ['--version'], { encoding: 'utf8', timeout: 5_000 }).trim()
console.log(JSON.stringify({ version, directory }))

async function initialize(channel) {
  const result = await channel.request('initialize', {
    clientInfo: { name: 'argo_transport_probe', title: 'Argo transport proof', version: '1' },
    capabilities: { experimentalApi: false, requestAttestation: false },
  })
  assert.equal(typeof result.userAgent, 'string')
  console.log(JSON.stringify({ initializeKeys: Object.keys(result) }))
  channel.notify('initialized')
}

async function complete(channel, threadId, input) {
  const result = await channel.request('turn/start', { threadId, input })
  assert.equal(typeof result.turn.id, 'string')
  const finished = await channel.waitFor(
    (message) =>
      message.method === 'turn/completed' &&
      message.params.threadId === threadId &&
      message.params.turn.id === result.turn.id,
  )
  assert.equal(finished.params.turn.status, 'completed', JSON.stringify(finished.params.turn.error))
  return result.turn.id
}

function textInput(text) {
  return { type: 'text', text, text_elements: [] }
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
const configuration = {
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
  const opened = await channel.request('thread/start', configuration)
  const threadId = opened.thread.id
  assert.equal(typeof threadId, 'string')
  const firstTurn = await complete(channel, threadId, [
    textInput(draft),
    { type: 'localImage', path: imagePath },
  ])
  const history = await channel.request('thread/read', { threadId, includeTurns: true })
  const first = history.thread.turns.find((turn) => turn.id === firstTurn)
  const content = first.items.find((item) => item.type === 'userMessage').content
  assert.equal(content.find((item) => item.type === 'text').text, draft)
  assert(content.some((item) => item.type === 'localImage' || item.type === 'image'))
  console.log('PASS: exact Unicode, whitespace, sigils, and image input survive in server history')

  const running = await channel.request('turn/start', {
    threadId,
    input: [
      textInput(
        'Write a very long essay about the sea, at least ten thousand words. Use no tools.',
      ),
    ],
  })
  await channel.request('turn/interrupt', { threadId, turnId: running.turn.id })
  const stopped = await channel.waitFor(
    (message) =>
      message.method === 'turn/completed' &&
      message.params.threadId === threadId &&
      message.params.turn.id === running.turn.id,
  )
  assert.equal(stopped.params.turn.status, 'interrupted')
  console.log('PASS: interrupt completes the addressed Turn as interrupted')

  await channel.close()
  channel = openChannel(executable, transcript)
  await initialize(channel)
  const resumed = await channel.request('thread/resume', { ...configuration, threadId })
  assert.equal(resumed.thread.id, threadId)
  assert(resumed.thread.turns.some((turn) => turn.id === firstTurn))
  const resumedTurn = await complete(channel, threadId, [
    textInput('Reply with the token I asked you to remember. Nothing else. Use no tools.'),
  ])
  const continued = await channel.request('thread/read', { threadId, includeTurns: true })
  const answer = continued.thread.turns
    .find((turn) => turn.id === resumedTurn)
    .items.filter((item) => item.type === 'agentMessage')
    .map((item) => item.text)
    .join('\n')
  assert.match(answer, /amber-1826/)
  console.log('PASS: a fresh process resumes the same thread and answers from its prior context')
} finally {
  await channel.close()
  console.log(`Private raw transcript: ${transcript}`)
}
