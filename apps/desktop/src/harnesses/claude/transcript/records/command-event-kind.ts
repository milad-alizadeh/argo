import type { TranscriptEventKind } from '@/domains/sessions/contract/model/transcript/transcript'

export function commandEventKind(command: string): TranscriptEventKind {
  return command.startsWith('/') ? 'skill-invocation' : 'command'
}
