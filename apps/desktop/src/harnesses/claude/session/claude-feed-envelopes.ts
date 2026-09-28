import type { FeedContent } from '@/domains/sessions/api/feed-content'

export type RejectClaudeShape = (shape: string) => void

const delegationStatuses = {
  pending: 'pending',
  running: 'running',
  paused: 'paused',
  completed: 'completed',
  failed: 'failed',
  interrupted: 'interrupted',
} as const satisfies Record<string, Extract<FeedContent, { kind: 'delegation' }>['status']>

function field(value: string, name: string): string | null {
  return value.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1] ?? null
}

function wrapped(value: string, name: string): string | null {
  if (!value.startsWith(`<${name}>`) || !value.endsWith(`</${name}>`)) return null
  return field(value, name)
}

function taskNotification(id: string, value: string, reject: RejectClaudeShape): FeedContent {
  const taskId = field(value, 'task-id')
  const rawStatus = field(value, 'status')
  if (taskId === null || taskId === '') {
    reject('task-notification')
    return { id, kind: 'diagnostic', vendorType: 'task-notification', detail: 'Missing task ID.' }
  }
  let status: Extract<FeedContent, { kind: 'task' }>['status']
  switch (rawStatus) {
    case 'pending':
      status = 'pending'
      break
    case 'running':
      status = 'running'
      break
    case 'paused':
      status = 'paused'
      break
    case 'completed':
      status = 'completed'
      break
    case 'failed':
      status = 'failed'
      break
    case 'stopped':
    case 'killed':
      status = 'interrupted'
      break
    default:
      reject('task-notification-status')
      return {
        id,
        kind: 'diagnostic',
        vendorType: 'task-notification',
        detail: 'Unknown task status.',
      }
  }
  return {
    id,
    kind: 'task',
    taskId,
    callId: field(value, 'tool-use-id'),
    status,
    description: null,
    summary: field(value, 'summary') ?? field(value, 'result'),
  }
}

function commandEnvelope(value: string): boolean {
  const tags = ['command-name', 'command-message', 'command-args']
  if (tags.some((tag) => field(value, tag) === null)) return false
  const fragments = /<(command-name|command-message|command-args)>[\s\S]*?<\/\1>/g
  return [...value.matchAll(fragments)].length === 3 && value.replace(fragments, '').trim() === ''
}

function delegation(id: string, value: string, reject: RejectClaudeShape): FeedContent {
  const agentId = field(value, 'id')
  const rawStatus = field(value, 'status')
  if (agentId === null || agentId === '' || rawStatus === null) {
    reject('realtime_delegation')
    return {
      id,
      kind: 'diagnostic',
      vendorType: 'realtime_delegation',
      detail: 'Missing agent identity or status.',
    }
  }
  if (!Object.hasOwn(delegationStatuses, rawStatus)) {
    reject('realtime_delegation-status')
    return {
      id,
      kind: 'diagnostic',
      vendorType: 'realtime_delegation',
      detail: 'Unknown agent status.',
    }
  }
  return {
    id,
    kind: 'delegation',
    agentId,
    status: delegationStatuses[rawStatus as keyof typeof delegationStatuses],
    name: null,
    prompt: field(value, 'input'),
    model: null,
    summary: field(value, 'progress') ?? field(value, 'summary'),
  }
}

function commandInvocation(id: string, value: string, reject: RejectClaudeShape): FeedContent {
  const name = field(value, 'command-name')
  if (name === null || name === '') {
    reject('command-message')
    return {
      id,
      kind: 'diagnostic',
      vendorType: 'command-message',
      detail: 'Missing command name.',
    }
  }
  return {
    id,
    kind: 'command',
    command: `${name} ${field(value, 'command-args') ?? ''}`.trim(),
    cwd: null,
    status: 'completed',
    output: null,
    stderr: null,
    exitCode: null,
  }
}

function shellOutput(id: string, value: string): FeedContent | null {
  if (!value.startsWith('<bash-stdout>') || !value.endsWith('</bash-stderr>')) return null
  return {
    id,
    kind: 'command',
    command: null,
    cwd: null,
    status: 'completed',
    output: field(value, 'bash-stdout'),
    stderr: field(value, 'bash-stderr'),
    exitCode: null,
  }
}

function singleEnvelope(id: string, value: string): FeedContent | null {
  const command = wrapped(value, 'bash-input')
  if (command !== null)
    return {
      id,
      kind: 'command',
      command,
      cwd: null,
      status: 'running',
      output: null,
      stderr: null,
      exitCode: null,
    }
  for (const tag of [
    'bash-stdout',
    'bash-stderr',
    'local-command-stdout',
    'local-command-stderr',
  ]) {
    const body = wrapped(value, tag)
    if (body === null) continue
    const isError = tag.endsWith('stderr')
    return {
      id,
      kind: 'command',
      command: null,
      cwd: null,
      status: 'completed',
      output: isError ? null : body,
      stderr: isError ? body : null,
      exitCode: null,
    }
  }
  for (const tag of ['system-reminder', 'local-command-caveat']) {
    const body = wrapped(value, tag)
    if (body !== null) return { id, kind: 'context', source: 'system', text: body }
  }
  const pasted = wrapped(value, 'pasted_content')
  if (pasted !== null)
    return {
      id,
      kind: 'reference',
      referenceType: 'pasted',
      label: 'Pasted content',
      target: null,
      text: pasted,
    }
  return null
}

export function decodeClaudeText(
  input: {
    id: string
    role: 'user' | 'assistant'
    text: string
    vendorEnvelope: boolean
    humanInput: boolean
  },
  reject: RejectClaudeShape,
): FeedContent {
  const { id, role, text } = input
  if (role === 'assistant') return { id, kind: 'message', role, text }
  const value = text.trim()
  if (commandEnvelope(value)) return commandInvocation(id, value, reject)
  if (input.humanInput) return { id, kind: 'message', role, text }
  if (wrapped(value, 'task-notification') !== null) return taskNotification(id, value, reject)
  if (wrapped(value, 'realtime_delegation') !== null) return delegation(id, value, reject)
  const shell = shellOutput(id, value)
  if (shell !== null) return shell
  const single = singleEnvelope(id, value)
  if (single !== null) return single
  if (input.vendorEnvelope && /^<[a-z][\w-]*>[\s\S]*<\/[a-z][\w-]*>$/.test(value)) {
    reject('unknown-envelope')
    return {
      id,
      kind: 'diagnostic',
      vendorType: 'unknown-envelope',
      detail: 'Claude transcript envelope is not supported.',
    }
  }
  return { id, kind: 'message', role, text }
}
