// What a Harness's installed status hooks post to Argo: the payloads in each Harness's fixture,
// renamed to one Session, sent the way the hook's curl sends them.
import { request } from 'node:http'
import { readStatusHook } from '@/harnesses/host/status-hooks'
import type { ExternalSessionHooks } from '@/harnesses/registration'
import { recordedCodexHooks as codex } from '../recordings/codex-app-server.ts'
import claude from './claude/fixtures/hooks-claude-docs.json' with { type: 'json' }

export type HookHarness = 'claude' | 'codex'
type HookTurn = 'bashTurn' | 'questionTurn' | 'failureTurn'
export type PostedHook = { event: string; payload: Record<string, unknown> }

export const HOOK_FIXTURES = { claude, codex } as const

const turnsOf = (harness: HookHarness) =>
  HOOK_FIXTURES[harness] as unknown as Partial<Record<HookTurn, PostedHook[]>>

// Every event a Harness's fixture Turns send.
export const recordedHookEvents = (harness: HookHarness) => [
  ...new Set(
    Object.values(turnsOf(harness))
      .filter((turn) => Array.isArray(turn))
      .flatMap((turn) => turn.map(({ event }) => event)),
  ),
]

// One fixture Turn's events in order, each naming `nativeId`.
export function hookTurn(harness: HookHarness, turn: HookTurn, nativeId: string): PostedHook[] {
  const events = turnsOf(harness)[turn]
  if (events === undefined) throw new Error(`No ${turn} in the ${harness} fixture.`)
  return events.map(({ event, payload }) => ({
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

// Posts one payload to the receiver's socket as the installed hook command does; returns the
// HTTP status.
export function postHook(socketPath: string, harness: string, payload: unknown): Promise<number> {
  return new Promise((resolve, reject) => {
    const sent = request({ socketPath, method: 'POST', path: `/h/${harness}` }, (response) => {
      response.resume()
      resolve(response.statusCode ?? 0)
    })
    sent.on('error', reject)
    sent.end(typeof payload === 'string' ? payload : JSON.stringify(payload))
  })
}

// What each event of a fixture Turn reads as: the event, its status and its activity line.
export function hookReadings(harness: HookHarness, hooks: ExternalSessionHooks, turn: HookTurn) {
  return hookTurn(harness, turn, 'session-1').map(({ event, payload }) => {
    const reading = readStatusHook(hooks, payload)
    return [event, reading?.status, reading?.activity?.label ?? null]
  })
}
