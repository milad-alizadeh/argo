import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import type { Channel } from './channel.ts'
import { openChannel } from './channel.ts'
import { readCompletedTurn, readInitialize, readThread } from './protocol.ts'

async function withPeer(message: unknown, run: (channel: Channel) => Promise<void>) {
  const directory = mkdtempSync(join(tmpdir(), 'argo-codex-peer-'))
  const executable = join(directory, 'codex')
  writeFileSync(
    executable,
    `#!${process.execPath}\nprocess.stdin.once('data', () => process.stdout.write(${JSON.stringify(`${JSON.stringify(message)}\n`)}));\n`,
  )
  chmodSync(executable, 0o700)
  const channel = openChannel(executable, join(directory, 'wire.jsonl'))
  try {
    await run(channel)
  } finally {
    try {
      await channel.close()
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  }
}

const initializeParams = {
  clientInfo: { name: 'argo_transport_test', title: 'Transport test', version: '1' },
  capabilities: { experimentalApi: false, requestAttestation: false },
}

test('reads a validated initialization response from the CLI', async () => {
  const result = {
    userAgent: 'codex/0.147.0',
    codexHome: '/tmp/codex',
    platformFamily: 'unix',
    platformOs: 'macos',
  }
  await withPeer({ id: 1, result }, async (channel) => {
    assert.deepEqual(await channel.request('initialize', initializeParams, readInitialize), result)
  })
})

test('rejects malformed CLI envelopes and payloads', async () => {
  const cases: { message: unknown; error: RegExp }[] = [
    { message: null, error: /Protocol envelope must be an object/ },
    { message: { id: 1 }, error: /exactly one result or error/ },
    { message: { id: 1, result: {}, error: {} }, error: /exactly one result or error/ },
    { message: { result: {} }, error: /missing its ID/ },
    { message: { id: null, result: {} }, error: /Invalid protocol request ID/ },
    { message: { id: 1, error: { code: 'bad', message: 'bad' } }, error: /numeric code/ },
    { message: { id: 1, method: 'approval', params: {} }, error: /Unexpected server request/ },
    { message: { method: 'turn/completed', params: null }, error: /params must be an object/ },
    { message: { id: 1, result: { userAgent: 7 } }, error: /User agent must be a string/ },
  ]
  for (const { message, error } of cases) {
    await withPeer(message, async (channel) => {
      await assert.rejects(channel.request('initialize', initializeParams, readInitialize), error)
    })
  }
})

test('reads exact text and image paths from CLI history', async () => {
  const result = {
    thread: {
      id: 'thread',
      turns: [
        {
          id: 'turn',
          status: 'completed',
          error: null,
          items: [
            {
              type: 'userMessage',
              content: [
                { type: 'text', text: '  café 🧭\n$skill  ', text_elements: [] },
                { type: 'localImage', path: '/tmp/image.png' },
              ],
            },
            { type: 'agentMessage', text: 'OK' },
          ],
        },
      ],
    },
  }
  await withPeer({ id: 1, result }, async (channel) => {
    const thread = await channel.request(
      'thread/read',
      { threadId: 'thread', includeTurns: true },
      readThread,
    )
    assert.deepEqual(thread.turns[0]?.items, [
      {
        type: 'userMessage',
        content: [
          { type: 'text', text: '  café 🧭\n$skill  ' },
          { type: 'localImage', path: '/tmp/image.png' },
        ],
      },
      { type: 'agentMessage', text: 'OK' },
    ])
  })
})

test('rejects a malformed completed Turn before exposing its status', async () => {
  await withPeer(
    {
      method: 'turn/completed',
      params: { threadId: 'thread', turn: { id: 'turn', status: 'invented' } },
    },
    async (channel) => {
      channel.notify('initialized')
      await assert.rejects(channel.waitFor(readCompletedTurn), /Invalid Turn status/)
    },
  )
})
