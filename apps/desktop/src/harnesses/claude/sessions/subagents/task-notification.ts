import type {
  TranscriptMessage,
  TranscriptRecord,
} from '@/domains/sessions/contract/model/transcript/transcript'
import { taggedField } from '@/harnesses/host/envelope-tags'
import { isIdentifier } from '@/shared/validation'
import { backgroundState, readTaskEnding } from './background-task'
import { replyLine } from './subagent-events'

export function identifierTag(text: string, tag: string): string | null {
  const value = taggedField(text, tag)
  return value !== null && isIdentifier(value) ? value : null
}

// An agent's result is its own report; a workflow's is JSON meant for the model.
function reportText(text: string): string | null {
  const result = taggedField(text, 'result')
  return result === null || result.startsWith('{') || result.startsWith('[') ? null : result
}

const COMMAND_SUMMARY = 'Background command "'

// The Harness's summary names the task in quotes after one of these prefixes, e.g.
// `Agent "Consolidate stories" finished`. An agent or workflow is a Subagent; anything else is a
// notice about work the Feed has no row for beyond its own words.
const SUBAGENT_PREFIXES = ['Agent', 'Dynamic workflow']

function quotedName(summary: string | null, prefixes: readonly string[]): string | null {
  if (summary === null || !prefixes.some((prefix) => summary.startsWith(`${prefix} "`))) return null
  return /^[^"]*"(.+)"/s.exec(summary)?.[1] ?? null
}

// A background task's delivery is not the person's own words: it is the Harness handing back a
// summary, with the task's full result attached for the model, not the reader.
export function readTaskDelivery(
  record: Record<string, unknown>,
  message: TranscriptMessage,
  text: string,
): TranscriptRecord {
  const ending = readTaskEnding(text, record.timestamp)
  const summary = taggedField(text, 'summary')
  // A background command is an `execute` Tool Call: its end is a background-task record on that
  // call, never a Subagent event.
  if (ending !== null && summary?.startsWith(COMMAND_SUMMARY) === true) return ending
  const name = quotedName(summary, SUBAGENT_PREFIXES)
  const subagentId = identifierTag(text, 'tool-use-id') ?? identifierTag(text, 'task-id')
  const state = backgroundState(taggedField(text, 'status'))
  if (name !== null && subagentId !== null && state !== null) {
    const reply = reportText(text)
    const line = reply === null ? undefined : replyLine(reply)
    return {
      kind: 'subagent',
      uuid: message.uuid,
      timestamp: message.timestamp,
      subagentId,
      event: 'responded',
      state,
      name,
      ...(reply === null ? {} : { reply }),
      ...(line === undefined ? {} : { text: line }),
    }
  }
  // Any other notice, such as a monitor's event, is the Harness's own status line.
  const event = taggedField(text, 'event')
  return {
    kind: 'event',
    uuid: message.uuid,
    event: 'status',
    text:
      [quotedName(summary, ['Monitor event:']) ?? summary, event].filter(Boolean).join(': ') ||
      null,
  }
}
