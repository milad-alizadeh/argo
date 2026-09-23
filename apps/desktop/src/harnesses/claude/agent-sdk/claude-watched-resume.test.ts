import { expect, test } from 'bun:test'
import { beginWatchedClaudeResume } from './claude-watched-resume'

test('leaves a watched Claude Session unchanged when the vendor refuses resume', async () => {
  const events: string[] = []
  const outcome = await beginWatchedClaudeResume({
    readPermission: async () => ({
      resumable: false,
      reason: 'Claude Desktop holds this Session.',
    }),
    acquireLease: () => {
      events.push('lease')
      return { posture: 'managed' }
    },
    releaseLease: () => events.push('release'),
    openManaged: async () => {
      events.push('open')
      throw new Error('unexpected')
    },
  })

  expect(outcome).toEqual({ kind: 'rejected', reason: 'Claude Desktop holds this Session.' })
  expect(events).toEqual([])
})

test('checks vendor permission before acquiring the SQLite lease', async () => {
  const events: string[] = []
  const outcome = await beginWatchedClaudeResume({
    readPermission: async () => {
      events.push('permission')
      return { resumable: true }
    },
    acquireLease: () => {
      events.push('lease')
      return { posture: 'managed' }
    },
    releaseLease: () => events.push('release'),
    openManaged: async () => {
      events.push('open')
      return { kind: 'uncertain' }
    },
  })

  expect(outcome).toEqual({ kind: 'uncertain' })
  expect(events).toEqual(['permission', 'lease', 'open'])
})
