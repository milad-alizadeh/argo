import { isIdentifier } from '@/boundary'
import type { TranscriptMessage, TranscriptRecord } from '@/core/sessions/transcript'
import { taggedField } from '../../envelope-tags'
import { readTaskEnding } from './background-task'

type Delegation = Extract<TranscriptRecord, { kind: 'delegation' }>

export function identifierTag(text: string, tag: string): string | null {
  const value = taggedField(text, tag)
  return value !== null && isIdentifier(value) ? value : null
}

// An agent's result opens with its own report; a workflow's is JSON meant for the model.
function firstReportLine(text: string): string | null {
  const result = taggedField(text, 'result')
  if (result === null || result.startsWith('{') || result.startsWith('[')) return null
  const line = result
    .split('\n')
    .map((entry) => entry.replace(/[*_`#>]/g, '').trim())
    .find((entry) => entry.length > 0)
  return line ?? null
}

// The CLI's summary names the task in quotes after one of these prefixes, e.g.
// `Background command "Install dependencies" completed (exit code 0)`.
const SUMMARY_KINDS = [
  { prefix: 'Agent', actor: 'agent', progress: firstReportLine },
  { prefix: 'Dynamic workflow', actor: 'agent', progress: firstReportLine },
  { prefix: 'Background command', actor: 'shell', progress: () => null },
  {
    prefix: 'Monitor event:',
    actor: 'shell',
    progress: (text: string) => taggedField(text, 'event'),
  },
] as const satisfies readonly {
  prefix: string
  actor: Delegation['actor']
  progress: (text: string) => string | null
}[]

// A background task's delivery is not the person's own words: it is the CLI handing back a
// summary, with the task's full result attached for the model, not the reader.
export function readTaskDelivery(
  record: Record<string, unknown>,
  message: TranscriptMessage,
  text: string,
): TranscriptRecord {
  const ending = readTaskEnding(text, record.timestamp)
  const notification = readTaskNotification(text)
  const callId = identifierTag(text, 'tool-use-id')
  const taskId = identifierTag(text, 'task-id')
  return {
    kind: 'delegation',
    uuid: message.uuid,
    timestamp: message.timestamp,
    ...notification,
    status: taggedField(text, 'status'),
    // A Subagent's card is keyed by the call that spawned it (`spawned-agents.ts`).
    groupId: notification.actor === 'agent' ? (callId ?? taskId) : taskId,
    callId,
    ...(ending === null ? {} : { ending }),
  }
}

// A background task's notification: which kind of work ended, its readable name, and its latest line.
function readTaskNotification(text: string): Pick<Delegation, 'actor' | 'action' | 'progress'> {
  const summary = taggedField(text, 'summary')
  for (const kind of SUMMARY_KINDS) {
    const name = summary?.startsWith(`${kind.prefix} "`)
      ? /^[^"]*"(.+)"/s.exec(summary)?.[1]
      : undefined
    if (name !== undefined)
      return { actor: kind.actor, action: name, progress: kind.progress(text) }
  }
  return { actor: 'shell', action: summary, progress: null }
}
