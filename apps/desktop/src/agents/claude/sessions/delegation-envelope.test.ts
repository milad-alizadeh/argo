import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseTranscriptLine } from './records'

test('reads a background task notification as Shell activity, not raw envelope prose', () => {
  const line = JSON.stringify({
    type: 'user',
    uuid: 'task-1',
    message: {
      role: 'user',
      content:
        '<task-notification>\n<task-id>a1</task-id>\n<status>completed</status>\n<summary>Agent "Consolidate stories" finished</summary>\n<result>{"files":[{"path":"a.tsx"}]}</result>\n</task-notification>',
    },
  })
  assert.deepEqual(parseTranscriptLine(line), {
    kind: 'delegation',
    uuid: 'task-1',
    actor: 'shell',
    action: 'Agent "Consolidate stories" finished',
    status: 'completed',
    progress: null,
    groupId: 'a1',
  })
})

test('keeps a background task status without inventing a summary', () => {
  const line = JSON.stringify({
    type: 'user',
    uuid: 'task-2',
    message: {
      role: 'user',
      content: '<task-notification><status>completed</status></task-notification>',
    },
  })
  assert.deepEqual(parseTranscriptLine(line), {
    kind: 'delegation',
    uuid: 'task-2',
    actor: 'shell',
    action: null,
    status: 'completed',
    progress: null,
    groupId: null,
  })
})

test('reads a realtime delegation into a safe Agent card model', () => {
  const line = JSON.stringify({
    type: 'user',
    uuid: 'delegation-1',
    userType: 'external',
    sourceToolAssistantUUID: 'tool-1',
    message: {
      role: 'user',
      content:
        '<realtime_delegation><id>review</id><input>Review the Feed card.</input><status>running</status><progress>Checking keyboard use</progress></realtime_delegation>',
    },
  })
  assert.deepEqual(parseTranscriptLine(line), {
    kind: 'delegation',
    uuid: 'delegation-1',
    actor: 'agent',
    action: 'Review the Feed card.',
    status: 'running',
    progress: 'Checking keyboard use',
    groupId: 'review',
  })
})

test('drops an invalid delegation group id at the parser boundary', () => {
  const line = JSON.stringify({
    type: 'user',
    uuid: 'delegation-invalid-group',
    userType: 'external',
    sourceToolAssistantUUID: 'tool-1',
    message: {
      role: 'user',
      content:
        '<realtime_delegation><id>not a valid id</id><input>Review the Feed card.</input></realtime_delegation>',
    },
  })
  assert.deepEqual(parseTranscriptLine(line), {
    kind: 'delegation',
    uuid: 'delegation-invalid-group',
    actor: 'agent',
    action: 'Review the Feed card.',
    status: null,
    progress: null,
    groupId: null,
  })
})
