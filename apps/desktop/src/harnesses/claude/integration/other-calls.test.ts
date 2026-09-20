import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSessionReader } from '@/domains/sessions/main/observation/reader'
import { fed, feedRequest, rowsOf } from '@/domains/sessions/main/observation/reader-test-helpers'
import { toolCallsOf } from '@/domains/sessions/main/projection/tool-calls-of'
import { claudeSessionSource } from '../sessions/read-sessions'
import { fixtureRoot } from './session-fixtures'

test('draws a skill with its title and body, orchestration and unknown tools as other, and no poll', async (context) => {
  const root = await fixtureRoot(context, ['otherCalls'])
  const reader = createSessionReader([claudeSessionSource({ transcripts: root })])
  const rows = rowsOf(await fed(reader, feedRequest('otherCalls')))
  assert.deepEqual(toolCallsOf(rows), [
    { kind: 'skill', status: 'succeeded', label: 'Simple english', text: 'Write short sentences.' },
    { kind: 'tool', status: 'succeeded', label: 'Searched tools', text: 'select:Read' },
    {
      kind: 'tool',
      status: 'succeeded',
      label: 'Scheduled a wake-up',
      text: '{\n  "delaySeconds": 60\n}',
    },
    { kind: 'tool', status: 'succeeded', label: 'Ran FutureTool', text: null },
  ])
})
