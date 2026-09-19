import type { SessionFeedRow } from './models'
import { patchOf, searchLabel } from './tool-changes'
import type { ToolCall } from './transcript'

type ToolRow = Extract<SessionFeedRow, { shape: 'tool' }>

export function displayedToolLabel(
  call: { kind: ToolRow['kind'] | 'thought'; label: string },
  active: boolean,
  running: string,
) {
  if (!active || (call.kind !== 'command' && call.kind !== 'tool')) return call.label
  const label = call.label.startsWith('Ran ') ? call.label.slice('Ran '.length) : call.label
  return `${running} ${label}`
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function commandLabel(call: ToolCall, commandKey: 'command' | 'cmd') {
  const suppliedLabel = text(call.input.label) ?? text(call.input.description)
  if (suppliedLabel !== null) return suppliedLabel
  const command = text(call.input[commandKey])?.split('\n')[0]
  return `Ran ${command ?? 'command'}`
}

export function commandText(call: ToolCall): string | null {
  if (call.name === 'Bash' && typeof call.input.command === 'string') return call.input.command
  if (call.name === 'exec_command' && typeof call.input.cmd === 'string') return call.input.cmd
  if (call.name === 'exec' && typeof call.input.cmd === 'string') return call.input.cmd
  return null
}

const TOOL_DETAILS = {
  Bash: (call: ToolCall) => ({
    kind: 'command' as const,
    label: commandLabel(call, 'command'),
  }),
  Edit: (call: ToolCall) => ({ kind: 'edited' as const, label: `Edited ${filePath(call)}` }),
  Read: (call: ToolCall) => ({ kind: 'read' as const, label: `Read ${filePath(call)}` }),
  Write: (call: ToolCall) => ({ kind: 'created' as const, label: `Created ${filePath(call)}` }),
  Skill: (call: ToolCall) => ({
    kind: 'skill' as const,
    label: typeof call.input.skill === 'string' ? skillTitle(call.input.skill) : 'Skill',
  }),
  exec_command: (call: ToolCall) => ({
    kind: 'command' as const,
    label: commandLabel(call, 'cmd'),
  }),
  exec: (call: ToolCall) => ({
    kind: 'command' as const,
    label: commandLabel(call, 'cmd'),
  }),
  web__run: (call: ToolCall) => ({ kind: 'searched' as const, label: searchLabel(call) }),
  apply_patch: (call: ToolCall) => {
    const change = patchOf(call)
    return change === null
      ? { kind: 'edited' as const, label: 'Edited file' }
      : { kind: change.kind, label: change.label }
  },
} as const

function skillTitle(slug: string): string {
  const words = slug.split('-').filter((word) => word.length > 0)
  const [first, ...rest] = words
  if (first === undefined) return slug
  return [`${first[0]?.toUpperCase()}${first.slice(1)}`, ...rest].join(' ')
}

function filePath(call: ToolCall) {
  const path = call.input.file_path
  if (typeof path !== 'string') return 'file'
  return path.split('/').findLast((segment) => segment.length > 0) ?? path
}

export function hasToolPresentation(call: ToolCall): boolean {
  return Object.hasOwn(TOOL_DETAILS, call.name)
}

export function toolPresentation(call: ToolCall) {
  return (
    TOOL_DETAILS[call.name as keyof typeof TOOL_DETAILS]?.(call) ?? {
      kind: 'tool' as const,
      label: text(call.input.title) ?? `Ran ${call.name}`,
    }
  )
}

const PATH_FIELDS = ['file_path', 'notebook_path', 'path']
const TEXT_FIELDS = ['pattern', 'description', 'command', 'cmd', 'url', 'query']

export function toolTarget(call: ToolCall): string | null {
  for (const field of PATH_FIELDS) {
    const path = text(call.input[field])
    if (path !== null) return path.split('/').findLast((segment) => segment.length > 0) ?? path
  }
  for (const field of TEXT_FIELDS) {
    const value = text(call.input[field])
    if (value !== null) return value.trim().split('\n', 1).join('')
  }
  return null
}

export function executableToolCall(call: ToolCall) {
  if (toolPresentation(call).kind !== 'command') return null
  const command = commandText(call)
  return {
    command: command === null ? null : command.trim().split('\n', 1).join(''),
    label: text(call.input.label) ?? text(call.input.description),
    background: call.input.run_in_background === true,
  }
}
