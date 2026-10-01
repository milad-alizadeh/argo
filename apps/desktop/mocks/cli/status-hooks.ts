// What a Harness's installed status hooks post to Argo: the payloads in each Harness's fixture,
// renamed to one Session, sent the way the hook's curl sends them.
import { readStatusHook, type StatusHookEvent } from '@/harnesses/host/status-hooks'
import type { ExternalSessionHooks } from '@/harnesses/registration'
import claude from './claude/fixtures/hooks-claude-docs.json' with { type: 'json' }
import codex from './codex/fixtures/hooks-codex-0.157.0.json' with { type: 'json' }

export type HookHarness = 'claude' | 'codex'
type HookTurn = 'bashTurn' | 'questionTurn'
export type PostedHook = { event: string; payload: Record<string, unknown> }

export const HOOK_FIXTURES = { claude, codex } as const

// One fixture Turn's events in order, each naming `nativeId`.
export function hookTurn(harness: HookHarness, turn: HookTurn, nativeId: string): PostedHook[] {
  return HOOK_FIXTURES[harness][turn].map(({ event, payload }) => ({
    event,
    payload: { ...structuredClone(payload), session_id: nativeId },
  }))
}

// The recorded Bash Turn's event, naming `nativeId`.
export function hookEvent(harness: HookHarness, event: string, nativeId: string): PostedHook {
  const found = hookTurn(harness, 'bashTurn', nativeId).find((each) => each.event === event)
  if (found === undefined) throw new Error(`No ${event} in the ${harness} Bash Turn.`)
  return found
}

// Posts one payload to the receiver as the installed hook command does; returns the HTTP status.
export async function postHook(
  port: number,
  harness: string,
  { event, payload }: { event: string; payload: unknown },
): Promise<number> {
  const response = await fetch(`http://127.0.0.1:${port}/h/${harness}/${event}`, {
    method: 'POST',
    body: typeof payload === 'string' ? payload : JSON.stringify(payload),
  })
  return response.status
}

// What each event of a fixture Turn reads as: the event, its status and its activity line.
export function hookReadings(harness: HookHarness, hooks: ExternalSessionHooks, turn: HookTurn) {
  return hookTurn(harness, turn, 'session-1').map(({ event, payload }) => {
    const reading = readStatusHook(hooks, event as StatusHookEvent, payload)
    return [event, reading?.status, reading?.activity?.label ?? null]
  })
}
