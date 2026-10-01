// The status hooks Argo installs in a Harness's user-level config, in the `hooks` table shape both
// Harnesses share: each event names a list of matcher groups, each with a list of handlers.
import { z } from 'zod'
import { commandActivityLabel, type LiveActivity } from '@/domains/sessions/api/feed-activity'
import type { Harness } from '@/harnesses/harness'
import type { ExternalHookReading } from '@/harnesses/registration'

// The events both Harnesses name alike; each was seen firing from its CLI (#2976).
const STATUS_HOOK_EVENTS = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PermissionRequest',
  'PostToolUse',
  'Stop',
  'SessionEnd',
] as const
export const statusHookEventSchema = z.enum(STATUS_HOOK_EVENTS)
export type StatusHookEvent = z.infer<typeof statusHookEventSchema>

// Each event list an install or a removal changes; null deletes the event.
export type HookTableChanges = Map<StatusHookEvent, unknown[] | null>

const hookTableSchema = z.looseObject(
  Object.fromEntries(STATUS_HOOK_EVENTS.map((event) => [event, z.array(z.unknown()).optional()])),
)
type HookTable = Partial<Record<StatusHookEvent, unknown[]>>

// A table Argo cannot read throws, so nothing is written over it.
function parseHookTable(table: unknown): HookTable {
  return table === undefined ? {} : (hookTableSchema.parse(table) as HookTable)
}

// An async command hook: the CLI does not wait for it, and curl fails quietly when Argo is closed.
const hookCommand = (harness: Harness, port: number, event: StatusHookEvent) =>
  `curl -s -m 1 --data-binary @- http://127.0.0.1:${port}/h/${harness}/${event} || true`

const argoGroup = (harness: Harness, port: number, event: StatusHookEvent) => ({
  hooks: [{ type: 'command', command: hookCommand(harness, port, event), async: true }],
})

const singleCommandGroupSchema = z.looseObject({
  hooks: z.tuple([z.looseObject({ type: z.literal('command'), command: z.string() })]),
})

// The port an Argo group names, or null for a group Argo did not write.
function argoPort(group: unknown, harness: Harness, event: StatusHookEvent): number | null {
  const parsed = singleCommandGroupSchema.safeParse(group)
  if (!parsed.success) return null
  const { command } = parsed.data.hooks[0]
  const port = /^curl -s -m 1 --data-binary @- http:\/\/127\.0\.0\.1:(\d+)\//.exec(command)?.[1]
  if (port === undefined) return null
  return command === hookCommand(harness, Number(port), event) ? Number(port) : null
}

// Appends Argo's group to each event, or rewrites it where it stands when it names another port.
export function installHooks(table: unknown, harness: Harness, port: number): HookTableChanges {
  const parsed = parseHookTable(table)
  const changes: HookTableChanges = new Map()
  for (const event of STATUS_HOOK_EVENTS) {
    const groups = parsed[event] ?? []
    const index = groups.findIndex((group) => argoPort(group, harness, event) !== null)
    const group = argoGroup(harness, port, event)
    if (index === -1) changes.set(event, [...groups, group])
    else if (argoPort(groups[index], harness, event) !== port)
      changes.set(event, groups.with(index, group))
  }
  return changes
}

// Drops Argo's groups; an event left with no group is deleted.
export function removeHooks(table: unknown, harness: Harness): HookTableChanges {
  const parsed = parseHookTable(table)
  const changes: HookTableChanges = new Map()
  for (const event of STATUS_HOOK_EVENTS) {
    const groups = parsed[event] ?? []
    const kept = groups.filter((group) => argoPort(group, harness, event) === null)
    if (kept.length < groups.length) changes.set(event, kept.length === 0 ? null : kept)
  }
  return changes
}

export function installedHookPort(table: unknown, harness: Harness): number | null {
  const parsed = parseHookTable(table)
  for (const event of STATUS_HOOK_EVENTS)
    for (const group of parsed[event] ?? []) {
      const port = argoPort(group, harness, event)
      if (port !== null) return port
    }
  return null
}

// The tool a Harness asks the person a question through, and the event that shows it waiting.
export type QuestionHook = { event: 'PreToolUse' | 'PermissionRequest'; toolName: string }

const payloadSchema = z.looseObject({
  session_id: z.string().min(1),
  tool_name: z.string().min(1).optional(),
  tool_input: z.looseObject({}).optional(),
})
const bashInputSchema = z.looseObject({
  command: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
})

// Bash shows its description, else its command; any other tool shows its name.
function toolActivity(toolName: string, toolInput: unknown): LiveActivity {
  const bash = toolName === 'Bash' ? bashInputSchema.safeParse(toolInput).data : undefined
  if (bash?.description !== undefined)
    return { label: bash.description, kind: 'command', open: true }
  if (bash?.command !== undefined)
    return { label: commandActivityLabel(bash.command), kind: 'command', open: true }
  return { label: toolName, kind: 'tool', open: true }
}

// The status one event sets; a tool event's question shows asking.
function eventStatus(event: StatusHookEvent, asks: boolean): ExternalHookReading['status'] {
  switch (event) {
    case 'SessionStart':
      return null
    case 'UserPromptSubmit':
    case 'PostToolUse':
      return 'running'
    case 'PreToolUse':
      return asks ? 'asking' : 'running'
    case 'PermissionRequest':
      return asks ? 'asking' : 'permission'
    case 'Stop':
    case 'SessionEnd':
      return 'idle'
    default:
      return event satisfies never
  }
}

const TOOL_EVENTS: readonly StatusHookEvent[] = ['PreToolUse', 'PermissionRequest']

// Reads one payload, the same way for every Harness but for where its question shows. A tool event
// names its tool; only PreToolUse of a tool other than the question sets the activity line.
export function statusHookReader(question: QuestionHook) {
  return (event: StatusHookEvent, payload: unknown): ExternalHookReading | null => {
    const parsed = payloadSchema.safeParse(payload)
    if (!parsed.success) return null
    const { session_id: nativeId, tool_name: toolName, tool_input: toolInput } = parsed.data
    if (TOOL_EVENTS.includes(event) && toolName === undefined) return null
    const asks = event === question.event && toolName === question.toolName
    const status = eventStatus(event, asks)
    const activity =
      event === 'PreToolUse' && !asks && toolName !== undefined
        ? toolActivity(toolName, toolInput)
        : null
    return { nativeId, status, activity }
  }
}
