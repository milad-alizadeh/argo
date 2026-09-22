// The Session's current Plan (CONTEXT.md L3 · Plan), replayed from the changes each adapter read
// off its Harness's records. Shared code knows the changes, never the tools that wrote them.

import {
  PLAN_ENTRY_STATUSES,
  type SessionPlan,
  type SessionPlanEntry,
} from '@/domains/sessions/contract/model/models'
import type { TranscriptRecord } from '@/domains/sessions/contract/model/transcript/transcript'
import type { PlanChange } from '@/domains/sessions/contract/model/transcript/transcript-plan'

type PlanStep = Omit<SessionPlanEntry, 'position'>

type PlanReplay = {
  seen: boolean
  readable: boolean
  steps: Map<string, PlanStep>
  adding: Map<string, string>
}

export function readPlanStatus(value: unknown): PlanStep['status'] | null {
  return PLAN_ENTRY_STATUSES.find((status) => status === value) ?? null
}

function readStep(item: { content: unknown; status: unknown }): PlanStep | null {
  const status = readPlanStatus(item.status)
  if (typeof item.content !== 'string' || item.content.trim().length === 0 || status === null) {
    return null
  }
  return { content: item.content, status }
}

// A whole list the Harness wrote at once. One unreadable entry makes the whole write unreadable.
export function readPlanSnapshot(items: { content: unknown; status: unknown }[]): PlanChange {
  const steps = items.map(readStep)
  return steps.every((step) => step !== null)
    ? { kind: 'replace', entries: steps }
    : { kind: 'unreadable' }
}

function applyChange(plan: PlanReplay, change: PlanChange): PlanReplay {
  switch (change.kind) {
    case 'replace':
      plan.seen = true
      plan.readable = true
      // Keyed apart from any id a Harness names, so a later keyed change cannot reach a replaced step.
      plan.steps = new Map(change.entries.map((entry, index) => [`snapshot:${index}`, entry]))
      return plan
    case 'unreadable':
      // Keeping an earlier step would report stale work as current.
      plan.seen = true
      plan.readable = false
      plan.steps = new Map()
      return plan
    case 'add':
      plan.adding.set(change.callId, change.content)
      return plan
    case 'added': {
      const content = plan.adding.get(change.callId)
      if (content === undefined) return plan
      plan.seen = true
      plan.readable = true
      plan.steps.set(change.key, {
        content,
        status: plan.steps.get(change.key)?.status ?? 'pending',
      })
      return plan
    }
    case 'update': {
      const step = plan.steps.get(change.key)
      if (step === undefined) return plan
      plan.steps.set(change.key, {
        content: change.content ?? step.content,
        status: change.status ?? step.status,
      })
      return plan
    }
    case 'remove':
      plan.steps.delete(change.key)
      return plan
    default:
      return change satisfies never
  }
}

function planChanges(records: TranscriptRecord[]): PlanChange[] {
  return records.flatMap((record) => {
    if (record.kind === 'plan') return record.changes
    return record.kind === 'message' && !record.sidechain ? (record.planChanges ?? []) : []
  })
}

// Every change replays in the order it was written, so a Plan built one step at a time and one
// written whole read the same. A Session whose records change no Plan has none.
export function readPlan(records: TranscriptRecord[]): SessionPlan | null {
  const plan = planChanges(records).reduce(applyChange, {
    seen: false,
    readable: true,
    steps: new Map(),
    adding: new Map(),
  })
  if (!plan.seen) return null
  if (!plan.readable) return { state: 'malformed' }
  return {
    state: 'available',
    entries: [...plan.steps.values()].map((step, position) => ({ ...step, position })),
  }
}
