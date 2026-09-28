import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { RejectClaudeShape } from './claude-feed-envelopes'

type SystemMessage = Extract<SDKMessage, { type: 'system' }>
type TaskStatus = Extract<FeedContent, { kind: 'task' }>['status']
const notificationStatuses = {
  completed: 'completed',
  failed: 'failed',
  stopped: 'interrupted',
} as const

function updatedTaskStatus(
  status: 'pending' | 'running' | 'completed' | 'failed' | 'killed' | 'paused' | undefined,
): TaskStatus {
  switch (status) {
    case 'pending':
      return 'pending'
    case 'running':
      return 'running'
    case 'completed':
      return 'completed'
    case 'failed':
      return 'failed'
    case 'killed':
      return 'interrupted'
    case 'paused':
      return 'paused'
    case undefined:
      return null
  }
}

function taskContent(message: SystemMessage): FeedContent[] | null {
  switch (message.subtype) {
    case 'task_started':
      return [
        {
          id: message.task_id,
          kind: 'task',
          taskId: message.task_id,
          callId: message.tool_use_id ?? null,
          status: 'running',
          description: message.description,
          summary: null,
        },
      ]
    case 'task_progress':
      return [
        {
          id: message.task_id,
          kind: 'task',
          taskId: message.task_id,
          callId: message.tool_use_id ?? null,
          status: 'running',
          description: message.description,
          summary: message.summary ?? null,
        },
      ]
    case 'task_updated':
      return [
        {
          id: message.task_id,
          kind: 'task',
          taskId: message.task_id,
          callId: null,
          status: updatedTaskStatus(message.patch.status),
          description: message.patch.description ?? null,
          summary: message.patch.error ?? null,
        },
      ]
    case 'task_notification':
      return [
        {
          id: message.task_id,
          kind: 'task',
          taskId: message.task_id,
          callId: message.tool_use_id ?? null,
          status: notificationStatuses[message.status],
          description: null,
          summary: message.summary,
        },
      ]
    default:
      return null
  }
}

function noticeContent(message: SystemMessage): FeedContent[] | null {
  const id = message.uuid
  switch (message.subtype) {
    case 'status':
      return message.status === null
        ? []
        : [{ id, kind: 'notification', category: 'status', text: message.status, priority: null }]
    case 'api_retry':
      return [
        {
          id,
          kind: 'notification',
          category: 'retry',
          text: `API retry ${message.attempt} of ${message.max_retries}: ${message.error}`,
          priority: null,
        },
      ]
    case 'notification':
      return [
        {
          id,
          kind: 'notification',
          category: 'info',
          text: message.text,
          priority: message.priority,
        },
      ]
    case 'informational': {
      const categories = {
        info: 'info',
        notice: 'info',
        suggestion: 'suggestion',
        warning: 'warning',
      } as const
      return [
        {
          id,
          kind: 'notification',
          category: categories[message.level],
          text: message.content,
          priority: null,
        },
      ]
    }
    case 'local_command_output':
      return [
        {
          id,
          kind: 'command',
          command: null,
          cwd: null,
          status: 'completed',
          output: message.content,
          stderr: null,
          exitCode: null,
        },
      ]
    default:
      return null
  }
}

function activityContent(message: SystemMessage): FeedContent[] | null {
  const id = message.uuid
  switch (message.subtype) {
    case 'hook_started':
    case 'hook_progress':
    case 'hook_response':
      return [
        { id, kind: 'notification', category: 'hook', text: message.hook_name, priority: null },
      ]
    case 'plugin_install':
      return [
        {
          id,
          kind: 'notification',
          category: 'plugin',
          text: `${message.name ?? 'Plugin'}: ${message.status}`,
          priority: null,
        },
      ]
    case 'files_persisted':
      return [
        ...message.files.map((file, index) => ({
          id: `${id}:file:${index}`,
          kind: 'reference' as const,
          referenceType: 'file' as const,
          label: file.filename,
          target: file.file_id,
          text: null,
        })),
        ...message.failed.map((file, index) => ({
          id: `${id}:failed:${index}`,
          kind: 'diagnostic' as const,
          vendorType: 'files_persisted',
          detail: `${file.filename}: ${file.error}`,
        })),
      ]
    case 'memory_recall':
      return message.memories.map((memory, index) => ({
        id: `${id}:${index}`,
        kind: 'reference',
        referenceType: 'memory',
        label: memory.path,
        target: memory.path,
        text: memory.content ?? null,
      }))
    default:
      return null
  }
}

function failureContent(message: SystemMessage): FeedContent[] | null {
  const id = message.uuid
  switch (message.subtype) {
    case 'model_refusal_fallback':
      return [{ id, kind: 'refusal', reason: 'fallback', text: message.content }]
    case 'model_refusal_no_fallback':
      return [{ id, kind: 'refusal', reason: 'model', text: message.content }]
    case 'permission_denied':
      return [{ id, kind: 'refusal', reason: 'permission', text: message.message }]
    case 'mirror_error':
      return [{ id, kind: 'diagnostic', vendorType: 'mirror_error', detail: message.error }]
    default:
      return null
  }
}

const lifecycleSubtypes = new Set([
  'init',
  'session_state_changed',
  'background_tasks_changed',
  'thinking_tokens',
  'commands_changed',
  'worker_shutting_down',
  'elicitation_complete',
  'control_request_progress',
])

export function decodeClaudeSystemContent(
  message: SystemMessage,
  reject: RejectClaudeShape,
): FeedContent[] {
  const task = taskContent(message)
  if (task !== null) return task
  const notice = noticeContent(message)
  if (notice !== null) return notice
  const activity = activityContent(message)
  if (activity !== null) return activity
  const failure = failureContent(message)
  if (failure !== null) return failure
  if (message.subtype === 'compact_boundary')
    return [{ id: message.uuid, kind: 'marker', marker: 'compaction', summary: null }]
  if (lifecycleSubtypes.has(message.subtype)) return []
  reject(`system:${message.subtype}`)
  return []
}
