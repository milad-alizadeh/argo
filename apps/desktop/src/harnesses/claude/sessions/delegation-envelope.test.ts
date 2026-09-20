import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseTranscriptLine } from '@/harnesses/claude/sessions/records'

function notification(uuid: string, body: string) {
  return JSON.stringify({ type: 'user', uuid, message: { role: 'user', content: body } })
}

test('reads a background command notification as the end of its call, never a Subagent', () => {
  const line = notification(
    'task-1',
    '<task-notification>\n<task-id>a1</task-id>\n<tool-use-id>toolu_1</tool-use-id>\n<status>killed</status>\n<summary>Background command "Install dependencies" was stopped</summary>\n</task-notification>',
  )
  assert.deepEqual(parseTranscriptLine(line), {
    kind: 'background-task',
    taskId: 'a1',
    callId: 'toolu_1',
    outputPath: null,
    state: 'interrupted',
    summary: 'Background command "Install dependencies" was stopped',
    timestamp: null,
  })
})

const WRAPPED = (body: string) =>
  `<task-notification><task-id>t3</task-id><tool-use-id>toolu_3</tool-use-id>${body}</task-notification>`

test('reads an agent notification as the Subagent responding, with one line of its report', () => {
  const record = parseTranscriptLine(
    notification(
      'task-3',
      WRAPPED(
        '<status>completed</status><summary>Agent "Consolidate stories" finished</summary>\n<result>**Task:** Merge the stories\nMore</result>',
      ),
    ),
  )
  assert.deepEqual(record, {
    kind: 'subagent',
    uuid: 'task-3',
    timestamp: null,
    subagentId: 'toolu_3',
    event: 'responded',
    state: 'completed',
    name: 'Consolidate stories',
    reply: '**Task:** Merge the stories\nMore',
    text: 'Task: Merge the stories',
  })
})

test('reads a workflow notification as a response and keeps its JSON result as the reply', () => {
  const record = parseTranscriptLine(
    notification(
      'task-4',
      WRAPPED(
        '<status>completed</status><summary>Dynamic workflow "Map the gaps" completed</summary>\n<result>{"summaries":[]}</result>',
      ),
    ),
  )
  assert.equal(record?.kind, 'subagent')
  assert.equal(record?.kind === 'subagent' && record.name, 'Map the gaps')
  assert.equal(record?.kind === 'subagent' && record.text, undefined)
})

test('reads a monitor event as status, never as a Subagent', () => {
  const record = parseTranscriptLine(
    notification(
      'task-5',
      '<task-notification><task-id>t5</task-id><summary>Monitor event: "Watch CI to a verdict"</summary>\n<event>DONE: all checks settled</event></task-notification>',
    ),
  )
  assert.deepEqual(record, {
    kind: 'event',
    uuid: 'task-5',
    event: 'status',
    text: 'Watch CI to a verdict: DONE: all checks settled',
  })
})

test('keeps a background task status without inventing a summary', () => {
  const line = notification(
    'task-2',
    '<task-notification><status>completed</status></task-notification>',
  )
  assert.deepEqual(parseTranscriptLine(line), {
    kind: 'event',
    uuid: 'task-2',
    event: 'status',
    text: null,
  })
})

test('reads a voice request into a prompt-like command block with no lifecycle', () => {
  const line = JSON.stringify({
    type: 'user',
    uuid: 'delegation-1',
    userType: 'external',
    sourceToolAssistantUUID: 'tool-1',
    message: {
      role: 'user',
      content:
        '<realtime_delegation><id>not a valid id</id><input>Review the Feed card.</input></realtime_delegation>',
    },
  })
  const record = parseTranscriptLine(line)
  assert.equal(record?.kind, 'message')
  assert.deepEqual(record?.kind === 'message' && record.blocks, [
    { shape: 'event', event: 'command', text: 'Review the Feed card.' },
  ])
})
