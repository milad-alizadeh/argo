import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createActor, waitFor } from 'xstate'
import type { CodexRequest } from '../app-server/codex-app-server-machine'
import { codexInputItems, createCodexSessionMachine } from './codex-session-machine'

test('converts text, files, and images at the Codex Session boundary', () => {
  assert.deepEqual(
    codexInputItems('Read these.', [
      { path: '/repo/readme.md', kind: 'file' },
      { path: '/repo/image.png', kind: 'image' },
    ]),
    [
      { type: 'text', text: 'Read these.', text_elements: [] },
      {
        type: 'text',
        text: '/repo/readme.md',
        text_elements: [{ byteRange: { start: 0, end: 15 }, placeholder: '/repo/readme.md' }],
      },
      { type: 'localImage', path: '/repo/image.png' },
    ],
  )
})

test('starts the first Codex turn before becoming ready', async () => {
  const calls: string[] = []
  const request: CodexRequest = async (method, _params, parse) => {
    calls.push(method)
    return parse(
      method === 'thread/start' ? { thread: { id: 'thread-1' } } : { turn: { id: 'turn-1' } },
    )
  }
  const actor = createActor(createCodexSessionMachine(request), {
    input: {
      commandId: '00000000-0000-4000-8000-000000000001',
      harness: 'codex',
      cwd: '/repo',
      prompt: 'first',
      attachments: [],
      setup: { model: 'model', effort: 'medium', mode: 'workspace-write' },
    },
  }).start()
  await waitFor(actor, (snapshot) => snapshot.matches('Ready'))
  assert.deepEqual(calls, ['thread/start', 'turn/start'])
  actor.stop()
})

test('starts later Codex prompts on the persisted thread', async () => {
  const calls: Array<{ method: string; threadId?: string }> = []
  const request: CodexRequest = async (method, params, parse) => {
    calls.push({
      method,
      threadId: method === 'turn/start' && 'threadId' in params ? params.threadId : undefined,
    })
    return parse(
      method === 'thread/start' ? { thread: { id: 'thread-1' } } : { turn: { id: 'turn-1' } },
    )
  }
  const actor = createActor(createCodexSessionMachine(request), {
    input: {
      commandId: '00000000-0000-4000-8000-000000000001',
      harness: 'codex',
      cwd: '/repo',
      prompt: 'first',
      attachments: [],
      setup: { model: 'model', effort: 'medium', mode: 'workspace-write' },
    },
  }).start()
  await waitFor(actor, (snapshot) => snapshot.matches('Ready'))
  actor.send({
    type: 'Send',
    command: {
      prompt: 'second',
      attachments: [],
      setup: { model: 'model', effort: 'medium', mode: 'workspace-write' },
    },
  })
  await waitFor(actor, (snapshot) => snapshot.matches('Ready'))
  assert.deepEqual(calls, [
    { method: 'thread/start', threadId: undefined },
    { method: 'turn/start', threadId: 'thread-1' },
    { method: 'turn/start', threadId: 'thread-1' },
  ])
  actor.stop()
})
