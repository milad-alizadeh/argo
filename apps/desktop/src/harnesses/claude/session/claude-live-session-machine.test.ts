import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createActor, fromCallback, waitFor } from 'xstate'
import { getShortestPaths } from 'xstate/graph'
import { claudeLiveSessionMachine } from './claude-live-session-machine'

const first = {
  commandId: '00000000-0000-4000-8000-000000000001',
  harness: 'claude' as const,
  projectId: '00000000-0000-4000-8000-000000000099',
  cwd: '/repo',
  prompt: 'first',
  attachments: [],
  turnConfiguration: { model: 'sonnet', effort: 'medium', mode: 'default' },
}

test('models opening, later sends, failure, and close paths', () => {
  const paths = getShortestPaths(claudeLiveSessionMachine, {
    input: first,
    events: (snapshot) => {
      if (snapshot.matches({ Active: 'Opening' }))
        return [
          { type: 'Opened' as const, nativeId: 'native-1' },
          { type: 'Query failed' as const, detail: 'opening failed' },
          { type: 'Close' as const },
        ]
      if (snapshot.matches({ Active: 'Ready' }))
        return [
          { type: 'Send' as const, command: { prompt: 'second' } },
          { type: 'Query failed' as const, detail: 'later failure' },
          { type: 'Close' as const },
        ]
      if (snapshot.matches({ Active: 'Sending' }))
        return [
          { type: 'Sent' as const },
          { type: 'Query failed' as const, detail: 'send failed' },
          { type: 'Close' as const },
        ]
      return snapshot.matches('Failed') ? [{ type: 'Close' as const }] : []
    },
  })
  assert.deepEqual(
    new Set(paths.map(({ state }) => JSON.stringify(state.value))),
    new Set([
      JSON.stringify({ Active: 'Opening' }),
      JSON.stringify({ Active: 'Ready' }),
      JSON.stringify({ Active: 'Sending' }),
      JSON.stringify('Failed'),
      JSON.stringify('Closed'),
    ]),
  )
  for (const { state } of paths) {
    if (state.matches({ Active: 'Ready' })) assert.equal(state.context.nativeId, 'native-1')
    if (state.matches('Failed')) assert.notEqual(state.context.failure, null)
  }
})

test('keeps the Claude query alive for later sends and closes it with the Session', async () => {
  const delivered: string[] = []
  let closed = 0
  const machine = claudeLiveSessionMachine.provide({
    actors: {
      queryActor: fromCallback(({ receive, sendBack }) => {
        receive((event) => {
          delivered.push(event.prompt)
          if (delivered.length === 1) sendBack({ type: 'Opened', nativeId: 'native-1' })
          else sendBack({ type: 'Sent' })
        })
        return () => {
          closed += 1
        }
      }),
    },
  })
  const actor = createActor(machine, { input: first }).start()
  await waitFor(actor, (snapshot) => snapshot.hasTag('ready'))
  actor.send({ type: 'Send', command: { prompt: 'second' } })
  await waitFor(actor, (snapshot) => snapshot.hasTag('ready') && delivered.length === 2)
  assert.deepEqual(delivered, ['first', 'second'])
  assert.equal(closed, 0)
  actor.send({ type: 'Close' })
  await waitFor(actor, (snapshot) => snapshot.matches('Closed'))
  assert.equal(closed, 1)
})

test('closes the Claude query after a vendor failure', async () => {
  let closed = 0
  const machine = claudeLiveSessionMachine.provide({
    actors: {
      queryActor: fromCallback(({ sendBack }) => {
        sendBack({ type: 'Query failed', detail: 'Vendor refused the first prompt.' })
        return () => {
          closed += 1
        }
      }),
    },
  })
  const actor = createActor(machine, { input: first }).start()
  const failed = await waitFor(actor, (snapshot) => snapshot.matches('Failed'))
  assert.equal(failed.context.failure, 'Vendor refused the first prompt.')
  assert.equal(closed, 1)
  actor.stop()
})

test('maps the catalog manual mode to the SDK default mode', () => {
  const actor = createActor(
    claudeLiveSessionMachine.provide({
      actors: {
        queryActor: fromCallback(() => undefined),
      },
    }),
    { input: { ...first, turnConfiguration: { ...first.turnConfiguration, mode: 'manual' } } },
  ).start()
  assert.equal(actor.getSnapshot().context.mode, 'default')
  actor.stop()
})
