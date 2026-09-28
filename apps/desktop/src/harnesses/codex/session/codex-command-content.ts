import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { CommandExecutionStatus } from '../app-server/protocol-generated/v2/command-execution-status'
import type { ThreadItem } from '../app-server/protocol-generated/v2/thread-item'

const commandStatuses = {
  inProgress: 'running',
  completed: 'completed',
  failed: 'failed',
  declined: 'failed',
} as const satisfies Record<
  CommandExecutionStatus,
  Extract<FeedContent, { kind: 'command' }>['status']
>

export function codexCommandContent(
  item: Extract<ThreadItem, { type: 'commandExecution' }>,
  phase: 'started' | 'completed',
): Extract<FeedContent, { kind: 'command' }> {
  const status = phase === 'started' ? 'running' : commandStatuses[item.status]
  return {
    kind: 'command',
    id: item.id,
    command: item.command ?? null,
    cwd: item.cwd ?? null,
    status,
    output: item.aggregatedOutput ?? null,
    stderr: null,
    exitCode: item.exitCode ?? null,
  }
}
