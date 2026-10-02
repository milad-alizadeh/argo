// The status hooks Argo installs in a Harness's user-level config, in the `hooks` table shape both
// Harnesses share: each event names a list of matcher groups. The adapter supplies the storage, the
// group shape and its tool names; the install, the removal and the reading are the same for all.
import { existsSync } from 'node:fs'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { z } from 'zod'
import { commandActivityLabel, type LiveActivity } from '@/domains/sessions/api/feed-activity'
import type { Harness } from '@/harnesses/harness'
import type { ExternalSessionHooks, ExternalSessionStatus } from '@/harnesses/registration'

// The events Argo can install and the status each sets; null leaves the status as it is. Each
// adapter names the ones its CLI sends. A failed tool or Turn ends a permission prompt too.
const EVENT_STATUS = {
  SessionStart: null,
  UserPromptSubmit: 'running',
  PreToolUse: 'running',
  PermissionRequest: 'permission',
  PermissionDenied: 'running',
  PostToolUse: 'running',
  PostToolUseFailure: 'running',
  Stop: 'idle',
  StopFailure: 'idle',
  SessionEnd: 'idle',
} as const satisfies Record<string, ExternalSessionStatus | null>
export type StatusHookEvent = keyof typeof EVENT_STATUS
export const STATUS_HOOK_EVENTS = Object.keys(EVENT_STATUS) as StatusHookEvent[]

// What one hook event says about a Session; a null activity keeps the stored line.
export type ExternalHookReading = {
  event: StatusHookEvent
  nativeId: string
  status: ExternalSessionStatus | null
  activity: LiveActivity | null
}

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
// The socket path is quoted for the shell, since macOS's app data folder has a space in it.
const hookCommand = (harness: Harness, socketPath: string) =>
  `curl -s -m 1 --unix-socket '${socketPath.replaceAll("'", `'\\''`)}' --data-binary @- http://localhost/h/${harness} || true`

// Writes the event lists `next` returns; undefined leaves an event as it is.
async function change(
  hooks: ExternalSessionHooks,
  next: (event: StatusHookEvent, groups: unknown[]) => unknown[] | null | undefined,
): Promise<void> {
  const { parsed, write } = await openTable(hooks)
  const changes = new Map<StatusHookEvent, unknown[] | null>()
  for (const event of STATUS_HOOK_EVENTS) {
    const groups = next(event, parsed[event] ?? [])
    if (groups !== undefined) changes.set(event, groups)
  }
  if (changes.size > 0) await write(changes)
}

// What `change` writes for an event: undefined when nothing moved, null when no group is left.
const settle = (before: unknown[], after: unknown[]) => {
  if (isDeepStrictEqual(before, after)) return undefined
  return after.length === 0 ? null : after
}

// Drops the trailing groups `removable` names. A Harness may key hook trust by group position
// (#3066), so a group before a kept one stays put.
function trimTail(groups: unknown[], removable: (group: unknown) => boolean): unknown[] {
  let end = groups.length
  while (end > 0 && removable(groups[end - 1])) end -= 1
  return groups.slice(0, end)
}

const commandGroupSchema = z.object({ hooks: z.tuple([z.looseObject({ command: z.string() })]) })
const SOCKET_COMMAND =
  /^curl -s -m 1 --unix-socket '((?:[^']|'\\'')*)' --data-binary @- http:\/\/localhost\/h\/[a-z]+ \|\| true$/

// An Argo group of any launch whose app data folder is gone, so no Argo will listen on it again.
function isOrphanGroup(harness: Harness, hooks: ExternalSessionHooks, group: unknown): boolean {
  const command = commandGroupSchema.safeParse(group).data?.hooks[0].command ?? ''
  const socket = SOCKET_COMMAND.exec(command)?.[1]?.replaceAll(`'\\''`, "'")
  if (socket === undefined) return false
  const argo = isDeepStrictEqual(group, hooks.group(hookCommand(harness, socket)))
  return argo && !existsSync(path.dirname(socket))
}

// The command Argo wrote before #3022, which posted every payload to a TCP port other dev servers use.
const portCommand = (harness: Harness, event: StatusHookEvent) =>
  `curl -s -m 1 --data-binary @- http://127.0.0.1:4321/h/${harness}/${event} || true`

// Puts Argo's group in each event the adapter names that lacks it: in the first orphan's place,
// else at the end. Trailing orphans go, and so does every port group, since it leaks payloads.
export function installStatusHooks(
  harness: Harness,
  hooks: ExternalSessionHooks,
  socketPath: string,
): Promise<void> {
  const group = hooks.group(hookCommand(harness, socketPath))
  return change(hooks, (event, groups) => {
    const port = hooks.group(portCommand(harness, event))
    const isPort = (each: unknown) => isDeepStrictEqual(each, port)
    const own = (each: unknown) => isDeepStrictEqual(each, group)
    const orphan = (each: unknown) =>
      !own(each) && (isPort(each) || isOrphanGroup(harness, hooks, each))
    const next = [...groups]
    if (hooks.events.includes(event) && !next.some(own)) {
      const slot = next.findIndex(orphan)
      if (slot === -1) next.push(group)
      else next[slot] = group
    }
    return settle(
      groups,
      trimTail(
        next.filter((each) => !isPort(each)),
        orphan,
      ),
    )
  })
}

// Drops exactly Argo's groups; an event left with no group is deleted.
export function removeStatusHooks(
  harness: Harness,
  hooks: ExternalSessionHooks,
  socketPath: string,
): Promise<void> {
  const group = hooks.group(hookCommand(harness, socketPath))
  return change(hooks, (_event, groups) =>
    settle(
      groups,
      groups.filter((each) => !isDeepStrictEqual(each, group)),
    ),
  )
}

const payloadSchema = z.looseObject({
  session_id: z.string().min(1),
  hook_event_name: z.enum(STATUS_HOOK_EVENTS),
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
  payload: unknown,
): ExternalHookReading | null {
  const parsed = payloadSchema.safeParse(payload)
  if (!parsed.success) return null
  const { hook_event_name: event, session_id: nativeId } = parsed.data
  const { tool_name: toolName, tool_input: toolInput } = parsed.data
  if (!TOOL_EVENTS.has(event))
    return { event, nativeId, status: EVENT_STATUS[event], activity: null }
  if (toolName === undefined) return null
  if (toolName === hooks.questionTool) return { event, nativeId, status: 'asking', activity: null }
  const activity =
    event === 'PreToolUse' ? toolActivity(hooks.activityTool, toolName, toolInput) : null
  return { event, nativeId, status: EVENT_STATUS[event], activity }
}
