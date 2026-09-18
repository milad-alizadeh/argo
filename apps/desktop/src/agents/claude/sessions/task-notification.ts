import type { TranscriptRecord } from '../../../domains/sessions/contract/transcript'
import { taggedField } from '../../envelope-tags'

type Delegation = Extract<TranscriptRecord, { kind: 'delegation' }>

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

// A background task's notification: which kind of work ended, its readable name, and its latest line.
export function readTaskNotification(
  text: string,
): Pick<Delegation, 'actor' | 'action' | 'progress'> {
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
