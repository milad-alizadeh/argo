import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import type { SessionPlan } from '@/core/sessions/models'
import { createSessionReader } from '@/core/sessions/reader'
import { listed, tempRoot } from '@/core/sessions/reader-test-helpers'
import { codexSessionSource } from './read-sessions'

const SESSION_ID = '01a0870e-f790-7fd0-984c-95e8686f1f0c'
const TIMESTAMP = '2026-09-15T10:00:00.000Z'

function opening() {
  return [
    { timestamp: TIMESTAMP, type: 'session_meta', payload: { id: SESSION_ID, cwd: '/tmp/proj' } },
    {
      timestamp: TIMESTAMP,
      type: 'event_msg',
      payload: { type: 'user_message', message: 'Plan the work.' },
    },
  ]
}

// The call as a rollout writes it: a `response_item` whose arguments are a JSON string.
function planCall(callId: string, argumentsText: string) {
  return [
    {
      timestamp: TIMESTAMP,
      type: 'response_item',
      payload: {
        type: 'function_call',
        name: 'update_plan',
        arguments: argumentsText,
        call_id: callId,
      },
    },
    {
      timestamp: TIMESTAMP,
      type: 'response_item',
      payload: { type: 'function_call_output', call_id: callId, output: 'Plan updated' },
    },
  ]
}

function updatePlan(callId: string, plan: unknown[], explanation?: string) {
  return planCall(callId, JSON.stringify({ ...(explanation ? { explanation } : {}), plan }))
}

function nestedPlanCall(input: string) {
  return [
    {
      timestamp: TIMESTAMP,
      type: 'response_item',
      payload: { type: 'custom_tool_call', name: 'exec', input, call_id: 'call-nested' },
    },
  ]
}

async function planOf(context: Parameters<typeof tempRoot>[0], records: unknown[]) {
  const root = await tempRoot(context)
  const day = path.join(root, '2026', '09', '15')
  await mkdir(day, { recursive: true })
  const lines = [...opening(), ...records].map((record) => `${JSON.stringify(record)}\n`)
  await writeFile(path.join(day, `rollout-2026-09-15T10-00-00-${SESSION_ID}.jsonl`), lines.join(''))
  const reply = await listed(createSessionReader([codexSessionSource(root)]))
  return reply?.sessions.find((session) => session.id === SESSION_ID)?.plan
}

const cases: { claim: string; records: unknown[]; plan: SessionPlan | null }[] = [
  {
    claim: 'reads the newest Plan the agent wrote whole',
    records: [
      ...updatePlan('call-1', [
        { step: 'Inspect the sync', status: 'in_progress' },
        { step: 'Update the backend', status: 'pending' },
      ]),
      ...updatePlan(
        'call-2',
        [
          { step: 'Inspect the sync', status: 'completed' },
          { step: 'Update the backend', status: 'in_progress' },
          { step: 'Update the frontend', status: 'pending' },
        ],
        'Backend first, then the hooks.',
      ),
    ],
    plan: {
      state: 'available',
      entries: [
        { content: 'Inspect the sync', position: 0, status: 'completed' },
        { content: 'Update the backend', position: 1, status: 'in_progress' },
        { content: 'Update the frontend', position: 2, status: 'pending' },
      ],
    },
  },
  {
    claim: 'drops a step the newest Plan no longer names',
    records: [
      ...updatePlan('call-1', [
        { step: 'Inspect the sync', status: 'completed' },
        { step: 'Update the backend', status: 'pending' },
      ]),
      ...updatePlan('call-2', [{ step: 'Inspect the sync', status: 'completed' }]),
    ],
    plan: {
      state: 'available',
      entries: [{ content: 'Inspect the sync', position: 0, status: 'completed' }],
    },
  },
  {
    claim: 'marks the Plan unreadable when a step has no status',
    records: updatePlan('call-1', [{ step: 'Inspect the sync' }]),
    plan: { state: 'malformed' },
  },
  {
    claim: "holds no Plan for plan mode's written proposal",
    records: [
      {
        timestamp: TIMESTAMP,
        type: 'event_msg',
        payload: {
          type: 'item_completed',
          thread_id: SESSION_ID,
          item: { type: 'Plan', id: 'turn-1-plan', text: '# Separate the icons' },
        },
      },
    ],
    plan: null,
  },
  {
    claim: 'marks the Plan unreadable when its arguments are not JSON',
    records: planCall('call-1', '{"plan":['),
    plan: { state: 'malformed' },
  },
  {
    claim: 'reads generated object keys without changing matching text inside a step',
    records: nestedPlanCall(
      'const r = await tools.update_plan({ plan: [{ step: "Review { plan: value }", status: "in_progress" }] });\ntext(r);',
    ),
    plan: {
      state: 'available',
      entries: [{ content: 'Review { plan: value }', position: 0, status: 'in_progress' }],
    },
  },
]

for (const { claim, records, plan } of cases) {
  test(claim, async (context) => {
    assert.deepEqual(await planOf(context, records), plan)
  })
}
