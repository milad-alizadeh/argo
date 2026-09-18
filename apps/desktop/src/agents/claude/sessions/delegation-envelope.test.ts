import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseTranscriptLine } from './records'

function notification(uuid: string, body: string) {
  return JSON.stringify({ type: 'user', uuid, message: { role: 'user', content: body } })
}

test('reads a background task notification as its readable name, not raw envelope prose', () => {
  const line = notification(
    'task-1',
    '<task-notification>\n<task-id>a1</task-id>\n<tool-use-id>toolu_1</tool-use-id>\n<status>completed</status>\n<summary>Background command "Install dependencies" completed (exit code 0)</summary>\n</task-notification>',
  )
  assert.deepEqual(parseTranscriptLine(line), {
    kind: 'delegation',
    uuid: 'task-1',
    timestamp: null,
    actor: 'shell',
    action: 'Install dependencies',
    status: 'completed',
    progress: null,
    groupId: 'a1',
    callId: 'toolu_1',
    ending: {
      kind: 'background-task',
      taskId: 'a1',
      callId: 'toolu_1',
      outputPath: null,
      state: 'completed',
      summary: 'Background command "Install dependencies" completed (exit code 0)',
      timestamp: null,
    },
  })
})

for (const { claim, body, actor, action, progress } of [
  {
    claim: 'an agent, with the first line of its report',
    body: '<summary>Agent "Consolidate stories" finished</summary>\n<result>**Task:** Merge the stories\nMore</result>',
    actor: 'agent',
    action: 'Consolidate stories',
    progress: 'Task: Merge the stories',
  },
  {
    claim: 'a workflow, leaving its JSON result for the model',
    body: '<summary>Dynamic workflow "Map the gaps" completed</summary>\n<result>{"summaries":[]}</result>',
    actor: 'agent',
    action: 'Map the gaps',
    progress: null,
  },
  {
    claim: 'a monitor, with its event as the latest line',
    body: '<summary>Monitor event: "Watch CI to a verdict"</summary>\n<event>DONE: all checks settled</event>',
    actor: 'shell',
    action: 'Watch CI to a verdict',
    progress: 'DONE: all checks settled',
  },
] as const) {
  test(`reads a task notification from ${claim}`, () => {
    const record = parseTranscriptLine(
      notification('task-3', `<task-notification><task-id>t3</task-id>${body}</task-notification>`),
    )
    assert.deepEqual(record, {
      kind: 'delegation',
      uuid: 'task-3',
      timestamp: null,
      actor,
      action,
      status: null,
      progress,
      groupId: 't3',
      callId: null,
    })
  })
}

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
    timestamp: null,
    actor: 'shell',
    action: null,
    status: 'completed',
    progress: null,
    groupId: null,
    callId: null,
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
    timestamp: null,
    actor: 'agent',
    action: 'Review the Feed card.',
    status: 'running',
    progress: 'Checking keyboard use',
    groupId: 'review',
    callId: null,
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
    timestamp: null,
    actor: 'agent',
    action: 'Review the Feed card.',
    status: null,
    progress: null,
    groupId: null,
    callId: null,
  })
})
