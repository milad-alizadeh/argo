import { expect, test } from 'vitest'
import { sessionSubmitInputSchema } from './session-start'

const command = {
  commandId: 'command-1',
  harness: 'codex',
  projectId: null,
  cwd: '/external',
  prompt: 'Continue',
  attachments: [],
  setup: { model: 'model', effort: 'medium', mode: 'workspace-write' },
}

test('accepts an indexed external Session without a linked Project', () => {
  expect(
    sessionSubmitInputSchema.safeParse({
      ...command,
      sessionId: '00000000-0000-4000-8000-000000000001',
      pendingId: null,
    }).success,
  ).toBe(true)
})

test('requires a Project for a new Session', () => {
  expect(
    sessionSubmitInputSchema.safeParse({
      ...command,
      sessionId: null,
      pendingId: 'optimistic:one',
    }).success,
  ).toBe(false)
})
