// The status hooks Argo installs in a Harness's user-level config, in the `hooks` table shape both
// Harnesses share: each event names a list of matcher groups. The adapter supplies the storage, the
// group shape and its tool names; the install, the removal and the reading are the same for all.
import { isDeepStrictEqual } from 'node:util'
import { z } from 'zod'
import { commandActivityLabel, type LiveActivity } from '@/domains/sessions/api/feed-activity'
import type { Harness } from '@/harnesses/harness'
import type { ExternalSessionHooks, ExternalSessionStatus } from '@/harnesses/registration'

// The events Argo installs, each seen firing from both CLIs (#2976), and the status each sets; null
// leaves the status as it is.
const EVENT_STATUS = {
  SessionStart: null,
  UserPromptSubmit: 'running',
  PreToolUse: 'running',
  PermissionRequest: 'permission',
  PostToolUse: 'running',
  Stop: 'idle',
  SessionEnd: 'idle',
} as const satisfies Record<string, ExternalSessionStatus | null>
export type StatusHookEvent = keyof typeof EVENT_STATUS
export const STATUS_HOOK_EVENTS = Object.keys(EVENT_STATUS) as StatusHookEvent[]
export const isStatusHookEvent = (name: string): name is StatusHookEvent =>
  Object.hasOwn(EVENT_STATUS, name)

// What one hook event says about a Session; a null activity keeps the stored line.
export type ExternalHookReading = {
  nativeId: string
  status: ExternalSessionStatus | null
  activity: LiveActivity | null
}

// Each event list an install or a removal changes; null deletes the event.
export type HookTableChanges = Map<StatusHookEvent, unknown[] | null>

const hookTableSchema = z.looseObject(
  Object.fromEntries(STATUS_HOOK_EVENTS.map((event) => [event, z.array(z.unknown()).optional()])),
)
type HookTable = Partial<Record<StatusHookEvent, unknown[]>>

// A table Argo cannot read throws, so nothing is written over it.
async function openTable(hooks: ExternalSessionHooks) {
  const { table, write } = await hooks.open()
  const parsed = (table === undefined ? {} : hookTableSchema.parse(table)) as HookTable
  return { parsed, write }
}

// An async command hook: the CLI does not wait for it, and curl fails quietly when Argo is closed.
const hookCommand = (harness: Harness, port: number, event: StatusHookEvent) =>
  `curl -s -m 1 --data-binary @- http://127.0.0.1:${port}/h/${harness}/${event} || true`

// Reads the port an Argo group of `event` names, or null for a group Argo did not write.
const argoPortOf =
  (hooks: ExternalSessionHooks, harness: Harness, event: StatusHookEvent) =>
  (group: unknown): number | null => {
    const named = new RegExp(`127\\.0\\.0\\.1:(\\d+)/h/${harness}/${event} `).exec(
      JSON.stringify(group),
    )?.[1]
    if (named === undefined) return null
    const port = Number(named)
    return isDeepStrictEqual(group, hooks.group(hookCommand(harness, port, event))) ? port : null
  }

// Writes the event lists `next` returns; undefined leaves an event as it is.
async function change(
  hooks: ExternalSessionHooks,
  next: (event: StatusHookEvent, groups: unknown[]) => unknown[] | null | undefined,
): Promise<void> {
  const { parsed, write } = await openTable(hooks)
  const changes: HookTableChanges = new Map()
  for (const event of STATUS_HOOK_EVENTS) {
    const groups = next(event, parsed[event] ?? [])
    if (groups !== undefined) changes.set(event, groups)
  }
  if (changes.size > 0) await write(changes)
}

// Appends Argo's group to each event, or rewrites it where it stands when it names another port.
export function installStatusHooks(
  harness: Harness,
  hooks: ExternalSessionHooks,
  port: number,
): Promise<void> {
  return change(hooks, (event, groups) => {
    const argoPort = argoPortOf(hooks, harness, event)
    const group = hooks.group(hookCommand(harness, port, event))
    const index = groups.findIndex((each) => argoPort(each) !== null)
    if (index === -1) return [...groups, group]
    return argoPort(groups[index]) === port ? undefined : groups.with(index, group)
  })
}

// Drops exactly Argo's groups; an event left with no group is deleted.
export function removeStatusHooks(harness: Harness, hooks: ExternalSessionHooks): Promise<void> {
  return change(hooks, (event, groups) => {
    const kept = groups.filter((each) => argoPortOf(hooks, harness, event)(each) === null)
    if (kept.length === groups.length) return undefined
    return kept.length === 0 ? null : kept
  })
}

// The port the installed hooks name, or null when none are installed.
export async function installedStatusHookPort(
  harness: Harness,
  hooks: ExternalSessionHooks,
): Promise<number | null> {
  const { parsed } = await openTable(hooks)
  for (const event of STATUS_HOOK_EVENTS)
    for (const group of parsed[event] ?? []) {
      const port = argoPortOf(hooks, harness, event)(group)
      if (port !== null) return port
    }
  return null
}

const payloadSchema = z.looseObject({
  session_id: z.string().min(1),
  tool_name: z.string().min(1).optional(),
  tool_input: z.unknown().optional(),
})
const TOOL_EVENTS: ReadonlySet<StatusHookEvent> = new Set(['PreToolUse', 'PermissionRequest'])

// The activity tool shows its description, else its command; any other tool shows its name.
function toolActivity(
  { name, input }: ExternalSessionHooks['activityTool'],
  toolName: string,
  toolInput: unknown,
): LiveActivity {
  const command = toolName === name ? input.safeParse(toolInput).data : undefined
  if (command?.description !== undefined)
    return { label: command.description, kind: 'command', open: true }
  if (command?.command !== undefined)
    return { label: commandActivityLabel(command.command), kind: 'command', open: true }
  return { label: toolName, kind: 'tool', open: true }
}

// One posted payload, or null for a shape the hooks do not send. A tool event names its tool, and
// the question tool shows asking; only PreToolUse of another tool sets the activity line.
export function readStatusHook(
  hooks: ExternalSessionHooks,
  event: StatusHookEvent,
  payload: unknown,
): ExternalHookReading | null {
  const parsed = payloadSchema.safeParse(payload)
  if (!parsed.success) return null
  const { session_id: nativeId, tool_name: toolName, tool_input: toolInput } = parsed.data
  if (!TOOL_EVENTS.has(event)) return { nativeId, status: EVENT_STATUS[event], activity: null }
  if (toolName === undefined) return null
  if (toolName === hooks.questionTool) return { nativeId, status: 'asking', activity: null }
  const activity =
    event === 'PreToolUse' ? toolActivity(hooks.activityTool, toolName, toolInput) : null
  return { nativeId, status: EVENT_STATUS[event], activity }
}
