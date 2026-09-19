import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fixtureFile } from '@/agents/claude/integration/session-fixtures'

test('reads a shell command and its result from one transcript-shaped run', async () => {
  const file = await fixtureFile('commandWithResult')
  const messages = file.records.filter((record) => record.kind === 'message')
  const command = messages.find((record) => record.uuid === 'command-run')
  const result = messages.find((record) => record.uuid === 'command-result')

  assert.deepEqual(command?.toolCalls, [
    {
      id: 'command-run-1',
      name: 'Bash',
      input: { command: 'git status --short' },
      execute: {
        kind: 'execute',
        command: 'git status --short',
        label: null,
        text: 'git status --short',
        background: false,
      },
    },
  ])
  assert.deepEqual(result?.toolResults, [
    {
      callId: 'command-run-1',
      blocks: [{ shape: 'text', text: ' M apps/desktop/src/renderer/App.tsx' }],
      failed: false,
    },
  ])
})
