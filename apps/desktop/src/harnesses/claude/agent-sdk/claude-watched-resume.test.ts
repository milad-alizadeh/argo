import { expect, test } from 'bun:test'
import { beginWatchedClaudeResume } from './claude-watched-resume'

test('keeps a watched Session when Claude refuses native resume', async () => {
  const events: string[] = []
  const outcome = await beginWatchedClaudeResume({
    readPermission: async () => {
      events.push('permission')
      return { resumable: false, reason: 'Claude Desktop holds this Session.' }
    },
    openManaged: async () => {
      events.push('open')
      throw new Error('unexpected')
    },
  })
  expect(outcome).toEqual({ kind: 'rejected', reason: 'Claude Desktop holds this Session.' })
  expect(events).toEqual(['permission'])
})

test('checks Claude liveness before opening a managed channel', async () => {
  const events: string[] = []
  const outcome = await beginWatchedClaudeResume({
    readPermission: async () => {
      events.push('permission')
      return { resumable: true }
    },
    openManaged: async () => {
      events.push('open')
      return { kind: 'uncertain' }
    },
  })
  expect(outcome).toEqual({ kind: 'uncertain' })
  expect(events).toEqual(['permission', 'open'])
})
