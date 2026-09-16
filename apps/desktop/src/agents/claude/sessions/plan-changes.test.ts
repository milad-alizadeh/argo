import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import type { PlanEntryStatus, SessionPlan } from '@/core/sessions/models'
import { createSessionReader } from '@/core/sessions/reader'
import { listed, tempRoot } from '@/core/sessions/reader-test-helpers'
import { claudeSessionSource } from './read-sessions'

const SESSION_ID = 'plan-session'
const TIMESTAMP = '2026-09-15T10:00:00.000Z'

function call(id: string, name: string, input: Record<string, unknown>) {
  const content = [{ type: 'tool_use', id, name, input }]
  return { type: 'assistant', uuid: `call-${id}`, timestamp: TIMESTAMP, message: { content } }
}

function result(id: string, reply: { content: string; toolUseResult: unknown; failed?: boolean }) {
  const { content, toolUseResult, failed = false } = reply
  return {
    type: 'user',
    uuid: `result-${id}`,
    timestamp: TIMESTAMP,
    toolUseResult,
    message: { content: [{ type: 'tool_result', tool_use_id: id, content, is_error: failed }] },
  }
}

function createCall(id: string, subject: string) {
  return call(id, 'TaskCreate', { subject, description: `Why ${subject}`, activeForm: subject })
}

// TaskCreate's result as the CLI writes it: the sentence the model reads, and the id beside it.
function created(id: string, taskId: string, subject: string) {
  return result(id, {
    content: `Task #${taskId} created successfully: ${subject}`,
    toolUseResult: { task: { id: taskId, subject } },
  })
}

function create(id: string, taskId: string, subject: string) {
  return [createCall(id, subject), created(id, taskId, subject)]
}

function update(id: string, input: Record<string, unknown>) {
  const toolUseResult = { success: true, taskId: input.taskId, updatedFields: ['status'] }
  return [call(id, 'TaskUpdate', input), result(id, { content: 'Updated task', toolUseResult })]
}

async function planOf(context: Parameters<typeof tempRoot>[0], records: unknown[]) {
  const root = await tempRoot(context)
  await mkdir(path.join(root, 'project-one'))
  const lines = records.map((record) => `${JSON.stringify(record)}\n`)
  await writeFile(path.join(root, 'project-one', `${SESSION_ID}.jsonl`), lines.join(''))
  const reply = await listed(createSessionReader([claudeSessionSource({ transcripts: root })]))
  return reply?.sessions.find((session) => session.id === SESSION_ID)?.plan
}

function available(...entries: [string, PlanEntryStatus][]): SessionPlan {
  return {
    state: 'available',
    entries: entries.map(([content, status], position) => ({ content, position, status })),
  }
}

const cases: { claim: string; records: unknown[]; plan: SessionPlan | null }[] = [
  {
    claim: 'rebuilds the Plan from each task created and every update to it',
    records: [
      ...create('create-1', '1', 'Read the rail'),
      ...create('create-2', '2', 'Draw the dots'),
      ...create('create-3', '3', 'Count the running'),
      ...update('update-1', { taskId: '1', status: 'in_progress' }),
      ...update('update-2', { taskId: '1', status: 'completed' }),
      ...update('update-3', { taskId: '2', status: 'in_progress', subject: 'Draw the bars' }),
    ],
    plan: available(
      ['Read the rail', 'completed'],
      ['Draw the bars', 'in_progress'],
      ['Count the running', 'pending'],
    ),
  },
  {
    claim: 'drops a deleted task from the Plan',
    records: [
      ...create('create-1', '1', 'Read the rail'),
      ...create('create-2', '2', 'Draw the dots'),
      ...update('update-1', { taskId: '1', status: 'deleted' }),
    ],
    plan: available(['Draw the dots', 'pending']),
  },
  {
    claim: 'adds tasks created side by side in the order their results came back',
    records: [
      createCall('create-1', 'Read the rail'),
      createCall('create-2', 'Draw the dots'),
      created('create-2', '1', 'Draw the dots'),
      created('create-1', '2', 'Read the rail'),
    ],
    plan: available(['Draw the dots', 'pending'], ['Read the rail', 'pending']),
  },
  {
    claim: 'holds no Plan while the only task creation has not come back',
    records: [createCall('create-1', 'Read the rail')],
    plan: null,
  },
  {
    claim: 'adds no task whose creation failed',
    records: [
      ...create('create-1', '1', 'Read the rail'),
      createCall('create-2', 'Draw the dots'),
      result('create-2', { content: 'Error: no task list', toolUseResult: 'Error', failed: true }),
    ],
    plan: available(['Read the rail', 'pending']),
  },
  {
    claim: 'marks the Plan unreadable when an update names a status it does not know',
    records: [
      ...create('create-1', '1', 'Read the rail'),
      ...update('update-1', { taskId: '1', status: 'blocked' }),
    ],
    plan: { state: 'malformed' },
  },
  {
    claim: 'marks the Plan unreadable when the newest TodoWrite entry has no status',
    records: [
      call('todo-1', 'TodoWrite', { todos: [{ content: 'Read the rail', status: 'pending' }] }),
      call('todo-2', 'TodoWrite', { todos: [{ content: 'No status' }] }),
    ],
    plan: { state: 'malformed' },
  },
  {
    claim: 'holds no Plan for a Session that never wrote one',
    records: [call('read-1', 'Read', { file_path: '/Users/x/proj/README.md' })],
    plan: null,
  },
]

for (const { claim, records, plan } of cases) {
  test(claim, async (context) => {
    assert.deepEqual(await planOf(context, records), plan)
  })
}
