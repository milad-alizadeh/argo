// Codex writes its Plan (CONTEXT.md L3 · Plan) whole, as an `update_plan` function call whose
// JSON arguments are `{ explanation?, plan: [{ step, status }] }`. The `Plan` item a turn completes
// is plan mode's written proposal, not this list, so it is not read here.

import {
  JAVASCRIPT_IDENTIFIER_SOURCE,
  nextQuotedState,
  openedQuote,
  type Quote,
} from '@/agents/codex/sessions/javascript-string'
import {
  arrayAssignedTo,
  codeMatch,
  nestedToolCall,
} from '@/agents/codex/sessions/nested-tool-call'
import type { PlanChange, TranscriptRecord } from '@/domains/sessions/contract/model/transcript'
import { readPlanSnapshot } from '@/domains/sessions/main/projection/plan'
import { isRecord } from '@/shared/validation'

const PLAN_FUNCTION = 'update_plan'

const OBJECT_KEY = new RegExp(`^(${JAVASCRIPT_IDENTIFIER_SOURCE})(\\s*:)`)

function jsonObjectKeys(value: string): string {
  let json = ''
  let quote: Quote | null = null
  let escaped = false
  for (let index = 0; index < value.length; index += 1) {
    const character = value.charAt(index)
    if (quote !== null) {
      const nextState = nextQuotedState(character, quote, escaped)
      quote = nextState.quote
      escaped = nextState.escaped
      json += character
      continue
    }
    quote = openedQuote(character)
    const key = quote === null ? OBJECT_KEY.exec(value.slice(index)) : null
    if (key?.[1] !== undefined && key[2] !== undefined) {
      json += `${JSON.stringify(key[1])}${key[2]}`
      index += key[0].length - 1
      continue
    }
    json += character
  }
  return json
}

function readArguments(value: unknown): unknown {
  if (typeof value !== 'string') return null
  try {
    return JSON.parse(jsonObjectKeys(value))
  } catch {
    return null
  }
}

function planArguments(payload: Record<string, unknown>): string | null {
  if (payload.type === 'function_call' && payload.name === PLAN_FUNCTION)
    return typeof payload.arguments === 'string' ? payload.arguments : ''
  if (payload.type !== 'custom_tool_call' || payload.name !== 'exec') return null
  if (typeof payload.input !== 'string') return null
  const nested = nestedToolCall(payload.input)
  return nested?.name === PLAN_FUNCTION
    ? inlinePlanVariable(payload.input, nested.argumentsText)
    : null
}

// A script that builds the list first passes it by name: `{plan}` or `{explanation, plan: plan}`.
const PLAN_BY_NAME = /(?<=[{,]\s*)plan(?:\s*:\s*plan)?(?=\s*[,}])/y

function inlinePlanVariable(script: string, argumentsText: string): string {
  const byName = codeMatch(argumentsText, PLAN_BY_NAME)
  const plan = byName === null ? null : arrayAssignedTo(script, 'plan')
  if (byName === null || plan === null) return argumentsText
  const end = byName.index + byName[0].length
  return `${argumentsText.slice(0, byName.index)}plan: ${plan}${argumentsText.slice(end)}`
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
  const argumentsText = planArguments(payload)
  return argumentsText === null
    ? null
    : { kind: 'plan', changes: [readPlanArguments(argumentsText)] }
}
