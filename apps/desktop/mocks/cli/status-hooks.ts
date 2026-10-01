// What a Harness's installed status hooks post to Argo: the payloads in each Harness's fixture,
// renamed to one Session, sent the way the hook's curl sends them.
import claude from './claude/fixtures/hooks-claude-docs.json' with { type: 'json' }
import codex from './codex/fixtures/hooks-codex-0.157.0.json' with { type: 'json' }

type HookHarness = 'claude' | 'codex'
type HookTurn = 'bashTurn' | 'questionTurn'
export type PostedHook = { event: string; payload: Record<string, unknown> }

const FIXTURES = { claude, codex } as const

// The events and the entry the issue specifies an install writes, as a test expects them.
export const EXPECTED_HOOK_EVENTS = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PermissionRequest',
  'PostToolUse',
  'Stop',
  'SessionEnd',
]
export const expectedHookGroup = (harness: HookHarness, port: number, event: string) => ({
  hooks: [
    {
      type: 'command',
      command: `curl -s -m 1 --data-binary @- http://127.0.0.1:${port}/h/${harness}/${event} || true`,
      async: true,
    },
  ],
})

// One fixture Turn's events in order, each naming `nativeId`.
export function hookTurn(harness: HookHarness, turn: HookTurn, nativeId: string): PostedHook[] {
  return FIXTURES[harness][turn].map(({ event, payload }) => ({
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
