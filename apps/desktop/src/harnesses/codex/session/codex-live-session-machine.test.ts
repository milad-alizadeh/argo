import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createActor, waitFor } from 'xstate'
import { getShortestPaths } from 'xstate/graph'
import type { CodexRequest } from '../app-server/codex-app-server-machine'
import { codexLiveSessionActors, codexLiveSessionMachine } from './codex-live-session-machine'

function machineFor(request: CodexRequest) {
  return codexLiveSessionMachine.provide({ actors: codexLiveSessionActors(request) })
}

test('models Codex opening, first turn, later turn, failure, and close paths', () => {
  const paths = getShortestPaths(codexLiveSessionMachine, {
    input: {
      commandId: '00000000-0000-4000-8000-000000000001',
      harness: 'codex',
      projectId: '00000000-0000-4000-8000-000000000099',
      cwd: '/repo',
      prompt: 'first',
      attachments: [],
      turnConfiguration: { model: 'model', effort: 'medium', mode: 'workspace-write' },
    },
    events: (snapshot) => {
      if (snapshot.matches('Opening'))
        return [
          { type: 'xstate.done.actor.startThread' as const, output: 'thread-1' },
          { type: 'xstate.error.actor.startThread' as const, error: 'failed' },
        ]
      if (snapshot.matches('Starting first prompt'))
        return [
          { type: 'xstate.done.actor.startFirstTurn' as const, output: 'turn-1' },
          { type: 'xstate.error.actor.startFirstTurn' as const, error: 'failed' },
        ]
      if (snapshot.matches('Ready'))
        return [
          {
            type: 'Send' as const,
            command: {
              prompt: 'second',
              attachments: [],
              turnConfiguration: { model: 'model', effort: 'medium', mode: 'workspace-write' },
            },
          },
          { type: 'Close' as const },
        ]
      if (snapshot.matches('Starting next prompt'))
        return [
          { type: 'xstate.done.actor.startNextTurn' as const, output: 'turn-2' },
          { type: 'xstate.error.actor.startNextTurn' as const, error: 'failed' },
        ]
      return snapshot.matches('Failed') ? [{ type: 'Close' as const }] : []
    },
  })
  assert.deepEqual(
    new Set(paths.map(({ state }) => String(state.value))),
    new Set([
      'Opening',
      'Starting first prompt',
      'Ready',
      'Starting next prompt',
      'Failed',
      'Closed',
    ]),
  )
})

test('converts text, files, and images at the Codex Session boundary', async () => {
  let sentInput: unknown
  const request: CodexRequest = async (method, params, parse) => {
    if (method === 'turn/start' && 'input' in params) sentInput = params.input
    return parse(
      method === 'thread/start' ? { thread: { id: 'thread-1' } } : { turn: { id: 'turn-1' } },
    )
  }
  const actor = createActor(machineFor(request), {
    input: {
      commandId: '00000000-0000-4000-8000-000000000001',
      harness: 'codex',
      projectId: '00000000-0000-4000-8000-000000000099',
      cwd: '/repo',
      prompt: 'Read these.',
      attachments: [
        { path: '/repo/readme.md', kind: 'file' },
        { path: '/repo/image.png', kind: 'image' },
      ],
      turnConfiguration: { model: 'model', effort: 'medium', mode: 'workspace-write' },
    },
  }).start()
  await waitFor(actor, (snapshot) => snapshot.matches('Ready'))
  assert.deepEqual(sentInput, [
    { type: 'text', text: 'Read these.', text_elements: [] },
    {
      type: 'text',
      text: '/repo/readme.md',
      text_elements: [{ byteRange: { start: 0, end: 15 }, placeholder: '/repo/readme.md' }],
    },
    { type: 'localImage', path: '/repo/image.png' },
  ])
  actor.stop()
})

test('starts the first Codex turn before becoming ready', async () => {
  const calls: string[] = []
  const request: CodexRequest = async (method, _params, parse) => {
    calls.push(method)
    return parse(
      method === 'thread/start' ? { thread: { id: 'thread-1' } } : { turn: { id: 'turn-1' } },
    )
  }
  const actor = createActor(machineFor(request), {
    input: {
      commandId: '00000000-0000-4000-8000-000000000001',
      harness: 'codex',
      projectId: '00000000-0000-4000-8000-000000000099',
      cwd: '/repo',
      prompt: 'first',
      attachments: [],
      turnConfiguration: { model: 'model', effort: 'medium', mode: 'workspace-write' },
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
  const actor = createActor(machineFor(request), {
    input: {
      commandId: '00000000-0000-4000-8000-000000000001',
      harness: 'codex',
      projectId: '00000000-0000-4000-8000-000000000099',
      cwd: '/repo',
      prompt: 'first',
      attachments: [],
      turnConfiguration: { model: 'model', effort: 'medium', mode: 'workspace-write' },
    },
  }).start()
  await waitFor(actor, (snapshot) => snapshot.matches('Ready'))
  actor.send({
    type: 'Send',
    command: {
      prompt: 'second',
      attachments: [],
      turnConfiguration: { model: 'model', effort: 'medium', mode: 'workspace-write' },
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
