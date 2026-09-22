// The Codex Plan call as a rollout writes it, whole and nested, for the Plan reader's tests.
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createSessionReader } from '@/domains/sessions/main/observation/reader'
import { listed, tempRoot } from '@/domains/sessions/main/observation/reader-test-helpers'
import { codexSessionSource } from './read-sessions'

export const SESSION_ID = '01a0870e-f790-7fd0-984c-95e8686f1f0c'
export const TIMESTAMP = '2026-09-15T10:00:00.000Z'

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
export function planCall(callId: string, argumentsText: string) {
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

export function updatePlan(callId: string, plan: unknown[], explanation?: string) {
  return planCall(callId, JSON.stringify({ ...(explanation ? { explanation } : {}), plan }))
}

export function nestedPlanCall(input: string) {
  return [
    {
      timestamp: TIMESTAMP,
      type: 'response_item',
      payload: { type: 'custom_tool_call', name: 'exec', input, call_id: 'call-nested' },
    },
  ]
}

export async function planOf(context: Parameters<typeof tempRoot>[0], records: unknown[]) {
  const root = await tempRoot(context)
  const day = path.join(root, '2026', '09', '15')
  await mkdir(day, { recursive: true })
  const lines = [...opening(), ...records].map((record) => `${JSON.stringify(record)}\n`)
  await writeFile(path.join(day, `rollout-2026-09-15T10-00-00-${SESSION_ID}.jsonl`), lines.join(''))
  const reply = await listed(createSessionReader([codexSessionSource(root)]))
  return reply?.sessions.find((session) => session.id === SESSION_ID)?.plan
}
