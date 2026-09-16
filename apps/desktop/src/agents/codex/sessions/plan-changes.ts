// Codex writes its Plan (CONTEXT.md L3 · Plan) whole, as an `update_plan` function call whose
// JSON arguments are `{ explanation?, plan: [{ step, status }] }`. The `Plan` item a turn completes
// is plan mode's written proposal, not this list, so it is not read here.
import { isRecord } from '@/boundary'
import { readPlanSnapshot } from '@/core/sessions/plan'
import type { PlanChange, TranscriptRecord } from '@/core/sessions/transcript'

const PLAN_FUNCTION = 'update_plan'

function readArguments(value: unknown): unknown {
  if (typeof value !== 'string') return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function readPlanArguments(value: unknown): PlanChange {
  const parsed = readArguments(value)
  if (!isRecord(parsed) || !Array.isArray(parsed.plan)) return { kind: 'unreadable' }
  return readPlanSnapshot(
    parsed.plan
      .map((item) => (isRecord(item) ? item : {}))
      .map(({ step, status }) => ({
        content: step,
        status,
      })),
  )
}

export function readPlanCall(payload: Record<string, unknown>): TranscriptRecord | null {
  if (payload.type !== 'function_call' || payload.name !== PLAN_FUNCTION) return null
  return { kind: 'plan', changes: [readPlanArguments(payload.arguments)] }
}
